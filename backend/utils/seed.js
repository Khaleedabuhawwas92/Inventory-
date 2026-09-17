// Development-only convenience seed: default roles/units, a sample warehouse
// and categories, and a super admin — so a fresh clone has something to look
// at without clicking through the Setup Wizard by hand. Intentionally never
// runs in production and never uses a fixed password (spec §55).
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const env = require('../config/env');
const { connectDB } = require('../config/db');
const { ensureDefaultRoles } = require('../services/roleService');
const { DEFAULT_UNITS } = require('../constants/defaultUnits');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Unit = require('../models/Unit');
const Category = require('../models/Category');
const Settings = require('../models/Settings');

const SAMPLE_CATEGORIES = [
  { nameAr: 'قطع غيار', children: ['محركات', 'فلاتر', 'كهرباء'] },
];

async function seed() {
  if (env.NODE_ENV === 'production') {
    console.error('[Seed] Refusing to run in production. Use the in-app Setup Wizard instead.');
    process.exit(1);
  }

  await connectDB();

  const existingUserCount = await User.countDocuments();
  if (existingUserCount > 0) {
    console.log('[Seed] Users already exist — nothing to do. (Delete the database first if you want a fresh seed.)');
    await mongoose.disconnect();
    return;
  }

  const roles = await ensureDefaultRoles();
  console.log('[Seed] Default roles ready:', Object.keys(roles).join(', '));

  let warehouse = await Warehouse.findOne({ isMain: true });
  if (!warehouse) {
    warehouse = await Warehouse.create({ name: 'المخزن الرئيسي', code: 'MAIN', isMain: true });
    console.log('[Seed] Created sample warehouse: المخزن الرئيسي (MAIN)');
  }

  const unitCount = await Unit.countDocuments();
  if (unitCount === 0) {
    await Unit.insertMany(DEFAULT_UNITS.map((u) => ({ ...u, active: true })));
    console.log(`[Seed] Created ${DEFAULT_UNITS.length} default units`);
  }

  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    for (const parent of SAMPLE_CATEGORIES) {
      const parentDoc = await Category.create({ nameAr: parent.nameAr });
      for (const childName of parent.children) {
        await Category.create({ nameAr: childName, parent: parentDoc._id });
      }
    }
    console.log('[Seed] Created sample categories (قطع غيار > محركات، فلاتر، كهرباء)');
  }

  // Never a fixed password: use SEED_ADMIN_PASSWORD if the developer set one
  // locally, otherwise generate a random one and print it once.
  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await User.create({
    fullName: 'مدير النظام',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash,
    role: roles['super-admin']._id,
    warehouse: warehouse._id,
    status: 'active',
  });

  const settingsExists = await Settings.findOne();
  if (!settingsExists) {
    await Settings.create({
      company: { name: 'شركة تجريبية' },
      inventory: { defaultWarehouse: warehouse._id },
      setupCompleted: true,
    });
  }

  console.log('\n[Seed] Done. Super admin created:');
  console.log(`  username: ${admin.username}`);
  console.log(`  password: ${password}`);
  console.log('  (save this now — it is not stored anywhere in plain text)\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
