const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_flows';
const { startServer, stopServer, api } = require('../test-lib/helpers');

let orgAToken, orgAAdminId;
let orgBToken;
let orgAProductId, orgBProductId;

test('multi-tenant auth/registration flows', async (t) => {
  await startServer();

  await t.test('registers a brand new company (replaces the old setup wizard)', async () => {
    const res = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة أ',
        admin: { fullName: 'Admin A', username: 'admin_a', email: 'admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'Main A', code: 'MAINA' },
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.data.accessToken, 'registration should auto-login and return a token');
    assert.equal(res.body.data.user.role.name, 'admin', 'organization owner must get the admin role, not super-admin');
    orgAToken = res.body.data.accessToken;
    orgAAdminId = res.body.data.user._id;
  });

  await t.test('rejects registering with a username/email already taken', async () => {
    const res = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة أخرى',
        admin: { fullName: 'Dup', username: 'admin_a', email: 'other@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'W', code: 'W1' },
      },
    });
    assert.equal(res.status, 409);
  });

  await t.test('registers a second, fully independent company', async () => {
    const res = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة ب',
        admin: { fullName: 'Admin B', username: 'admin_b', email: 'admin_b@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'Main B', code: 'MAINB' },
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    orgBToken = res.body.data.accessToken;
  });

  await t.test('public settings endpoint works with no tenant context at all (login-page branding)', async () => {
    const res = await api('GET', '/settings/public');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.company.name, '', 'signed out, there is no single organization to brand the page with');
  });

  await t.test('public settings endpoint returns the caller\'s own organization when authenticated', async () => {
    const res = await api('GET', '/settings/public', { token: orgAToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.company.name, 'شركة أ');
  });

  await t.test('an existing user can log in with identifier/password', async () => {
    const res = await api('POST', '/auth/login', { body: { identifier: 'admin_a', password: 'Passw0rd123' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.data.accessToken);
  });

  await t.test('rejects the wrong password', async () => {
    const res = await api('POST', '/auth/login', { body: { identifier: 'admin_a', password: 'wrong-password' } });
    assert.equal(res.status, 401);
  });

  await t.test('two companies can reuse the same warehouse code independently (per-org uniqueness)', async () => {
    // Both used different codes above (MAINA/MAINB); prove the *category*
    // code namespace is genuinely per-organization by creating the same
    // code in both organizations.
    const resA = await api('POST', '/categories', { token: orgAToken, body: { nameAr: 'فئة', code: 'CAT1' } });
    const resB = await api('POST', '/categories', { token: orgBToken, body: { nameAr: 'فئة', code: 'CAT1' } });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
  });

  await t.test('org A can create a product', async () => {
    const catRes = await api('GET', '/categories', { token: orgAToken });
    const unitRes = await api('GET', '/units', { token: orgAToken });
    // registerCompany seeds DEFAULT_UNITS automatically when none are supplied
    const unitId = unitRes.body.data[0]._id;
    const catId = catRes.body.data[0]._id;

    const res = await api('POST', '/products', {
      token: orgAToken,
      body: { nameAr: 'صنف أ', category: catId, unit: unitId },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    orgAProductId = res.body.data._id;
  });

  await t.test('org B cannot see org A\'s product in its list', async () => {
    const res = await api('GET', '/products', { token: orgBToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0, 'org B must not see any product created by org A');
  });

  await t.test('org B cannot fetch org A\'s product by id (cross-tenant isolation)', async () => {
    const res = await api('GET', `/products/${orgAProductId}`, { token: orgBToken });
    assert.equal(res.status, 404, 'must 404, not leak org A\'s product to org B');
  });

  await t.test('org A can fetch its own product by id', async () => {
    const res = await api('GET', `/products/${orgAProductId}`, { token: orgAToken });
    assert.equal(res.status, 200);
  });

  await t.test('a client-supplied organizationId in the request body is ignored, never trusted', async () => {
    const catRes = await api('GET', '/categories', { token: orgAToken });
    const unitRes = await api('GET', '/units', { token: orgAToken });
    const res = await api('POST', '/products', {
      token: orgAToken,
      body: {
        nameAr: 'محاولة تلاعب',
        category: catRes.body.data[0]._id,
        unit: unitRes.body.data[0]._id,
        organizationId: '000000000000000000000000', // forged
      },
    });
    assert.equal(res.status, 201);
    // It must belong to org A regardless of the forged field — verified by
    // org A being able to see it in its own list right after.
    const list = await api('GET', '/products', { token: orgAToken });
    assert.ok(list.body.data.some((p) => p._id === res.body.data._id));
  });

  await t.test('admin role has full permissions (bug fix regression check)', async () => {
    const res = await api('GET', '/roles', { token: orgAToken });
    assert.equal(res.status, 200);
    const adminRole = res.body.data.find((r) => r.name === 'admin');
    assert.ok(adminRole, 'admin role must exist for the organization');
    assert.ok(adminRole.permissions.includes('settings.manage'));
    assert.ok(adminRole.permissions.includes('roles.manage'));
    assert.ok(adminRole.permissions.includes('invitations.manage'));
  });

  await t.test('new organizations never get a super-admin role (no name collision surface)', async () => {
    const res = await api('GET', '/roles', { token: orgAToken });
    assert.ok(!res.body.data.some((r) => r.name === 'super-admin'));
  });

  let invitationCode;
  await t.test('org A admin creates an invitation for a new employee', async () => {
    const rolesRes = await api('GET', '/roles', { token: orgAToken });
    const employeeRole = rolesRes.body.data.find((r) => r.name === 'employee');

    const res = await api('POST', '/invitations', { token: orgAToken, body: { role: employeeRole._id } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    invitationCode = res.body.data.code;
  });

  await t.test('anyone can preview a valid invitation before joining', async () => {
    const res = await api('GET', `/auth/invitations/${invitationCode}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.organizationName, 'شركة أ');
  });

  let newHireToken;
  await t.test('a new user joins org A via the invitation code', async () => {
    const res = await api('POST', '/auth/join', {
      body: {
        code: invitationCode,
        fullName: 'Employee One',
        username: 'employee_one',
        email: 'employee_one@example.com',
        password: 'Passw0rd123',
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.user.role.name, 'employee');
    newHireToken = res.body.data.accessToken;
  });

  await t.test('the invitation cannot be reused after being consumed', async () => {
    const res = await api('POST', '/auth/join', {
      body: {
        code: invitationCode,
        fullName: 'Employee Two',
        username: 'employee_two',
        email: 'employee_two@example.com',
        password: 'Passw0rd123',
      },
    });
    assert.equal(res.status, 404);
  });

  await t.test('the new hire lands in org A and can see org A\'s product', async () => {
    const res = await api('GET', `/products/${orgAProductId}`, { token: newHireToken });
    assert.equal(res.status, 200);
  });

  await t.test('the new hire (employee) cannot manage roles (permission scoping unaffected)', async () => {
    const res = await api('GET', '/roles', { token: newHireToken });
    assert.equal(res.status, 403);
  });

  await stopServer();
});
