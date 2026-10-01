const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_platform_advanced';
const { startServer, stopServer, api } = require('../test-lib/helpers');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const tokenService = require('../services/tokenService');

let orgAToken, orgBToken, platformToken;
let orgAId, orgBId;
let orgAAdminId, orgASecondUserId;
let orgARoleEmployeeId, orgBRoleId;
let orgAWarehouseId, orgBWarehouseId;

test('platform admin — advanced organization management', async (t) => {
  await startServer();

  await t.test('setup: two organizations, a second user in org A, one elevated to platform admin', async () => {
    const resA = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة الإدارة المتقدمة أ',
        admin: { fullName: 'Adv Admin A', username: 'adv_admin_a', email: 'adv_admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'ADVA' },
      },
    });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    orgAToken = resA.body.data.accessToken;
    orgAId = resA.body.data.user.organizationId;
    orgAAdminId = resA.body.data.user._id;

    const resB = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة الإدارة المتقدمة ب',
        admin: { fullName: 'Adv Admin B', username: 'adv_admin_b', email: 'adv_admin_b@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'ADVB' },
      },
    });
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
    orgBToken = resB.body.data.accessToken;
    orgBId = resB.body.data.user.organizationId;

    const orgAWarehouses = await api('GET', '/warehouses', { token: orgAToken });
    orgAWarehouseId = orgAWarehouses.body.data[0]._id;
    const orgBWarehouses = await api('GET', '/warehouses', { token: orgBToken });
    orgBWarehouseId = orgBWarehouses.body.data[0]._id;

    const orgARoles = await api('GET', '/roles', { token: orgAToken });
    orgARoleEmployeeId = orgARoles.body.data.find((r) => r.name === 'employee')._id;
    const orgBRoles = await api('GET', '/roles', { token: orgBToken });
    orgBRoleId = orgBRoles.body.data.find((r) => r.name === 'employee')._id;

    const secondUser = await api('POST', '/users', {
      token: orgAToken,
      body: {
        fullName: 'Second User A', username: 'adv_second_a', email: 'adv_second_a@example.com',
        password: 'Passw0rd123', role: orgARoleEmployeeId, warehouse: orgAWarehouseId,
      },
    });
    assert.equal(secondUser.status, 201, JSON.stringify(secondUser.body));
    orgASecondUserId = secondUser.body.data._id;

    await User.updateOne({ _id: orgAAdminId }, { $set: { isPlatformAdmin: true } });
    const login = await api('POST', '/auth/login', { body: { identifier: 'adv_admin_a', password: 'Passw0rd123' } });
    assert.equal(login.status, 200);
    platformToken = login.body.data.accessToken;
  });

  // (B) Normal org admin gets 403 on every advanced-management endpoint.
  await t.test('B. a normal organization admin is forbidden from every advanced-management endpoint', async () => {
    const checks = [
      ['PATCH', `/platform/organizations/${orgAId}`, { name: 'x' }],
      ['PATCH', `/platform/organizations/${orgAId}/owner`, { newOwnerId: orgASecondUserId }],
      ['GET', `/platform/organizations/${orgAId}/subscription`],
      ['PATCH', `/platform/organizations/${orgAId}/subscription`, { plan: 'TRIAL' }],
      ['GET', `/platform/organizations/${orgAId}/limits`],
      ['PATCH', `/platform/organizations/${orgAId}/limits`, { maxUsers: 5 }],
      ['GET', `/platform/organizations/${orgAId}/features`],
      ['PATCH', `/platform/organizations/${orgAId}/features`, { purchasing: false }],
      ['POST', `/platform/organizations/${orgAId}/revoke-sessions`, {}],
      ['PATCH', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/role`, { role: orgARoleEmployeeId }],
      ['PATCH', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/warehouse`, { warehouse: orgAWarehouseId }],
      ['POST', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/revoke-sessions`, {}],
      ['GET', `/platform/organizations/${orgAId}/notes`],
      ['POST', `/platform/organizations/${orgAId}/notes`, { text: 'x' }],
    ];
    for (const [method, url, body] of checks) {
      const res = await api(method, url, { token: orgBToken, body });
      assert.equal(res.status, 403, `${method} ${url} should 403 for a non-platform-admin, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  // (A) Platform Admin can update org info.
  await t.test('A. platform admin can update organization/company info without touching organizationId', async () => {
    const res = await api('PATCH', `/platform/organizations/${orgAId}`, {
      token: platformToken,
      body: { name: 'شركة الإدارة المتقدمة أ (محدّثة)', phone: '0790000000', email: 'contact@advA.test', address: 'عمّان', taxNumber: 'TX123', country: 'الأردن' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.organization._id, orgAId, 'organizationId must never change');
    assert.equal(res.body.data.organization.name, 'شركة الإدارة المتقدمة أ (محدّثة)');
    assert.equal(res.body.data.company.phone, '0790000000');
    assert.equal(res.body.data.company.country, 'الأردن');

    const detail = await api('GET', `/platform/organizations/${orgAId}`, { token: platformToken });
    assert.equal(detail.body.data.organization.name, 'شركة الإدارة المتقدمة أ (محدّثة)');
    assert.equal(detail.body.data.company.taxNumber, 'TX123');
  });

  // (C) Owner can only be transferred to a user inside the SAME organization.
  await t.test('C. owner transfer is rejected across organizations and succeeds within the same one', async () => {
    const crossOrg = await api('PATCH', `/platform/organizations/${orgAId}/owner`, {
      token: platformToken,
      body: { newOwnerId: (await api('GET', `/platform/organizations/${orgBId}/users`, { token: platformToken })).body.data[0]._id },
    });
    assert.equal(crossOrg.status, 400, JSON.stringify(crossOrg.body));

    const sameOrg = await api('PATCH', `/platform/organizations/${orgAId}/owner`, {
      token: platformToken,
      body: { newOwnerId: orgASecondUserId },
    });
    assert.equal(sameOrg.status, 200, JSON.stringify(sameOrg.body));
    assert.equal(sameOrg.body.data.ownerId, orgASecondUserId);

    // transfer back so later tests' assumptions about "the admin" stay simple
    await api('PATCH', `/platform/organizations/${orgAId}/owner`, { token: platformToken, body: { newOwnerId: orgAAdminId } });
  });

  // (D) Cross-org role/warehouse assignment is rejected.
  await t.test('D. assigning a role or warehouse from a different organization is rejected', async () => {
    const crossRole = await api('PATCH', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/role`, {
      token: platformToken,
      body: { role: orgBRoleId },
    });
    assert.equal(crossRole.status, 400, JSON.stringify(crossRole.body));

    const crossWarehouse = await api('PATCH', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/warehouse`, {
      token: platformToken,
      body: { warehouse: orgBWarehouseId },
    });
    assert.equal(crossWarehouse.status, 400, JSON.stringify(crossWarehouse.body));

    const sameOrgRole = await api('PATCH', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/role`, {
      token: platformToken,
      body: { role: orgARoleEmployeeId },
    });
    assert.equal(sameOrgRole.status, 200, JSON.stringify(sameOrgRole.body));

    const sameOrgWarehouse = await api('PATCH', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/warehouse`, {
      token: platformToken,
      body: { warehouse: orgAWarehouseId },
    });
    assert.equal(sameOrgWarehouse.status, 200, JSON.stringify(sameOrgWarehouse.body));
  });

  // (H) Limits prevent only NEW creation, never delete existing data.
  await t.test('H. a product limit blocks only the next creation, existing products stay intact', async () => {
    const catRes = await api('POST', '/categories', { token: orgAToken, body: { nameAr: 'فئة الحدود' } });
    const unitRes = await api('POST', '/units', { token: orgAToken, body: { nameAr: 'قطعة', shortCode: 'PCL' } });
    const firstProduct = await api('POST', '/products', {
      token: orgAToken,
      body: { nameAr: 'صنف أول', category: catRes.body.data._id, unit: unitRes.body.data._id },
    });
    assert.equal(firstProduct.status, 201, JSON.stringify(firstProduct.body));

    const setLimit = await api('PATCH', `/platform/organizations/${orgAId}/limits`, { token: platformToken, body: { maxProducts: 1 } });
    assert.equal(setLimit.status, 200, JSON.stringify(setLimit.body));
    assert.equal(setLimit.body.data.usage.products, 1);
    assert.equal(setLimit.body.data.limits.maxProducts, 1);

    const blockedProduct = await api('POST', '/products', {
      token: orgAToken,
      body: { nameAr: 'صنف ثانٍ', category: catRes.body.data._id, unit: unitRes.body.data._id },
    });
    assert.equal(blockedProduct.status, 403, JSON.stringify(blockedProduct.body));

    const stillThere = await api('GET', '/products', { token: orgAToken });
    assert.equal(stillThere.body.data.length, 1, 'the existing product must not have been touched, only new creation blocked');

    // raise the limit back so it doesn't affect anything else in this file
    await api('PATCH', `/platform/organizations/${orgAId}/limits`, { token: platformToken, body: { maxProducts: null } });
  });

  // (I) Feature flags enforced backend-side, not just hidden in the frontend.
  await t.test('I. disabling a feature blocks the corresponding backend endpoint, re-enabling restores it', async () => {
    const disable = await api('PATCH', `/platform/organizations/${orgAId}/features`, { token: platformToken, body: { barcode: false } });
    assert.equal(disable.status, 200, JSON.stringify(disable.body));
    assert.equal(disable.body.data.barcode, false);

    const blocked = await api('GET', '/products/barcode/DOES-NOT-EXIST', { token: orgAToken });
    assert.equal(blocked.status, 403, 'a disabled feature must 403 regardless of whether the underlying data exists');

    const reEnable = await api('PATCH', `/platform/organizations/${orgAId}/features`, { token: platformToken, body: { barcode: true } });
    assert.equal(reEnable.status, 200);

    const notFoundInsteadOfForbidden = await api('GET', '/products/barcode/DOES-NOT-EXIST', { token: orgAToken });
    assert.equal(notFoundInsteadOfForbidden.status, 404, 'once re-enabled, the normal 404-not-found behavior returns');
  });

  // (J) Revoke user sessions works.
  await t.test('J. revoking one user\'s sessions revokes only that user\'s refresh tokens', async () => {
    const rawA = await tokenService.issueRefreshToken({ _id: orgASecondUserId });
    const rawAdmin = await tokenService.issueRefreshToken({ _id: orgAAdminId });

    const res = await api('POST', `/platform/organizations/${orgAId}/users/${orgASecondUserId}/revoke-sessions`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const tokenA = await RefreshToken.findOne({ tokenHash: tokenService.hashToken(rawA) });
    const tokenAdmin = await RefreshToken.findOne({ tokenHash: tokenService.hashToken(rawAdmin) });
    assert.equal(tokenA.revoked, true, 'the target user\'s session must be revoked');
    assert.equal(tokenAdmin.revoked, false, 'a different user\'s session must be untouched');
  });

  // (K) Revoke organization sessions works.
  await t.test('K. revoking an organization\'s sessions revokes every user in it except the calling platform admin, and no one outside it', async () => {
    const rawAdmin = await tokenService.issueRefreshToken({ _id: orgAAdminId });
    const rawSecond = await tokenService.issueRefreshToken({ _id: orgASecondUserId });
    const orgBUsers = await api('GET', `/platform/organizations/${orgBId}/users`, { token: platformToken });
    const orgBUserId = orgBUsers.body.data[0]._id;
    const rawOrgB = await tokenService.issueRefreshToken({ _id: orgBUserId });

    const res = await api('POST', `/platform/organizations/${orgAId}/revoke-sessions`, { token: platformToken, body: { reason: 'صيانة أمنية' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // orgAAdminId is both a member of org A AND the platform admin making this
    // call (platformToken) — excluded so the operator doesn't lock themselves
    // out of the Platform Admin app they're using right now (see
    // controllers/platform/organizationDetail.controller.js).
    assert.equal(res.body.data.usersAffected, 1);
    assert.equal(res.body.data.selfExcluded, true);

    const [tAdmin, tSecond, tOrgB] = await Promise.all([
      RefreshToken.findOne({ tokenHash: tokenService.hashToken(rawAdmin) }),
      RefreshToken.findOne({ tokenHash: tokenService.hashToken(rawSecond) }),
      RefreshToken.findOne({ tokenHash: tokenService.hashToken(rawOrgB) }),
    ]);
    assert.equal(tAdmin.revoked, false, 'the calling platform admin\'s own session must be excluded from a tenant-wide revoke');
    assert.equal(tSecond.revoked, true);
    assert.equal(tOrgB.revoked, false, 'org B\'s sessions must never be touched by org A\'s revoke-all');
  });

  // (L) Internal notes never leak through tenant APIs.
  await t.test('L. internal platform notes never leak through any tenant-facing API', async () => {
    const create = await api('POST', `/platform/organizations/${orgAId}/notes`, {
      token: platformToken,
      body: { text: 'ملاحظة داخلية سرية للدعم الفني — لا يجب أن يراها أحد في المؤسسة', category: 'SUPPORT' },
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));

    const list = await api('GET', `/platform/organizations/${orgAId}/notes`, { token: platformToken });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].category, 'SUPPORT');

    // No tenant-reachable endpoint could contain it, but check the ones a
    // tenant admin actually calls, as a concrete regression guard.
    const settings = await api('GET', '/settings', { token: orgAToken });
    const me = await api('GET', '/auth/me', { token: orgAToken });
    assert.ok(!JSON.stringify(settings.body).includes('ملاحظة داخلية سرية'));
    assert.ok(!JSON.stringify(me.body).includes('ملاحظة داخلية سرية'));

    // Static guarantee: no tenant-facing controller even references the model.
    const controllersDir = path.join(__dirname, '..', 'controllers');
    const tenantControllerFiles = fs.readdirSync(controllersDir).filter((f) => f.endsWith('.js'));
    for (const file of tenantControllerFiles) {
      const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');
      assert.ok(!content.includes('PlatformOrganizationNote'), `tenant controller ${file} must never reference PlatformOrganizationNote`);
    }
  });

  // (E/F/G) Suspend with a required reason: data preserved, tenant login
  // blocked, platform admin can still inspect everything.
  await t.test('E/F/G. suspending requires a reason, preserves data, blocks tenant login, platform admin still inspects it', async () => {
    const missingReason = await api('PATCH', `/platform/organizations/${orgAId}/status`, { token: platformToken, body: { status: 'suspended' } });
    assert.equal(missingReason.status, 400, 'a reason must be required to suspend');

    const suspend = await api('PATCH', `/platform/organizations/${orgAId}/status`, {
      token: platformToken,
      body: { status: 'suspended', reason: 'فاتورة غير مسددة' },
    });
    assert.equal(suspend.status, 200, JSON.stringify(suspend.body));
    assert.equal(suspend.body.data.suspensionReason, 'فاتورة غير مسددة');

    const loginBlocked = await api('POST', '/auth/login', { body: { identifier: 'adv_admin_a', password: 'Passw0rd123' } });
    assert.equal(loginBlocked.status, 403);

    const productsViaPlatform = await api('GET', `/platform/organizations/${orgAId}/products`, { token: platformToken });
    assert.equal(productsViaPlatform.status, 200, 'platform admin must still be able to inspect a suspended organization');
    assert.equal(productsViaPlatform.body.data.length, 1);

    const reEnable = await api('PATCH', `/platform/organizations/${orgAId}/status`, { token: platformToken, body: { status: 'active' } });
    assert.equal(reEnable.status, 200);
    assert.equal(reEnable.body.data.suspensionReason, null);

    const loginRestored = await api('POST', '/auth/login', { body: { identifier: 'adv_admin_a', password: 'Passw0rd123' } });
    assert.equal(loginRestored.status, 200);
  });

  // (M) Sensitive fields never leak from any of the new endpoints.
  await t.test('M. no password hash, refresh token, or JWT secret leaks from any advanced-management endpoint', async () => {
    const endpoints = [
      ['GET', `/platform/organizations/${orgAId}`],
      ['GET', `/platform/organizations/${orgAId}/subscription`],
      ['GET', `/platform/organizations/${orgAId}/limits`],
      ['GET', `/platform/organizations/${orgAId}/features`],
      ['GET', `/platform/organizations/${orgAId}/notes`],
      ['GET', `/platform/organizations/${orgAId}/users`],
    ];
    for (const [method, url] of endpoints) {
      const res = await api(method, url, { token: platformToken });
      assert.equal(res.status, 200, `${url} should succeed, got ${res.status}`);
      const raw = JSON.stringify(res.body);
      assert.ok(!raw.includes('passwordHash'), `${url} must never include passwordHash`);
      assert.ok(!raw.toLowerCase().includes('tokenhash'), `${url} must never include a raw token hash`);
      assert.ok(!raw.toLowerCase().includes('refreshtoken'), `${url} must never include a refresh token`);
      assert.ok(!raw.includes('JWT_SECRET') && !raw.includes('jwtSecret'), `${url} must never include JWT secrets`);
    }
  });

  await stopServer();
});
