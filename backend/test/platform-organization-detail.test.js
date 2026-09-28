const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system_test_platform_org_detail';
const { startServer, stopServer, api } = require('../test-lib/helpers');
const User = require('../models/User');

let orgAToken, orgBToken, platformToken;
let orgAId, orgBId;
let warehouseAId, productAId;
let invitationId;

test('platform admin — organization control center', async (t) => {
  await startServer();

  await t.test('setup: two organizations, one elevated to platform admin', async () => {
    const resA = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة التحكم أ',
        admin: { fullName: 'Ctrl Admin A', username: 'ctrl_admin_a', email: 'ctrl_admin_a@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'CTRLA' },
      },
    });
    assert.equal(resA.status, 201, JSON.stringify(resA.body));
    orgAToken = resA.body.data.accessToken;
    orgAId = resA.body.data.user.organizationId;
    const orgAAdminId = resA.body.data.user._id;

    const resB = await api('POST', '/auth/register', {
      body: {
        organizationName: 'شركة التحكم ب',
        admin: { fullName: 'Ctrl Admin B', username: 'ctrl_admin_b', email: 'ctrl_admin_b@example.com', password: 'Passw0rd123' },
        warehouse: { name: 'المخزن الرئيسي', code: 'CTRLB' },
      },
    });
    assert.equal(resB.status, 201, JSON.stringify(resB.body));
    orgBToken = resB.body.data.accessToken;
    orgBId = resB.body.data.user.organizationId;

    await User.updateOne({ _id: orgAAdminId }, { $set: { isPlatformAdmin: true } });
    const login = await api('POST', '/auth/login', { body: { identifier: 'ctrl_admin_a', password: 'Passw0rd123' } });
    assert.equal(login.status, 200);
    platformToken = login.body.data.accessToken;
  });

  await t.test('setup: seed org A with a category, unit, product, and an approved stock-in', async () => {
    const catRes = await api('POST', '/categories', { token: orgAToken, body: { nameAr: 'قطع غيار' } });
    assert.equal(catRes.status, 201, JSON.stringify(catRes.body));
    const unitRes = await api('POST', '/units', { token: orgAToken, body: { nameAr: 'قطعة', shortCode: 'PC' } });
    assert.equal(unitRes.status, 201, JSON.stringify(unitRes.body));

    const productRes = await api('POST', '/products', {
      token: orgAToken,
      body: { nameAr: 'صنف تجريبي', category: catRes.body.data._id, unit: unitRes.body.data._id, purchasePrice: 10, salePrice: 15 },
    });
    assert.equal(productRes.status, 201, JSON.stringify(productRes.body));
    productAId = productRes.body.data._id;

    const warehousesRes = await api('GET', '/warehouses', { token: orgAToken });
    warehouseAId = warehousesRes.body.data[0]._id;

    const stockInRes = await api('POST', '/stock/in', {
      token: orgAToken,
      body: {
        warehouse: warehouseAId,
        items: [{ product: productAId, quantity: 50, unitCost: 10 }],
        submit: true,
      },
    });
    assert.equal(stockInRes.status, 200, JSON.stringify(stockInRes.body));
  });

  await t.test('setup: org A creates an invitation', async () => {
    const rolesRes = await api('GET', '/roles', { token: orgAToken });
    const employeeRole = rolesRes.body.data.find((r) => r.name === 'employee');
    const invRes = await api('POST', '/invitations', { token: orgAToken, body: { role: employeeRole._id } });
    assert.equal(invRes.status, 201, JSON.stringify(invRes.body));
    invitationId = invRes.body.data._id;
  });

  // (C) An ordinary organization admin (org B, never elevated) cannot call
  // any platform organization-detail endpoint.
  await t.test('C. a normal organization admin receives 403 from every organization-detail endpoint', async () => {
    const endpoints = [
      `/platform/organizations/${orgAId}/stats`,
      `/platform/organizations/${orgAId}/warehouses`,
      `/platform/organizations/${orgAId}/warehouses/${warehouseAId}`,
      `/platform/organizations/${orgAId}/products`,
      `/platform/organizations/${orgAId}/products/${productAId}`,
      `/platform/organizations/${orgAId}/movements`,
      `/platform/organizations/${orgAId}/users`,
      `/platform/organizations/${orgAId}/audit`,
      `/platform/organizations/${orgAId}/invitations`,
    ];
    for (const path of endpoints) {
      const res = await api('GET', path, { token: orgBToken });
      assert.equal(res.status, 403, `${path} should 403 for a non-platform-admin, got ${res.status}`);
    }
  });

  await t.test('stats: platform admin sees correct aggregate numbers for organization A', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/stats`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.warehousesCount, 1);
    assert.equal(res.body.data.productsCount, 1);
    assert.equal(res.body.data.usersCount, 1);
    assert.equal(res.body.data.activeUsersCount, 1);
    assert.equal(res.body.data.totalStockQuantity, 50);
    assert.equal(res.body.data.totalStockValue, 500);
    assert.ok(res.body.data.invitationsCount >= 1);
  });

  // (A) Platform Admin can inspect all warehouses of Organization A.
  await t.test('A. warehouses list for organization A includes computed stock stats', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/warehouses`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.length, 1);
    const wh = res.body.data[0];
    assert.equal(wh._id, warehouseAId);
    assert.equal(wh.productCount, 1);
    assert.equal(wh.totalQuantity, 50);
    assert.equal(wh.inventoryValue, 500);
  });

  // (B) Platform Admin can inspect all warehouses of Organization B (a
  // completely separate, un-seeded organization) without any crossover.
  await t.test('B. warehouses list for organization B is separate and empty of stock', async () => {
    const res = await api('GET', `/platform/organizations/${orgBId}/warehouses`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].productCount, 0);
    assert.notEqual(res.body.data[0]._id, warehouseAId);
  });

  await t.test('warehouse detail: info, stats, products-in-warehouse, recent movements, assigned users', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/warehouses/${warehouseAId}`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.warehouse._id, warehouseAId);
    assert.equal(res.body.data.stats.productCount, 1);
    assert.equal(res.body.data.stats.totalQuantity, 50);
    assert.equal(res.body.data.products.items.length, 1);
    assert.equal(res.body.data.products.items[0]._id, productAId);
    assert.equal(res.body.data.products.meta.total, 1);
    assert.ok(res.body.data.recentMovements.length >= 1);
    assert.equal(res.body.data.assignedUsers.length, 1);

    // low-stock / out-of-stock filters must not error and must narrow correctly
    const outOfStockFiltered = await api('GET', `/platform/organizations/${orgAId}/warehouses/${warehouseAId}?outOfStock=true`, { token: platformToken });
    assert.equal(outOfStockFiltered.status, 200);
    assert.equal(outOfStockFiltered.body.data.products.items.length, 0, 'the seeded product has stock, so it must not appear in the out-of-stock filter');
  });

  await t.test('warehouse detail 404s for a warehouse belonging to a different organization', async () => {
    const orgBWarehouses = await api('GET', `/platform/organizations/${orgBId}/warehouses`, { token: platformToken });
    const orgBWarehouseId = orgBWarehouses.body.data[0]._id;
    const res = await api('GET', `/platform/organizations/${orgAId}/warehouses/${orgBWarehouseId}`, { token: platformToken });
    assert.equal(res.status, 404);
  });

  await t.test('organization products list includes computed stock totals', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/products`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].totalQuantity, 50);
    assert.equal(res.body.data[0].warehouseCount, 1);
    assert.equal(res.body.data[0].stockValue, 500);
  });

  await t.test('product detail: per-warehouse breakdown and movement history', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/products/${productAId}`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.warehouseBalances.length, 1);
    assert.equal(res.body.data.warehouseBalances[0].quantity, 50);
    assert.equal(res.body.data.totals.quantity, 50);
    assert.ok(res.body.data.recentMovements.length >= 1);
  });

  await t.test('product detail 404s for a product belonging to a different organization', async () => {
    const res = await api('GET', `/platform/organizations/${orgBId}/products/${productAId}`, { token: platformToken });
    assert.equal(res.status, 404);
  });

  await t.test('organization movements list is read-only and scoped correctly', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/movements`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].type, 'IN');

    const empty = await api('GET', `/platform/organizations/${orgBId}/movements`, { token: platformToken });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.data.length, 0);
  });

  await t.test('organization users endpoint is correctly scoped by the URL param, ignoring any query override', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/users?organizationId=${orgBId}`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].username, 'ctrl_admin_a', 'the URL param organization must win over any query string value');
  });

  await t.test('organization invitations list + revoke', async () => {
    const list = await api('GET', `/platform/organizations/${orgAId}/invitations`, { token: platformToken });
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].status, 'active');
    assert.ok(list.body.data[0].codeMasked.includes('•'), 'invitation code must be masked');

    const revoke = await api('POST', `/platform/organizations/${orgAId}/invitations/${invitationId}/revoke`, { token: platformToken });
    assert.equal(revoke.status, 200, JSON.stringify(revoke.body));

    const after = await api('GET', `/platform/organizations/${orgAId}/invitations`, { token: platformToken });
    assert.equal(after.body.data[0].status, 'revoked');
  });

  await t.test('organization audit log includes recent activity, scoped to this organization only', async () => {
    const res = await api('GET', `/platform/organizations/${orgAId}/audit`, { token: platformToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.data.length > 0);

    const orgBAudit = await api('GET', `/platform/organizations/${orgBId}/audit`, { token: platformToken });
    assert.equal(orgBAudit.status, 200);
    assert.ok(orgBAudit.body.data.length > 0, 'org B has its own registration/login activity');
    assert.ok(
      orgBAudit.body.data.every((log) => log.organizationId?._id === orgBId),
      'org B\'s audit log must never include an entry belonging to org A'
    );
  });

  await t.test('warehouse enable/disable: the main warehouse cannot be disabled, a safety rule reused from the tenant side', async () => {
    const res = await api('PATCH', `/platform/organizations/${orgAId}/warehouses/${warehouseAId}/status`, {
      token: platformToken,
      body: { status: 'inactive' },
    });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });

  // (D) A tenant API for Organization A still cannot access Organization B —
  // re-confirmed here specifically for the data this test seeded.
  await t.test('D. tenant APIs remain isolated: org A cannot see org B\'s category', async () => {
    const res = await api('GET', '/categories', { token: orgBToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0, 'org B must not see org A\'s seeded category');
  });

  // (E) Disabled organization: data preserved, platform admin can still inspect it.
  await t.test('E. a suspended organization\'s data remains fully inspectable by the platform admin', async () => {
    const suspend = await api('PATCH', `/platform/organizations/${orgAId}/status`, { token: platformToken, body: { status: 'suspended', reason: 'اختبار' } });
    assert.equal(suspend.status, 200, JSON.stringify(suspend.body));

    const loginBlocked = await api('POST', '/auth/login', { body: { identifier: 'ctrl_admin_a', password: 'Passw0rd123' } });
    assert.equal(loginBlocked.status, 403, 'a suspended organization must block its own users\' login');

    const [whRes, productsRes, statsRes] = await Promise.all([
      api('GET', `/platform/organizations/${orgAId}/warehouses`, { token: platformToken }),
      api('GET', `/platform/organizations/${orgAId}/products`, { token: platformToken }),
      api('GET', `/platform/organizations/${orgAId}/stats`, { token: platformToken }),
    ]);
    assert.equal(whRes.status, 200);
    assert.equal(whRes.body.data[0].productCount, 1, 'suspension must not touch any data');
    assert.equal(productsRes.status, 200);
    assert.equal(productsRes.body.data.length, 1);
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.body.data.totalStockQuantity, 50);

    const reEnable = await api('PATCH', `/platform/organizations/${orgAId}/status`, { token: platformToken, body: { status: 'active' } });
    assert.equal(reEnable.status, 200);
  });

  // (F) No sensitive field ever leaks from any of the new endpoints.
  await t.test('F. no password hash, refresh token, or JWT secret leaks from any organization-detail endpoint', async () => {
    const endpoints = [
      `/platform/organizations/${orgAId}/stats`,
      `/platform/organizations/${orgAId}/warehouses`,
      `/platform/organizations/${orgAId}/warehouses/${warehouseAId}`,
      `/platform/organizations/${orgAId}/products`,
      `/platform/organizations/${orgAId}/products/${productAId}`,
      `/platform/organizations/${orgAId}/movements`,
      `/platform/organizations/${orgAId}/users`,
      `/platform/organizations/${orgAId}/audit`,
      `/platform/organizations/${orgAId}/invitations`,
    ];
    for (const path of endpoints) {
      const res = await api('GET', path, { token: platformToken });
      assert.equal(res.status, 200, `${path} should succeed, got ${res.status}: ${JSON.stringify(res.body)}`);
      const raw = JSON.stringify(res.body);
      assert.ok(!raw.includes('passwordHash'), `${path} must never include passwordHash`);
      assert.ok(!raw.toLowerCase().includes('tokenhash'), `${path} must never include a raw token hash`);
      assert.ok(!raw.toLowerCase().includes('refreshtoken'), `${path} must never include a refresh token`);
      assert.ok(!raw.includes('JWT_SECRET') && !raw.includes('jwtSecret'), `${path} must never include JWT secrets`);
    }
  });

  await stopServer();
});
