const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_org_backup';
const { startServer, stopServer, api } = require('../test-lib/helpers');
const { ORG_BACKUP_ROOT } = require('../services/organizationBackupService');

let orgAToken, orgBToken, platformToken;
let orgAId, orgACategoryId, orgAUnitId;

test('organization-scoped backups', async (t) => {
  await startServer();

  await t.test('setup: two organizations, org A admin elevated to platform admin', async () => {
    const resA = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة النسخ الاحتياطي',
        admin: { fullName: 'Backup Admin A', username: 'backup_admin_a', email: 'backup_admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'BKA' },
      },
    });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    orgAToken = resA.body.data.accessToken;
    orgAId = resA.body.data.user.organizationId;

    const resB = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة أخرى',
        admin: { fullName: 'Backup Admin B', username: 'backup_admin_b', email: 'backup_admin_b@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'BKB' },
      },
    });
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
    orgBToken = resB.body.data.accessToken;

    const User = require('../models/User');
    await User.updateOne({ username: 'backup_admin_a' }, { $set: { isPlatformAdmin: true } });
    const login = await api('POST', '/auth/login', { body: { identifier: 'backup_admin_a', password: 'Passw0rd123' } });
    platformToken = login.body.data.accessToken;
  });

  await t.test('listing backups with none yet returns an empty array, not an error', async () => {
    const res = await api('GET', '/org-backups', { token: orgAToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, []);
  });

  let backupId;

  await t.test('creating a backup succeeds and it appears in the list immediately', async () => {
    const catRes = await api('POST', '/categories', { token: orgAToken, body: { nameAr: 'فئة النسخ الاحتياطي' } });
    orgACategoryId = catRes.body.data._id;
    const unitRes = await api('POST', '/units', { token: orgAToken, body: { nameAr: 'قطعة', shortCode: 'BKU' } });
    orgAUnitId = unitRes.body.data._id;

    const create = await api('POST', '/org-backups', { token: orgAToken });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    backupId = create.body.data.id;
    assert.ok(backupId);

    const list = await api('GET', '/org-backups', { token: orgAToken });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].id, backupId);
  });

  await t.test('a fresh request (simulating page refresh) still shows the backup', async () => {
    const list = await api('GET', '/org-backups', { token: orgAToken });
    assert.equal(list.body.data.length, 1);
  });

  await t.test('org B never sees org A\'s backups, and vice versa', async () => {
    const orgBList = await api('GET', '/org-backups', { token: orgBToken });
    assert.equal(orgBList.status, 200);
    assert.deepEqual(orgBList.body.data, [], 'org B must have its own empty, independent backup list');
  });

  await t.test('restoring a backup only replaces this organization\'s own data', async () => {
    // delete the category, then restore — it should come back
    await api('DELETE', `/categories/${orgACategoryId}`, { token: orgAToken });
    const deleted = await api('GET', '/categories', { token: orgAToken });
    assert.equal(deleted.body.data.find((c) => c._id === orgACategoryId), undefined);

    const restore = await api('POST', `/org-backups/${backupId}/restore`, { token: orgAToken });
    assert.equal(restore.status, 200, JSON.stringify(restore.body));

    const restored = await api('GET', '/categories', { token: orgAToken });
    assert.ok(restored.body.data.find((c) => c._id === orgACategoryId), 'the category must be restored from the backup');

    // org B's own data (its default units from registration) must be untouched
    const orgBUnits = await api('GET', '/units', { token: orgBToken });
    assert.ok(orgBUnits.body.data.length > 0, 'org B\'s own data must survive org A\'s restore untouched');
  });

  await t.test('deleting a backup removes it from the list', async () => {
    const del = await api('DELETE', `/org-backups/${backupId}`, { token: orgAToken });
    assert.equal(del.status, 200, JSON.stringify(del.body));
    const list = await api('GET', '/org-backups', { token: orgAToken });
    assert.deepEqual(list.body.data, []);
  });

  await t.test('disabling the backups feature flag returns a controlled 403 FEATURE_DISABLED, not a generic error', async () => {
    const disable = await api('PATCH', `/platform/organizations/${orgAId}/features`, { token: platformToken, body: { backups: false } });
    assert.equal(disable.status, 200, JSON.stringify(disable.body));

    const list = await api('GET', '/org-backups', { token: orgAToken });
    assert.equal(list.status, 403);
    assert.equal(list.body.code, 'FEATURE_DISABLED');

    const create = await api('POST', '/org-backups', { token: orgAToken });
    assert.equal(create.status, 403);
    assert.equal(create.body.code, 'FEATURE_DISABLED');
  });

  await t.test('re-enabling the feature restores normal access', async () => {
    const enable = await api('PATCH', `/platform/organizations/${orgAId}/features`, { token: platformToken, body: { backups: true } });
    assert.equal(enable.status, 200, JSON.stringify(enable.body));

    const list = await api('GET', '/org-backups', { token: orgAToken });
    assert.equal(list.status, 200);
  });

  // ORG_BACKUP_ROOT is real disk, not the disposable per-test Mongo database
  // (see test-lib/helpers.js) — clean up what this run created so repeated
  // test runs don't accumulate empty directories in the actual project tree.
  fs.rmSync(path.join(ORG_BACKUP_ROOT, orgAId), { recursive: true, force: true });

  await stopServer();
});
