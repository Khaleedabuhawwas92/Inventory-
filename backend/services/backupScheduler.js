const Settings = require('../models/Settings');
const backupService = require('./backupService');
const tenantContext = require('../utils/tenantContext');

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly — fine-grained enough for daily/weekly/monthly cadences

function isDue(settingsDoc) {
  const dueMs = FREQUENCY_MS[settingsDoc.backup.frequency] || FREQUENCY_MS.weekly;
  const last = settingsDoc.backup.lastAutoBackupAt ? new Date(settingsDoc.backup.lastAutoBackupAt).getTime() : 0;
  return Date.now() - last >= dueMs;
}

// A backup dumps the *entire* database (every organization at once — see
// services/backupService.js), so "is an auto-backup due" has to be answered
// across every organization's own Settings toggle, not one tenant's. This
// intentionally runs outside any single organization's tenant context (see
// utils/tenantContext.js) — it is the one legitimate cross-organization
// background job in the system, matching backup/restore being a
// platform-level action (see middleware/requirePlatformAdmin.js).
async function checkAndRunAutoBackup() {
  try {
    const dueOrgSettings = await tenantContext.runWithoutTenant(async () => {
      const candidates = await Settings.find({ 'backup.autoBackupEnabled': true }).select('organizationId backup');
      return candidates.filter(isDue);
    });

    if (dueOrgSettings.length === 0) return;

    await backupService.runBackup({ type: 'auto' });

    await tenantContext.runWithoutTenant(async () =>
      Settings.updateMany(
        { organizationId: { $in: dueOrgSettings.map((s) => s.organizationId) } },
        { $set: { 'backup.lastAutoBackupAt': new Date() } }
      )
    );

    console.log(`[BackupScheduler] Automatic backup completed (due for ${dueOrgSettings.length} organization(s))`);
  } catch (err) {
    console.error('[BackupScheduler] Automatic backup failed:', err.message);
  }
}

function startBackupScheduler() {
  checkAndRunAutoBackup();
  return setInterval(checkAndRunAutoBackup, CHECK_INTERVAL_MS);
}

module.exports = { startBackupScheduler, checkAndRunAutoBackup };
