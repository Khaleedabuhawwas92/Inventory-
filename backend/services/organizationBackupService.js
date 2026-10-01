const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

// Separate on purpose from services/backupService.js, which dumps/restores
// the *entire* database (every organization at once) and is reachable only
// by a Platform Admin (see routes/backup.routes.js). This is the ordinary
// tenant-facing feature: one organization's own admin backs up/restores only
// its own data — never anyone else's, enforced at three independent layers:
//   1. Every read/write below is explicitly filtered by organizationId (the
//      raw MongoDB driver is used, deliberately bypassing utils/tenantPlugin.js
//      — same reasoning as backupService.js: this must not depend on ambient
//      tenant-context scoping being correctly wired for every collection).
//   2. Each organization's backups live under their own filesystem
//      subdirectory (ORG_BACKUP_ROOT/<organizationId>/...), so one org's
//      backup files are never even listable from another's.
//   3. Backup metadata records which organizationId it belongs to, checked
//      again before any restore/delete — defense in depth against a backup
//      id guessed/reused across organizations.
const ORG_BACKUP_ROOT = path.join(__dirname, '..', '..', 'backups', 'organizations');

// Every tenant-scoped collection worth restoring an organization to a prior
// state — mirrors migrations/001_multi_tenant_backfill.js's TENANT_COLLECTIONS
// (kept as a separate copy rather than a shared import: that migration file
// is a one-time, already-run script and intentionally isn't a dependency of
// anything else).
const TENANT_COLLECTIONS = [
  'categories', 'goodsreceipts', 'inventorycounts', 'notifications',
  'products', 'purchaseorders', 'roles', 'settings', 'stockadjustments',
  'stockbalances', 'stockins', 'stockmovements', 'stockouts', 'stockreturns',
  'stocktransfers', 'suppliers', 'units', 'users', 'warehouselocations',
  'warehouses',
];

function orgDir(organizationId) {
  return path.join(ORG_BACKUP_ROOT, String(organizationId));
}

// Guards against path traversal the same way backupService.getBackupDir()
// does — id must be a plain directory name this service created itself.
function validId(id) {
  return /^[\w.-]+$/.test(id);
}

async function runBackup(organizationId, { type = 'manual', triggeredBy = null } = {}) {
  const db = mongoose.connection.db;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dirName = `${timestamp}_${type}`;
  const dir = path.join(orgDir(organizationId), dirName);
  fs.mkdirSync(dir, { recursive: true });

  const collections = [];
  for (const name of TENANT_COLLECTIONS) {
    const exists = await db.listCollections({ name }).toArray();
    if (!exists.length) continue; // collection doesn't exist yet — nothing to dump
    const docs = await db.collection(name).find({ organizationId: new mongoose.Types.ObjectId(organizationId) }).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs));
    collections.push({ collection: name, count: docs.length });
  }

  const meta = {
    id: dirName,
    organizationId: String(organizationId),
    type,
    triggeredBy,
    createdAt: new Date().toISOString(),
    collections,
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

// Never throws just because this organization has no backups yet, or has
// never taken one (no subdirectory exists at all) — both are a normal,
// clean empty state, not an error.
function listBackups(organizationId) {
  const dir = orgDir(organizationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metaPath = path.join(dir, entry.name, '_meta.json');
      if (!fs.existsSync(metaPath)) return null;
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const sizeBytes = fs
        .readdirSync(path.join(dir, entry.name))
        .reduce((sum, f) => sum + fs.statSync(path.join(dir, entry.name, f)).size, 0);
      return { ...meta, sizeBytes };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Returns the backup's own directory + parsed meta only if `id` both exists
// AND its recorded organizationId matches the caller's — the defense-in-depth
// layer described at the top of this file.
function getOwnedBackup(organizationId, id) {
  if (!validId(id)) throw new Error('معرّف نسخة احتياطية غير صالح');
  const dir = path.join(orgDir(organizationId), id);
  const metaPath = path.join(dir, '_meta.json');
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (meta.organizationId !== String(organizationId)) return null;
  return { dir, meta };
}

// Restores only THIS organization's own documents in each backed-up
// collection — deleteMany is always scoped by organizationId, never the
// whole-collection wipe services/backupService.js does for its (single-
// tenant-at-a-time, whole-database) use case. Any other organization's data
// in the same physical collections is completely untouched.
async function restoreBackup(organizationId, id) {
  const owned = getOwnedBackup(organizationId, id);
  if (!owned) throw new Error('النسخة الاحتياطية غير موجودة');
  const { dir, meta } = owned;
  const db = mongoose.connection.db;
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);

  for (const { collection } of meta.collections) {
    const filePath = path.join(dir, `${collection}.json`);
    if (!fs.existsSync(filePath)) continue;
    const docs = EJSON.parse(fs.readFileSync(filePath, 'utf8'));
    await db.collection(collection).deleteMany({ organizationId: orgObjectId });
    if (docs.length) await db.collection(collection).insertMany(docs, { ordered: false });
  }
  return meta;
}

function deleteBackup(organizationId, id) {
  const owned = getOwnedBackup(organizationId, id);
  if (!owned) throw new Error('النسخة الاحتياطية غير موجودة');
  fs.rmSync(owned.dir, { recursive: true, force: true });
}

module.exports = { runBackup, listBackups, restoreBackup, deleteBackup, ORG_BACKUP_ROOT };
