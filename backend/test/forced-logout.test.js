const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_forced_logout';
const { startServer, stopServer, api, cookieValue } = require('../test-lib/helpers');
const User = require('../models/User');

let orgAId, orgBId;
let orgAAdminId, platformToken;
let targetUserId;

test('forced logout — authVersion invalidates already-issued access tokens', async (t) => {
  await startServer();

  await t.test('setup: org A (with a second user) and org B, org A admin elevated to platform admin', async () => {
    const resA = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة تسجيل الخروج القسري',
        admin: { fullName: 'FL Admin A', username: 'fl_admin_a', email: 'fl_admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'FLA' },
      },
    });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    orgAId = resA.body.data.user.organizationId;
    orgAAdminId = resA.body.data.user._id;
    const orgAToken = resA.body.data.accessToken;

    const resB = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة أخرى غير متأثرة',
        admin: { fullName: 'FL Admin B', username: 'fl_admin_b', email: 'fl_admin_b@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'FLB' },
      },
    });
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
    orgBId = resB.body.data.user.organizationId;

    const orgAWarehouses = await api('GET', '/warehouses', { token: orgAToken });
    const orgAWarehouseId = orgAWarehouses.body.data[0]._id;
    const orgARoles = await api('GET', '/roles', { token: orgAToken });
    const orgAEmployeeRoleId = orgARoles.body.data.find((r) => r.name === 'employee')._id;

    const secondUser = await api('POST', '/users', {
      token: orgAToken,
      body: {
        fullName: 'FL Target User', username: 'fl_target_user', email: 'fl_target_user@example.com',
        password: 'Passw0rd123', role: orgAEmployeeRoleId, warehouse: orgAWarehouseId,
      },
    });
    assert.equal(secondUser.status, 201, JSON.stringify(secondUser.body));
    targetUserId = secondUser.body.data._id;

    await User.updateOne({ _id: orgAAdminId }, { $set: { isPlatformAdmin: true } });
    const login = await api('POST', '/auth/login', { body: { identifier: 'fl_admin_a', password: 'Passw0rd123' } });
    assert.equal(login.status, 200);
    platformToken = login.body.data.accessToken;
  });

  let oldAccessToken, refreshCookie;

  await t.test('the target user logs in and the token works normally', async () => {
    const login = await api('POST', '/auth/login', { body: { identifier: 'fl_target_user', password: 'Passw0rd123' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    oldAccessToken = login.body.data.accessToken;
    refreshCookie = cookieValue(login.setCookie);
    assert.ok(refreshCookie, 'login must set a refresh-token cookie');

    const me = await api('GET', '/auth/me', { token: oldAccessToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.username, 'fl_target_user');
  });

  await t.test('platform admin revokes the target user\'s sessions', async () => {
    const res = await api('POST', `/platform/organizations/${orgAId}/users/${targetUserId}/revoke-sessions`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  await t.test('the old, still-unexpired access token is now rejected with 401 SESSION_REVOKED', async () => {
    const me = await api('GET', '/auth/me', { token: oldAccessToken });
    assert.equal(me.status, 401, JSON.stringify(me.body));
    assert.equal(me.body.code, 'SESSION_REVOKED');
  });

  await t.test('the old refresh token can no longer renew the session', async () => {
    const res = await api('POST', '/auth/refresh', { cookie: refreshCookie });
    assert.equal(res.status, 401, JSON.stringify(res.body));
  });

  let newAccessToken;

  await t.test('the user can log in again with the same credentials and gets a fresh, valid token', async () => {
    const login = await api('POST', '/auth/login', { body: { identifier: 'fl_target_user', password: 'Passw0rd123' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    newAccessToken = login.body.data.accessToken;
    assert.ok(newAccessToken && newAccessToken !== oldAccessToken);

    const me = await api('GET', '/auth/me', { token: newAccessToken });
    assert.equal(me.status, 200, JSON.stringify(me.body));
    assert.equal(me.body.data.user.username, 'fl_target_user');
  });

  await t.test('org-wide revoke for org A never invalidates org B\'s tokens', async () => {
    const orgBLogin = await api('POST', '/auth/login', { body: { identifier: 'fl_admin_b', password: 'Passw0rd123' } });
    const orgBToken = orgBLogin.body.data.accessToken;

    const revoke = await api('POST', `/platform/organizations/${orgAId}/revoke-sessions`, { token: platformToken });
    assert.equal(revoke.status, 200, JSON.stringify(revoke.body));

    const orgBMe = await api('GET', '/auth/me', { token: orgBToken });
    assert.equal(orgBMe.status, 200, 'org B\'s access token must be unaffected by org A\'s revoke-all');

    // the re-logged-in org A target user, on the other hand, IS affected —
    // it's a real member of org A, unlike the platform-admin caller excluded
    // above in platform-organization-advanced.test.js.
    const orgAMe = await api('GET', '/auth/me', { token: newAccessToken });
    assert.equal(orgAMe.status, 401, JSON.stringify(orgAMe.body));
    assert.equal(orgAMe.body.code, 'SESSION_REVOKED');
  });

  await stopServer();
});
