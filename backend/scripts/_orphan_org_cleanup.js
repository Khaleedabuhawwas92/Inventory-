// Cleans up organizations left behind by failed registration attempts —
// SAFELY: an organization is only ever deleted if it has ZERO dependent
// documents in every tenant-scoped business-data collection (AuditLog is the
// one exception — an orphan org's own audit trail is cleaned alongside it,
// since it's failed-attempt noise, not business data worth preserving on its
// own). Anything with real dependent data is reported, never touched.
//
// Dry-run by default — prints exactly what it WOULD delete. Only mutates
// when run with --confirm:
//   node scripts/_orphan_org_cleanup.js            (report only, no writes)
//   node scripts/_orphan_org_cleanup.js --confirm   (actually deletes)
//
// Never touches the migration's own default/legacy organization
// (isMigrationDefault: true) or any organization with dependent data.
require('dotenv').config();
const mongoose = require('mongoose');

const BUSINESS_COLLECTIONS = [
  'categories', 'goodsreceipts', 'inventorycounts', 'notifications',
  'products', 'purchaseorders', 'roles', 'settings', 'stockadjustments',
  'stockbalances', 'stockins', 'stockmovements', 'stockouts', 'stockreturns',
  'stocktransfers', 'suppliers', 'units', 'users', 'warehouselocations',
  'warehouses', 'invitations', 'platformorganizationnotes',
];
// Counters aren't organization-identifying business data on their own
// (just numbering state) and auditlogs is failed-attempt noise, not
// something worth blocking a cleanup over — both are cleaned alongside an
// org confirmed orphan by BUSINESS_COLLECTIONS, never used to block one.
const ALSO_CLEAN_IF_ORPHAN = ['counters', 'auditlogs'];

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system');
  const db = mongoose.connection.db;

  const orgs = await db.collection('organizations').find({}).sort({ createdAt: 1 }).toArray();
  console.log(`Found ${orgs.length} organization(s). Mode: ${CONFIRM ? 'CONFIRM (will delete)' : 'DRY RUN (report only)'}\n`);

  const orphans = [];
  const kept = [];

  for (const org of orgs) {
    if (org.isMigrationDefault) {
      kept.push({ org, reason: 'isMigrationDefault=true — the legacy data organization, never auto-cleaned' });
      continue;
    }

    const dependents = {};
    let hasBusinessData = false;
    for (const name of BUSINESS_COLLECTIONS) {
      const exists = await db.listCollections({ name }).toArray();
      if (!exists.length) continue;
      const count = await db.collection(name).countDocuments({ organizationId: org._id });
      if (count > 0) {
        dependents[name] = count;
        hasBusinessData = true;
      }
    }

    if (hasBusinessData) {
      kept.push({ org, reason: 'has dependent business data', dependents });
    } else {
      orphans.push(org);
    }
  }

  console.log('=== KEPT (not touched) ===');
  if (!kept.length) console.log('  (none)');
  kept.forEach(({ org, reason, dependents }) => {
    console.log(`  ${org._id}  "${org.name}"  createdAt=${org.createdAt}`);
    console.log(`    reason: ${reason}`);
    if (dependents) Object.entries(dependents).forEach(([k, v]) => console.log(`      ${k}: ${v}`));
  });

  console.log('\n=== ORPHANS (zero dependent business data) ===');
  if (!orphans.length) console.log('  (none found)');
  for (const org of orphans) {
    console.log(`  ${org._id}  "${org.name}"  createdAt=${org.createdAt}`);
  }

  if (!orphans.length) {
    console.log('\nNothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  if (!CONFIRM) {
    console.log(`\nDry run only — ${orphans.length} organization(s) would be deleted, plus their counters/auditlogs entries.`);
    console.log('Re-run with --confirm to actually delete them.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nDeleting ${orphans.length} orphan organization(s)...`);
  for (const org of orphans) {
    for (const name of ALSO_CLEAN_IF_ORPHAN) {
      const exists = await db.listCollections({ name }).toArray();
      if (!exists.length) continue;
      const result = await db.collection(name).deleteMany({ organizationId: org._id });
      if (result.deletedCount) console.log(`  [${org._id}] cleaned ${result.deletedCount} ${name} document(s)`);
    }
    await db.collection('organizations').deleteOne({ _id: org._id });
    console.log(`  [${org._id}] deleted organization "${org.name}"`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ORPHAN CLEANUP FAILED:', err);
  process.exit(1);
});
