// Full database backup, taken BEFORE any of the multi-tenant index/data
// repair steps. Reuses the existing services/backupService.js (raw MongoDB
// driver + BSON EJSON — the same mechanism the Settings → Backup UI uses),
// rather than writing new backup logic. Prints the resulting directory so it
// can be confirmed before any mutation proceeds.
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const backupService = require('../services/backupService');

async function main() {
  await connectDB();
  const meta = await backupService.runBackup({ type: 'manual', triggeredBy: 'pre-multi-tenant-index-fix' });
  console.log('\n=== BACKUP COMPLETE ===');
  console.log('Location:', require('path').join(backupService.BACKUP_ROOT, meta.id));
  console.log('Collections backed up:');
  meta.collections.forEach((c) => console.log(`  ${c.collection}: ${c.count} document(s)`));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('BACKUP FAILED:', err);
  process.exit(1);
});
