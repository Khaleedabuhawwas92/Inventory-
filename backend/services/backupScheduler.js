const Settings = require('../models/Settings');
const backupService = require('./backupService');

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly — fine-grained enough for daily/weekly/monthly cadences

async function checkAndRunAutoBackup() {
  try {
    const settings = await Settings.findOne().select('backup');
    if (!settings?.backup?.autoBackupEnabled) return;

    const dueMs = FREQUENCY_MS[settings.backup.frequency] || FREQUENCY_MS.weekly;
    const last = settings.backup.lastAutoBackupAt ? new Date(settings.backup.lastAutoBackupAt).getTime() : 0;
    if (Date.now() - last < dueMs) return;

    await backupService.runBackup({ type: 'auto' });
    await Settings.updateOne({}, { $set: { 'backup.lastAutoBackupAt': new Date() } });
    console.log('[BackupScheduler] Automatic backup completed');
  } catch (err) {
    console.error('[BackupScheduler] Automatic backup failed:', err.message);
  }
}

function startBackupScheduler() {
  checkAndRunAutoBackup();
  return setInterval(checkAndRunAutoBackup, CHECK_INTERVAL_MS);
}

module.exports = { startBackupScheduler, checkAndRunAutoBackup };
