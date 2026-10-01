// Read-only, deeper diagnostic. Writes nothing. Answers:
//   1) Do the pre-existing "legacy" documents (roles/units/warehouses/
//      categories/users/settings/products/stockbalances/stockmovements) have
//      an organizationId field at all?
//   2) For each of the 8 organizations, what (if anything) references its
//      _id across every tenant-scoped collection?
// Run with: node scripts/_diag_deep.js
require('dotenv').config();
const mongoose = require('mongoose');

const TENANT_COLLECTIONS = [
  'categories', 'counters', 'goodsreceipts', 'inventorycounts', 'notifications',
  'products', 'purchaseorders', 'roles', 'settings', 'stockadjustments',
  'stockbalances', 'stockins', 'stockmovements', 'stockouts', 'stockreturns',
  'stocktransfers', 'suppliers', 'units', 'users', 'warehouselocations',
  'warehouses', 'auditlogs',
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system');
  const db = mongoose.connection.db;

  console.log('\n========== PART A: organizationId presence per collection ==========');
  for (const name of TENANT_COLLECTIONS) {
    const exists = await db.listCollections({ name }).toArray();
    if (!exists.length) continue;
    const total = await db.collection(name).countDocuments();
    const withOrgId = await db.collection(name).countDocuments({ organizationId: { $exists: true } });
    const withoutOrgId = total - withOrgId;
    if (total > 0) {
      console.log(`${name}: total=${total} withOrganizationId=${withOrgId} MISSING=${withoutOrgId}`);
    }
  }

  console.log('\n========== PART B: the 8 organizations + what references each ==========');
  const orgs = await db.collection('organizations').find({}).sort({ createdAt: 1 }).toArray();
  console.log(`Found ${orgs.length} organization document(s):`);
  for (const org of orgs) {
    console.log(`\n--- Organization ${org._id} ---`);
    console.log(`  name: ${JSON.stringify(org.name)}  status: ${org.status}  createdAt: ${org.createdAt}  isMigrationDefault: ${!!org.isMigrationDefault}`);
    let anyDependents = false;
    for (const name of TENANT_COLLECTIONS) {
      const exists = await db.listCollections({ name }).toArray();
      if (!exists.length) continue;
      const count = await db.collection(name).countDocuments({ organizationId: org._id });
      if (count > 0) {
        anyDependents = true;
        console.log(`    ${name}: ${count} document(s)`);
      }
    }
    if (!anyDependents) console.log('    (no dependent documents in any tenant-scoped collection)');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('DIAGNOSTIC FAILED:', err);
  process.exit(1);
});
