const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_subscription';
const { startServer, stopServer, api } = require('../test-lib/helpers');
const User = require('../models/User');

// Two separate organizations: org A is the ordinary target whose
// subscription gets expired/restored, org B's own admin is the one elevated
// to Platform Admin — kept distinct so "the platform admin manages org A's
// subscription" can't be confused with "the platform admin's own org
// happens to be the one under test" (the self-lockout scenario gets its own
// dedicated check instead, further down).
let orgAToken, orgAId;
let platformToken, orgBId;

function isoDate(daysFromNow) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test('subscription expiration enforcement', async (t) => {
  await startServer();

  await t.test('setup: org A (target) and org B (platform admin\'s own org)', async () => {
    const resA = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة فحص الاشتراك',
        admin: { fullName: 'Sub Admin A', username: 'sub_admin_a', email: 'sub_admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'SUBA' },
      },
    });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    orgAToken = resA.body.data.accessToken;
    orgAId = resA.body.data.user.organizationId;

    const resB = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة مدير المنصة',
        admin: { fullName: 'Platform Admin', username: 'sub_platform_admin', email: 'sub_platform_admin@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'SUBB' },
      },
    });
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
    orgBId = resB.body.data.user.organizationId;

    await User.updateOne({ username: 'sub_platform_admin' }, { $set: { isPlatformAdmin: true } });
    const login = await api('POST', '/auth/login', { body: { identifier: 'sub_platform_admin', password: 'Passw0rd123' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    platformToken = login.body.data.accessToken;
  });

  await t.test('a FREE org with no dates set has unrestricted access', async () => {
    const me = await api('GET', '/auth/me', { token: orgAToken });
    assert.equal(me.status, 200, JSON.stringify(me.body));
  });

  await t.test('setting plan to MONTHLY with an end date yesterday blocks the organization on the very next request', async () => {
    const update = await api('PATCH', `/platform/organizations/${orgAId}/subscription`, {
      token: platformToken,
      body: { plan: 'MONTHLY', subscriptionStatus: 'ACTIVE', subscriptionEndsAt: isoDate(-1) },
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    assert.equal(update.body.data.effectiveStatus, 'EXPIRED', 'the stored subscriptionStatus is still ACTIVE, but effectiveStatus must reflect the real, computed state');

    // the EXISTING, already-issued access token (orgAToken) — not a freshly
    // logged-in one — must now be rejected: this is the exact gap forced
    // logout (SESSION_REVOKED) was built for in the previous fix, applied
    // here to subscription expiration.
    const me = await api('GET', '/auth/me', { token: orgAToken });
    assert.equal(me.status, 403, JSON.stringify(me.body));
    assert.equal(me.body.code, 'SUBSCRIPTION_EXPIRED');
  });

  await t.test('a fresh login also rejects an expired organization, not just the pre-existing token', async () => {
    const login = await api('POST', '/auth/login', { body: { identifier: 'sub_admin_a', password: 'Passw0rd123' } });
    assert.equal(login.status, 403, JSON.stringify(login.body));
    assert.equal(login.body.code, 'SUBSCRIPTION_EXPIRED');
  });

  await t.test('exact stored date round-trips correctly (no silent date-shifting)', async () => {
    const get = await api('GET', `/platform/organizations/${orgAId}/subscription`, { token: platformToken });
    assert.equal(get.status, 200);
    assert.equal(get.body.data.subscriptionEndsAt.slice(0, 10), isoDate(-1));
  });

  await t.test('the platform admin\'s own org (B) is never affected by org A\'s expiration', async () => {
    const me = await api('GET', '/auth/me', { token: platformToken });
    assert.equal(me.status, 200, JSON.stringify(me.body));
  });

  await t.test('setting the end date to the future immediately restores access, no re-login needed', async () => {
    const update = await api('PATCH', `/platform/organizations/${orgAId}/subscription`, {
      token: platformToken,
      body: { subscriptionEndsAt: isoDate(30) },
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    assert.equal(update.body.data.effectiveStatus, 'ACTIVE');

    // same pre-existing orgAToken from before the fix — access is restored
    // without needing a fresh token, since this was never a token problem.
    const me = await api('GET', '/auth/me', { token: orgAToken });
    assert.equal(me.status, 200, JSON.stringify(me.body));
  });

  await t.test('switching back to FREE ignores any stale end date, even one in the past', async () => {
    const update = await api('PATCH', `/platform/organizations/${orgAId}/subscription`, {
      token: platformToken,
      body: { plan: 'FREE', subscriptionEndsAt: isoDate(-100) },
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    assert.equal(update.body.data.effectiveStatus, 'ACTIVE', 'FREE must never be treated as expired, regardless of subscriptionEndsAt');

    const me = await api('GET', '/auth/me', { token: orgAToken });
    assert.equal(me.status, 200);
  });

  await t.test('an explicit SUSPENDED subscriptionStatus blocks regardless of plan or dates', async () => {
    const update = await api('PATCH', `/platform/organizations/${orgAId}/subscription`, {
      token: platformToken,
      body: { subscriptionStatus: 'SUSPENDED' },
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    assert.equal(update.body.data.effectiveStatus, 'SUSPENDED');

    const me = await api('GET', '/auth/me', { token: orgAToken });
    assert.equal(me.status, 403);
    assert.equal(me.body.code, 'SUBSCRIPTION_SUSPENDED');

    // restore for cleanliness
    await api('PATCH', `/platform/organizations/${orgAId}/subscription`, { token: platformToken, body: { subscriptionStatus: 'ACTIVE', plan: 'FREE' } });
  });

  await t.test('a Platform Admin is exempt even when their OWN organization\'s subscription is expired/suspended — otherwise they\'d be locked out of the panel they\'d use to fix it', async () => {
    const expire = await api('PATCH', `/platform/organizations/${orgBId}/subscription`, {
      token: platformToken,
      body: { plan: 'MONTHLY', subscriptionStatus: 'SUSPENDED', subscriptionEndsAt: isoDate(-1) },
    });
    assert.equal(expire.status, 200, JSON.stringify(expire.body));
    assert.equal(expire.body.data.effectiveStatus, 'SUSPENDED');

    // same token, same now-"suspended" organization — must still work.
    const me = await api('GET', '/auth/me', { token: platformToken });
    assert.equal(me.status, 200, JSON.stringify(me.body));

    // a fresh login as this platform admin must also still succeed.
    const login = await api('POST', '/auth/login', { body: { identifier: 'sub_platform_admin', password: 'Passw0rd123' } });
    assert.equal(login.status, 200, JSON.stringify(login.body));

    // they must still be able to use the platform panel itself.
    const list = await api('GET', '/platform/organizations', { token: platformToken });
    assert.equal(list.status, 200);
  });

  await stopServer();
});
