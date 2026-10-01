// Read-only diagnostic: lists indexes and document counts for the
// collections involved in organization registration. Writes nothing.
// Run with: node scripts/_diag_inspect.js
require('dotenv').config();
const mongoose = require('mongoose');

const COLLECTIONS = ['organizations', 'roles', 'units', 'warehouses', 'categories', 'users', 'settings'];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/inventory_system');
  const db = mongoose.connection.db;

  for (const name of COLLECTIONS) {
    const exists = await db.listCollections({ name }).toArray();
    console.log(`\n=== ${name} ===`);
    if (!exists.length) {
      console.log('  (collection does not exist)');
      continue;
    }
    const indexes = await db.collection(name).indexes();
    for (const idx of indexes) {
      console.log(`  index "${idx.name}": key=${JSON.stringify(idx.key)} unique=${!!idx.unique} partialFilterExpression=${JSON.stringify(idx.partialFilterExpression || null)}`);
    }
    const count = await db.collection(name).countDocuments();
    console.log(`  document count: ${count}`);
    if (count > 0 && count <= 20) {
      const docs = await db.collection(name).find({}, { projection: { name: 1, organizationId: 1, username: 1, email: 1, shortCode: 1, code: 1, createdAt: 1 } }).toArray();
      docs.forEach((d) => console.log('    -', JSON.stringify(d)));
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('DIAGNOSTIC FAILED:', err);
  process.exit(1);
});
