// One-time, idempotent migration: converts the pre-multi-tenant database
// into the multi-tenant shape by creating a single "default" Organization and
// attaching every existing document to it via organizationId, then replacing
// the old globally-unique indexes (sku, docNo, code, ...) with per-organization
// compound ones.
//
// Safe to run multiple times: every step only touches documents/indexes that
// still need it, so re-running after a partial run (or after the app is
// already fully migrated) is a no-op. Never deletes or resets anything —
// only adds the new organizationId field and swaps index definitions.
//
// Uses the raw MongoDB driver throughout, deliberately bypassing Mongoose
// models entirely (same reasoning as services/backupService.js: this must
// not be blocked by schema validation or the new tenantPlugin requiring a
// tenant context that doesn't exist outside a request).
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

// Collections that are tenant-scoped in the new schema and therefore need
// organizationId backfilled onto every pre-existing document.
const TENANT_COLLECTIONS = [
  'categories', 'counters', 'goodsreceipts', 'inventorycounts', 'notifications',
  'products', 'purchaseorders', 'roles', 'settings', 'stockadjustments',
  'stockbalances', 'stockins', 'stockmovements', 'stockouts', 'stockreturns',
  'stocktransfers', 'suppliers', 'units', 'users', 'warehouselocations',
  'warehouses', 'auditlogs',
];

// [collection, old index name, new compound index spec, new index options]
//
// Fields that are optional per-document (barcode, code) use
// partialFilterExpression rather than `sparse`: on a *compound* index,
// `sparse` only excludes a document when EVERY indexed field is missing.
// Since organizationId is always present, that would never actually exclude
// anything, and two documents in the same organization with no
// barcode/code would collide as a duplicate key. A partial index (only
// indexing documents where the field genuinely exists) is the correct
// mechanism here.
const INDEX_MIGRATIONS = [
  ['products', 'sku_1', { organizationId: 1, sku: 1 }, { unique: true }],
  ['products', 'barcode_1', { organizationId: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $exists: true } } }],
  ['warehouses', 'code_1', { organizationId: 1, code: 1 }, { unique: true }],
  ['categories', 'code_1', { organizationId: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $exists: true } } }],
  ['units', 'shortCode_1', { organizationId: 1, shortCode: 1 }, { unique: true }],
  ['suppliers', 'code_1', { organizationId: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $exists: true } } }],
  ['counters', 'key_1', { organizationId: 1, key: 1 }, { unique: true }],
  ['roles', 'name_1', { organizationId: 1, name: 1 }, { unique: true }],
  ['stockins', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['stockouts', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['stockadjustments', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['stocktransfers', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['stockreturns', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['purchaseorders', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['goodsreceipts', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['inventorycounts', 'docNo_1', { organizationId: 1, docNo: 1 }, { unique: true }],
  ['stockmovements', 'movementNo_1', { organizationId: 1, movementNo: 1 }, { unique: true }],
  ['settings', null, { organizationId: 1 }, { unique: true }],
];

async function dropIndexIfExists(db, collectionName, indexName) {
  if (!indexName) return;
  try {
    await db.collection(collectionName).dropIndex(indexName);
    console.log(`  [index] dropped ${collectionName}.${indexName}`);
  } catch (err) {
    if (err.codeName !== 'IndexNotFound' && err.code !== 27) {
      throw err;
    }
  }
}

function sameKeyPattern(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k, i) => k === bKeys[i] && a[k] === b[k]);
}

// Idempotent by *key pattern*, not just by name: an interrupted or
// previously-attempted run (or any other leftover index covering the same
// fields under a different name/options — e.g. an older sparse:true version
// before this migration used partialFilterExpression) is dropped and
// recreated fresh, rather than erroring out on a name/definition conflict.
async function ensureIndex(db, collectionName, keys, options) {
  const existing = await db.collection(collectionName).indexes();
  const conflicting = existing.find((idx) => sameKeyPattern(idx.key, keys));
  if (conflicting) {
    await db.collection(collectionName).dropIndex(conflicting.name);
  }
  await db.collection(collectionName).createIndex(keys, options);
}

async function run(db) {
  console.log('[Migration 001] Starting multi-tenant backfill...\n');

  // 1. The default organization is created lazily — only the first time a
  // document actually needs backfilling — not unconditionally up front. On a
  // database with no pre-existing organizationId-less documents (e.g. a
  // freshly created database, or one that has already been fully migrated),
  // eagerly creating this org would leave a permanent, pointless "legacy"
  // organization behind with nothing in it. Tagged with isMigrationDefault so
  // repeated runs (and concurrent backfill iterations below) reuse the same
  // one instead of creating a second.
  let defaultOrg = null;
  async function ensureDefaultOrg() {
    if (defaultOrg) return defaultOrg;
    defaultOrg = await db.collection('organizations').findOne({ isMigrationDefault: true });
    if (!defaultOrg) {
      const existingSettings = await db.collection('settings').findOne({});
      const existingUser = await db.collection('users').findOne({}, { sort: { createdAt: 1 } });
      const orgName = existingSettings?.company?.name || 'المؤسسة الافتراضية';

      const insertResult = await db.collection('organizations').insertOne({
        name: orgName,
        status: 'active',
        createdBy: existingUser?._id || null,
        isMigrationDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      defaultOrg = { _id: insertResult.insertedId, name: orgName };
      console.log(`[Migration 001] Created default organization "${orgName}" (${defaultOrg._id})`);
    } else {
      console.log(`[Migration 001] Using existing default organization "${defaultOrg.name}" (${defaultOrg._id})`);
    }
    return defaultOrg;
  }

  // 2. Backfill organizationId onto every pre-existing document in every
  // tenant-scoped collection. Only touches documents that don't have it yet.
  console.log('\n[Migration 001] Backfilling organizationId...');
  let backfilledAny = false;
  for (const collectionName of TENANT_COLLECTIONS) {
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) continue; // collection doesn't exist yet — nothing to backfill

    const pendingCount = await db.collection(collectionName).countDocuments({ organizationId: { $exists: false } });
    if (pendingCount === 0) continue;

    const org = await ensureDefaultOrg();
    const result = await db.collection(collectionName).updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: org._id } }
    );
    if (result.modifiedCount > 0) {
      backfilledAny = true;
      console.log(`  [backfill] ${collectionName}: ${result.modifiedCount} document(s)`);
    }
  }
  if (!backfilledAny) {
    console.log('  [backfill] no documents needed organizationId — no default organization created');
  }

  // 3. Preserve existing users' exact prior capability: they could already
  // reach whole-database backup/restore (gated only by role name before this
  // migration); isPlatformAdmin now gates that instead (see
  // middleware/requirePlatformAdmin.js) and must be explicitly set for them.
  // Only matches documents that predate this migration — any user created
  // afterward already has isPlatformAdmin explicitly set (default false) by
  // the User schema, so this is a no-op on re-run.
  const platformAdminResult = await db.collection('users').updateMany(
    { isPlatformAdmin: { $exists: false } },
    { $set: { isPlatformAdmin: true } }
  );
  if (platformAdminResult.modifiedCount > 0) {
    console.log(`  [backfill] users: granted isPlatformAdmin to ${platformAdminResult.modifiedCount} pre-existing account(s)`);
  }

  // 4. Replace old globally-unique indexes with per-organization compound
  // ones so different organizations can reuse the same SKU/code/docNo/etc.
  console.log('\n[Migration 001] Migrating indexes...');
  for (const [collectionName, oldIndexName, newKeys, newOptions] of INDEX_MIGRATIONS) {
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) continue;

    await dropIndexIfExists(db, collectionName, oldIndexName);
    await ensureIndex(db, collectionName, newKeys, newOptions);
    console.log(`  [index] ensured ${collectionName}.${JSON.stringify(newKeys)} (unique${newOptions.sparse ? ', sparse' : ''})`);
  }

  console.log('\n[Migration 001] Done. No existing data was deleted or reset.');
}

async function main() {
  await connectDB();
  await run(mongoose.connection.db);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Migration 001] Failed:', err);
    process.exit(1);
  });
}

module.exports = { run };
