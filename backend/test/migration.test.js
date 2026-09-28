const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_migration';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const { run: runMigration } = require('../migrations/001_multi_tenant_backfill');

test('multi-tenant backfill migration', async (t) => {
  await connectDB();
  const db = mongoose.connection.db;
  await db.dropDatabase();

  // Simulate a pre-migration, single-tenant database: a super-admin user,
  // a role, a warehouse and a product — none of them have organizationId,
  // exactly like real data captured before this migration existed.
  const roleId = new mongoose.Types.ObjectId();
  await db.collection('roles').insertOne({ _id: roleId, name: 'super-admin', nameAr: 'مدير عام', permissions: ['dashboard.view'], isSystem: true });

  const userId = new mongoose.Types.ObjectId();
  await db.collection('users').insertOne({
    _id: userId,
    fullName: 'Existing Admin',
    username: 'existingadmin',
    email: 'existing@example.com',
    passwordHash: await bcrypt.hash('OldPassw0rd!', 12),
    role: roleId,
    status: 'active',
  });

  await db.collection('settings').insertOne({ company: { name: 'شركتي القديمة' }, setupCompleted: true });
  await db.collection('products').insertOne({ sku: 'P-000001', nameAr: 'صنف قديم', category: new mongoose.Types.ObjectId(), unit: new mongoose.Types.ObjectId() });

  await t.test('backfills organizationId onto every pre-existing document', async () => {
    await runMigration(db);

    const org = await db.collection('organizations').findOne({ isMigrationDefault: true });
    assert.ok(org, 'a default organization must be created');
    assert.equal(org.name, 'شركتي القديمة', 'default org should reuse the existing company name');

    const user = await db.collection('users').findOne({ _id: userId });
    assert.ok(user.organizationId, 'existing user must get organizationId');
    assert.equal(String(user.organizationId), String(org._id));
    assert.equal(user.isPlatformAdmin, true, 'pre-existing user must keep whole-system backup/restore capability');

    const product = await db.collection('products').findOne({ sku: 'P-000001' });
    assert.ok(product.organizationId, 'existing product must get organizationId');

    const role = await db.collection('roles').findOne({ _id: roleId });
    assert.ok(role.organizationId, 'existing role must get organizationId');

    const settings = await db.collection('settings').findOne({});
    assert.ok(settings.organizationId, 'existing settings singleton must get organizationId');
  });

  await t.test('is idempotent — running twice does not duplicate the default organization or touch already-migrated docs', async () => {
    const before = await db.collection('organizations').countDocuments({ isMigrationDefault: true });
    await runMigration(db);
    const after = await db.collection('organizations').countDocuments({ isMigrationDefault: true });
    assert.equal(before, after, 'must not create a second default organization on re-run');

    const user = await db.collection('users').findOne({ _id: userId });
    assert.equal(user.isPlatformAdmin, true);
  });

  await t.test('new per-organization unique indexes replace the old global ones', async () => {
    const productIndexes = await db.collection('products').indexes();
    const names = productIndexes.map((i) => i.name);
    assert.ok(!names.includes('sku_1'), 'old global sku unique index must be dropped');
    const compound = productIndexes.find((i) => i.key.organizationId === 1 && i.key.sku === 1);
    assert.ok(compound?.unique, 'new compound {organizationId, sku} unique index must exist');
  });

  await t.test('the pre-existing (pre-migration) user can still log in end-to-end, with its prior capability intact', async () => {
    const http = require('http');
    const app = require('../app');
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api`;

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'existingadmin', password: 'OldPassw0rd!' }),
    });
    const loginBody = await loginRes.json();
    assert.equal(loginRes.status, 200, JSON.stringify(loginBody));
    assert.equal(loginBody.data.user.username, 'existingadmin');
    assert.equal(loginBody.data.user.role.name, 'super-admin');

    // Whole-database backup listing is gated on isPlatformAdmin — the exact
    // capability this account already had before organizations existed.
    const backupsRes = await fetch(`${base}/backups`, {
      headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    assert.equal(backupsRes.status, 200, 'pre-existing user must keep whole-database backup access');

    await new Promise((resolve) => server.close(resolve));
  });

  await mongoose.disconnect();
});
