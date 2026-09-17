const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const BACKUP_ROOT = path.join(__dirname, '..', '..', 'backups');

// Operates on the raw MongoDB driver (mongoose.connection.db), one level
// below Mongoose models, and on purpose:
//   - Mongoose schema options like `select: false` (e.g. User.passwordHash)
//     silently exclude fields from `Model.find()` results. A backup taken
//     through a model would then be missing that data, and restoring it
//     would recreate users with no password hash at all — a real data-loss
//     bug this exact approach hit before being rewritten this way.
//   - insertMany() through a model re-runs full schema validation on data
//     that was already valid when it was written; restoring should not be
//     able to fail because a schema changed since the backup was taken.
//   - EJSON (BSON's extended JSON) is used instead of plain JSON so
//     ObjectId/Date/etc. round-trip as their real types, not the strings
//     plain JSON.stringify would flatten them to.
async function runBackup({ type = 'manual', triggeredBy = null } = {}) {
  const db = mongoose.connection.db;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dirName = `${timestamp}_${type}`;
  const dir = path.join(BACKUP_ROOT, dirName);
  fs.mkdirSync(dir, { recursive: true });

  const collectionInfos = await db.listCollections().toArray();
  const collections = [];
  for (const { name } of collectionInfos) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs));
    collections.push({ collection: name, count: docs.length });
  }

  const meta = {
    id: dirName,
    type,
    triggeredBy,
    createdAt: new Date().toISOString(),
    collections,
  };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2));

  return meta;
}

function listBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return [];
  return fs
    .readdirSync(BACKUP_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metaPath = path.join(BACKUP_ROOT, entry.name, '_meta.json');
      if (!fs.existsSync(metaPath)) return null;
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const sizeBytes = fs
        .readdirSync(path.join(BACKUP_ROOT, entry.name))
        .reduce((sum, f) => sum + fs.statSync(path.join(BACKUP_ROOT, entry.name, f)).size, 0);
      return { ...meta, sizeBytes };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBackupDir(id) {
  // Guard against path traversal — id must be a plain directory name we created.
  if (!/^[\w.-]+$/.test(id)) throw new Error('معرّف نسخة احتياطية غير صالح');
  const dir = path.join(BACKUP_ROOT, id);
  if (!fs.existsSync(dir)) return null;
  return dir;
}

// Wipes every collection covered by the backup and reloads it from the dump,
// via the raw driver — see the module comment for why. Not wrapped in a
// transaction: on a standalone MongoDB (the common local/self-hosted case)
// transactions aren't available anyway, and a restore is an administrative
// maintenance action performed with the app otherwise idle, not a concurrent
// business operation.
async function restoreBackup(id) {
  const dir = getBackupDir(id);
  if (!dir) throw new Error('النسخة الاحتياطية غير موجودة');

  const meta = JSON.parse(fs.readFileSync(path.join(dir, '_meta.json'), 'utf8'));
  const db = mongoose.connection.db;

  for (const { collection } of meta.collections) {
    const filePath = path.join(dir, `${collection}.json`);
    if (!fs.existsSync(filePath)) continue;
    const docs = EJSON.parse(fs.readFileSync(filePath, 'utf8'));
    await db.collection(collection).deleteMany({});
    if (docs.length) await db.collection(collection).insertMany(docs, { ordered: false });
  }
  return meta;
}

function deleteBackup(id) {
  const dir = getBackupDir(id);
  if (!dir) throw new Error('النسخة الاحتياطية غير موجودة');
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { runBackup, listBackups, restoreBackup, deleteBackup, getBackupDir, BACKUP_ROOT };
