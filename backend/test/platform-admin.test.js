const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_platform';
const { startServer, stopServer, api } = require('../test-lib/helpers');
const User = require('../models/User');

let orgAToken, orgAAdminId, orgAId;
let orgBToken, orgBId;
let platformToken;

test('platform admin control panel', async (t) => {
  await startServer();

  await t.test('setup: register two organizations', async () => {
    const resA = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة المنصة أ',
        admin: { fullName: 'Admin A', username: 'plat_admin_a', email: 'plat_admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'Main A', code: 'PMAINA' },
      },
    });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    orgAToken = resA.body.data.accessToken;
    orgAAdminId = resA.body.data.user._id;
    orgAId = resA.body.data.user.organizationId;

    const resB = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة المنصة ب',
        admin: { fullName: 'Admin B', username: 'plat_admin_b', email: 'plat_admin_b@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'Main B', code: 'PMAINB' },
      },
    });
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
    orgBToken = resB.body.data.accessToken;
    orgBId = resB.body.data.user.organizationId;
  });

  // (A) Normal organization admin -> /api/platform/* => 403
  await t.test('A. an ordinary organization admin is forbidden from every /api/platform/* route', async () => {
    const endpoints = [
      ['GET', '/platform/dashboard'],
      ['GET', '/platform/organizations'],
      ['GET', '/platform/users'],
      ['GET', '/platform/audit'],
      ['GET', '/platform/security'],
      ['GET', '/platform/invitations'],
    ];
    for (const [method, path] of endpoints) {
      const res = await api(method, path, { token: orgAToken });
      assert.equal(res.status, 403, `${method} ${path} should 403 for a non-platform-admin, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await t.test('setup: elevate org A\'s admin to isPlatformAdmin (no API grants this, by design)', async () => {
    await User.updateOne({ _id: orgAAdminId }, { $set: { isPlatformAdmin: true } });
    // Re-login to get a session reflecting the same account (isPlatformAdmin
    // is read fresh from the DB on every request in middleware/auth.js, not
    // cached in the JWT, so the existing token already works — but logging
    // in again mirrors how a real admin would pick this up).
    const res = await api('POST', '/auth/login', { body: { identifier: 'plat_admin_a', password: 'Passw0rd123' } });
    assert.equal(res.status, 200);
    platformToken = res.body.data.accessToken;
  });

  // (B) Platform admin -> dashboard works
  await t.test('B. platform admin can load the dashboard, with sane cross-tenant totals', async () => {
    const res = await api('GET', '/platform/dashboard', { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { totals } = res.body.data;
    assert.ok(totals.organizations >= 2, 'must count both organizations');
    assert.ok(totals.users >= 2, 'must count users across every organization');
    assert.ok('warehouses' in totals && 'products' in totals && 'openInvitations' in totals);
    assert.ok(Array.isArray(res.body.data.recentOrganizations));
    assert.ok(Array.isArray(res.body.data.recentUsers));
    assert.ok(Array.isArray(res.body.data.recentActivity));
    assert.ok('failedLoginSummary' in res.body.data);
  });

  // (C) Platform admin can list all organizations
  await t.test('C. platform admin can list organizations from every tenant, with summaries', async () => {
    const res = await api('GET', '/platform/organizations', { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const names = res.body.data.map((o) => o.name);
    assert.ok(names.includes('شركة المنصة أ'));
    assert.ok(names.includes('شركة المنصة ب'));
    const orgA = res.body.data.find((o) => o.name === 'شركة المنصة أ');
    assert.equal(orgA.usersCount, 1);
    assert.equal(orgA.warehousesCount, 1);
    assert.ok(orgA.owner, 'owner should be resolved');

    const detail = await api('GET', `/platform/organizations/${orgAId}`, { token: platformToken });
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.organization.name, 'شركة المنصة أ');
    assert.ok(detail.body.data.owner, 'owner should be resolved on the lean detail response too');
  });

  // (D) Platform admin can list users across organizations
  await t.test('D. platform admin can list users across every organization, and filter by organization', async () => {
    const all = await api('GET', '/platform/users', { token: platformToken });
    assert.equal(all.status, 200, JSON.stringify(all.body));
    const usernames = all.body.data.map((u) => u.username);
    assert.ok(usernames.includes('plat_admin_a'));
    assert.ok(usernames.includes('plat_admin_b'));

    const scoped = await api('GET', `/platform/users?organizationId=${orgBId}`, { token: platformToken });
    assert.equal(scoped.status, 200);
    assert.ok(scoped.body.data.every((u) => u.organizationId?._id === orgBId || u.organizationId === orgBId));

    const detail = await api('GET', `/platform/users/${orgAAdminId}`, { token: platformToken });
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.user.username, 'plat_admin_a');
    assert.ok(Array.isArray(detail.body.data.sessions));
  });

  // (F, partial) Audit/Security/Invitations succeed for a real platform admin
  // (the 403-for-non-admin case is already covered by test A above; this is
  // the matching happy path — the standalone platform-admin frontend's pages
  // for these three sections call exactly these endpoints).
  await t.test('F. audit, security, and invitations endpoints work for a platform admin', async () => {
    const audit = await api('GET', '/platform/audit', { token: platformToken });
    assert.equal(audit.status, 200, JSON.stringify(audit.body));
    assert.ok(Array.isArray(audit.body.data));
    assert.ok(Array.isArray(audit.body.meta.actions), 'action list for the filter dropdown');

    const security = await api('GET', '/platform/security', { token: platformToken });
    assert.equal(security.status, 200, JSON.stringify(security.body));
    assert.ok('failedLoginSummary' in security.body.data);
    assert.ok('disabledUsers' in security.body.data);
    assert.ok('suspiciousRepeatedFailures' in security.body.data);
    assert.ok('recentPlatformAdminActions' in security.body.data);

    const invitations = await api('GET', '/platform/invitations', { token: platformToken });
    assert.equal(invitations.status, 200, JSON.stringify(invitations.body));
    assert.ok(Array.isArray(invitations.body.data));
  });

  // (E) Tenant APIs remain isolated after this work
  await t.test('E. ordinary tenant APIs are still isolated per-organization (unaffected by the platform panel)', async () => {
    const productCreate = await api('POST', '/categories', { token: orgAToken, body: { nameAr: 'فئة منصة' } });
    assert.equal(productCreate.status, 201, JSON.stringify(productCreate.body));

    const orgBCategories = await api('GET', '/categories', { token: orgBToken });
    assert.equal(orgBCategories.status, 200);
    assert.equal(orgBCategories.body.data.length, 0, 'org B must not see org A\'s category');
  });

  // (F) Disabled organization behavior remains safe
  await t.test('F. disabling an organization blocks its users\' login; re-enabling restores it; no data is touched', async () => {
    const disable = await api('PATCH', `/platform/organizations/${orgBId}/status`, {
      token: platformToken,
      body: { status: 'suspended', reason: 'اختبار' },
    });
    assert.equal(disable.status, 200, JSON.stringify(disable.body));

    const loginBlocked = await api('POST', '/auth/login', { body: { identifier: 'plat_admin_b', password: 'Passw0rd123' } });
    assert.equal(loginBlocked.status, 403, 'a suspended organization\'s users must not be able to log in');

    // The organization's own data must still exist untouched — suspension
    // is a login gate, never a data-deleting action.
    const stillThere = await api('GET', `/platform/organizations/${orgBId}`, { token: platformToken });
    assert.equal(stillThere.status, 200);
    const usersStillThere = await api('GET', `/platform/organizations/${orgBId}/users`, { token: platformToken });
    assert.equal(usersStillThere.body.data.length, 1);

    const reEnable = await api('PATCH', `/platform/organizations/${orgBId}/status`, {
      token: platformToken,
      body: { status: 'active' },
    });
    assert.equal(reEnable.status, 200);

    const loginRestored = await api('POST', '/auth/login', { body: { identifier: 'plat_admin_b', password: 'Passw0rd123' } });
    assert.equal(loginRestored.status, 200, 'login must work again once the organization is re-enabled');
  });

  // (G) No sensitive password/token fields leak from APIs
  await t.test('G. no password hash, refresh token, or JWT secret ever appears in a platform API response', async () => {
    const endpointsToCheck = [
      ['GET', '/platform/dashboard'],
      ['GET', '/platform/organizations'],
      [`GET`, `/platform/organizations/${orgAId}`],
      ['GET', '/platform/users'],
      ['GET', `/platform/users/${orgAAdminId}`],
      ['GET', '/platform/security'],
      ['GET', '/platform/invitations'],
    ];
    for (const [method, path] of endpointsToCheck) {
      const res = await api(method, path, { token: platformToken });
      assert.equal(res.status, 200, `${path} should succeed for a platform admin, got ${res.status}: ${JSON.stringify(res.body)}`);
      const raw = JSON.stringify(res.body);
      assert.ok(!raw.includes('passwordHash'), `${path} must never include passwordHash`);
      assert.ok(!raw.toLowerCase().includes('tokenhash'), `${path} must never include a raw token hash`);
      assert.ok(!raw.includes('JWT_SECRET') && !raw.includes('jwtSecret'), `${path} must never include JWT secrets`);
    }

    // Force-password-reset returns a *newly generated* password once (by
    // design, same as the existing org-admin reset-password feature) — it
    // must never be able to return or derive the user's actual prior
    // password (which was never recoverable in the first place — only its
    // bcrypt hash is stored).
    const reset = await api('POST', `/platform/users/${orgAAdminId}/reset-password`, { token: platformToken });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.ok(reset.body.data.temporaryPassword, 'must return the newly generated password exactly once');
    assert.ok(!JSON.stringify(reset.body).includes('passwordHash'));
  });

  await t.test('platform routes require authentication, not just the platform-admin flag', async () => {
    const res = await api('GET', '/platform/dashboard');
    assert.equal(res.status, 401);
  });

  await stopServer();
});
