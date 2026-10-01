// Interactive CLI for creating an ADDITIONAL Platform Admin account.
//
// Deliberately not an HTTP endpoint: middleware/requirePlatformAdmin.js notes
// that no API exposes a way to grant `isPlatformAdmin` — only the multi-tenant
// migration script (for accounts that already had system-wide access before
// organizations existed) and, now, this script. Requiring direct server
// access (not a remote API call) is an intentional, higher-friction bar for
// granting platform-wide power.
//
// Safety properties (see the request this was built for):
//   - Purely interactive. No CLI flags/JSON are ever parsed for
//     organizationId/isPlatformAdmin/role — those three values are always
//     set explicitly by this script's own logic, never from arbitrary input.
//   - Never touches any *existing* user, organization, or business data. The
//     only writes are: one new User document, and — only if the chosen
//     organization genuinely has none yet — one new Role document via the
//     project's own idempotent ensureDefaultRoles() helper (never a duplicate:
//     Role has a unique (organizationId, name) index, and ensureDefaultRoles
//     already checks findOne() before creating).
//   - Passwords: hashed with the project's existing bcrypt convention
//     (bcryptjs, 12 salt rounds — matches every other user-creation path).
//     The plaintext password is held only in memory for this run (to log in
//     once, for verification) and is never logged, printed, or written
//     anywhere, including passwordHash itself.
//   - Ends with a real, live verification against the running backend
//     (POST /api/auth/login, GET /api/auth/me, GET /api/platform/dashboard)
//     rather than trusting the database write alone.
require('dotenv').config();
const readline = require('readline');
const http = require('http');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const env = require('../config/env');
const { connectDB } = require('../config/db');
const tenantContext = require('../utils/tenantContext');
const { ensureDefaultRoles } = require('../services/roleService');
const auditService = require('../services/auditService');
const Organization = require('../models/Organization');
const User = require('../models/User');

// --- Small interactive-prompt helpers ---------------------------------------

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

// Loops until `validate` returns/resolves true; validate may return a string
// (shown as the error) or false/true, synchronously or as a Promise (the
// username/email checks below need to await a DB query). Used for every
// plain-text field except password (which has its own masked prompt/loop).
async function askValidated(question, validate, { optional = false } = {}) {
  for (;;) {
    const answer = (await ask(question)).trim();
    if (optional && answer === '') return answer;
    const result = await validate(answer);
    if (result === true) return answer;
    console.log(`  ✗ ${typeof result === 'string' ? result : 'قيمة غير صالحة'}`);
  }
}

// Masked password input. Falls back to plain (unmasked) input when stdin
// isn't a real TTY (e.g. piped input during testing) — raw mode only exists
// on a real terminal, and this script is meant to be run interactively by a
// human at a real prompt anyway.
//
// `rl.pause()`/`rl.resume()` alone would NOT be enough here: pausing a
// readline.Interface stops it from processing input, but its own internal
// 'data' listener stays attached to stdin, so calling `stdin.resume()` to
// drive our own raw-mode listener would feed every keystroke to BOTH
// listeners at once — corrupting/duplicating input on the *next*
// `rl.question()` call. Instead, readline's own listener(s) are removed
// for the duration of this prompt and restored immediately after, so only
// our listener ever sees these keystrokes.
function askPassword(question) {
  if (!process.stdin.isTTY) return ask(question);

  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const savedListeners = stdin.listeners('data');
    savedListeners.forEach((listener) => stdin.removeListener('data', listener));

    let input = '';
    const finish = (value) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      savedListeners.forEach((listener) => stdin.on('data', listener));
      resolve(value);
    };

    const onData = (charBuf) => {
      const char = charBuf.toString('utf8');
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdout.write('\n');
          finish(input);
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit(130);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (input.length) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          input += char;
          process.stdout.write('*');
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

// --- Validation ---------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(pw) {
  if (pw.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حرف ورقم واحد على الأقل';
  return true;
}

// --- Main ---------------------------------------------------------------------

async function main() {
  console.log('=== إنشاء مدير منصة (Platform Admin) جديد ===\n');
  console.log('هذا السكربت لا يحذف أو يعدّل أي مستخدم أو بيانات موجودة — يُنشئ حساباً جديداً فقط.\n');

  await connectDB();

  const fullName = await askValidated('الاسم الكامل: ', (v) => (v ? true : 'مطلوب'));

  const username = (
    await askValidated('اسم المستخدم (3 أحرف على الأقل): ', async (v) => {
      if (v.length < 3) return 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
      const exists = await User.findOne({ username: v.toLowerCase() });
      return exists ? 'اسم المستخدم مستخدم مسبقاً' : true;
    })
  ).toLowerCase();

  const email = (
    await askValidated('البريد الإلكتروني: ', async (v) => {
      if (!EMAIL_RE.test(v)) return 'صيغة البريد الإلكتروني غير صحيحة';
      const exists = await User.findOne({ email: v.toLowerCase() });
      return exists ? 'البريد الإلكتروني مستخدم مسبقاً' : true;
    })
  ).toLowerCase();

  const phone = await askValidated('الهاتف (اختياري - اضغط Enter للتخطي): ', () => true, { optional: true });

  let password;
  for (;;) {
    password = await askPassword('كلمة المرور: ');
    const check = validatePassword(password);
    if (check !== true) {
      console.log(`  ✗ ${check}`);
      continue;
    }
    const confirm = await askPassword('تأكيد كلمة المرور: ');
    if (confirm !== password) {
      console.log('  ✗ كلمتا المرور غير متطابقتين');
      continue;
    }
    break;
  }

  const organizations = await Organization.find().select('name status').sort({ createdAt: 1 });
  if (!organizations.length) {
    console.log('\nلا توجد أي مؤسسة (Organization) في قاعدة البيانات بعد. لا يمكن إنشاء مدير منصة بدون مؤسسة يتبع لها.');
    rl.close();
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\nاختر المؤسسة التي سينتمي إليها هذا المستخدم (لأغراض الدور فقط — صلاحيات منصة كاملة تُمنح بغض النظر):');
  organizations.forEach((org, i) => {
    console.log(`  ${i + 1}) ${org.name}${org.status !== 'active' ? `  [${org.status}]` : ''}`);
  });

  const orgChoice = await askValidated(`اختر رقماً (1-${organizations.length}): `, (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= organizations.length ? true : 'رقم غير صالح';
  });
  const organization = organizations[Number(orgChoice) - 1];

  console.log('\n--- ملخص ---');
  console.log(`الاسم: ${fullName}`);
  console.log(`اسم المستخدم: ${username}`);
  console.log(`البريد الإلكتروني: ${email}`);
  console.log(`الهاتف: ${phone || '—'}`);
  console.log(`المؤسسة: ${organization.name}`);
  console.log('الدور: admin | isPlatformAdmin: true | الحالة: active');

  const confirmCreate = await ask('\nاكتب YES للتأكيد والمتابعة: ');
  if (confirmCreate.trim() !== 'YES') {
    console.log('تم الإلغاء. لم يتم إنشاء أي شيء.');
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await tenantContext.run(organization._id, async () => {
    // Platform access is granted exclusively by isPlatformAdmin === true
    // (see middleware/requirePlatformAdmin.js) — there is no 'super-admin'
    // organization role in this architecture, and this script must never
    // create or require one. 'admin' is the same role any organization's own
    // highest-privilege member gets (see controllers/onboarding.controller.js);
    // reuses the org's existing one if present, only creates it if genuinely
    // missing (idempotent — see services/roleService.js). Never creates a
    // second one for the same organization (unique index on Role:
    // {organizationId, name}).
    const roles = await ensureDefaultRoles(organization._id, ['admin']);

    const user = await User.create({
      organizationId: organization._id,
      fullName,
      username,
      email,
      phone: phone || '',
      passwordHash,
      role: roles.admin._id,
      warehouse: null,
      status: 'active',
      isPlatformAdmin: true,
    });

    await auditService.logAction({
      user,
      action: 'CREATE',
      entityType: 'User',
      entityId: user._id,
      description: `تم إنشاء حساب مدير منصة (Platform Admin) جديد عبر سكربت CLI: ${user.username}`,
    });

    return user;
  });

  console.log(`\n✓ تم إنشاء المستخدم بنجاح (id: ${admin._id})`);

  await mongoose.disconnect();
  rl.close();

  await verify(username, password);
}

// --- Post-creation live verification -------------------------------------------

function httpRequest(method, path, { token, body, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: env.PORT,
        path,
        method,
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': data.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          } catch {
            /* non-JSON response — parsed stays null */
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function verify(username, password) {
  console.log('\n=== التحقق الفعلي من الحساب عبر الخادم ===');

  let health;
  try {
    health = await httpRequest('GET', '/api/health', { timeoutMs: 3000 });
  } catch {
    health = null;
  }
  if (!health || health.status !== 200) {
    console.log(`⚠ تعذر الوصول للخادم على http://localhost:${env.PORT} — تم إنشاء الحساب في قاعدة البيانات بنجاح،`);
    console.log('  لكن لم يتم التحقق منه عبر الـ API. شغّل الخادم (npm run dev) ثم سجّل الدخول يدوياً للتأكد.');
    return;
  }

  let pass = 0;
  const total = 5;
  const report = (label, ok) => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (ok) pass += 1;
  };

  const login = await httpRequest('POST', '/api/auth/login', { body: { identifier: username, password } });
  report('POST /api/auth/login ينجح', login.status === 200 && !!login.body?.data?.accessToken);
  if (login.status !== 200 || !login.body?.data?.accessToken) {
    console.log(`\n${pass}/${total} — فشل التحقق عند تسجيل الدخول، توقف التحقق هنا.`);
    process.exitCode = 1;
    return;
  }
  const token = login.body.data.accessToken;

  const me = await httpRequest('GET', '/api/auth/me', { token });
  const user = me.body?.data?.user;
  report('GET /api/auth/me يعيد المستخدم الجديد', me.status === 200 && user?.username === username);
  report('isPlatformAdmin === true', user?.isPlatformAdmin === true);
  report('الدور هو admin والحالة active', user?.role?.name === 'admin' && user?.status === 'active');

  const platformDashboard = await httpRequest('GET', '/api/platform/dashboard', { token });
  report('واجهات Platform Admin API متاحة (GET /api/platform/dashboard)', platformDashboard.status === 200);

  console.log(`\n${pass}/${total} تحقق ناجح${pass === total ? ' — كل شيء يعمل كما هو متوقع.' : ''}`);
  if (pass !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n[create-platform-admin] فشل غير متوقع:', err);
  rl.close();
  mongoose.disconnect().finally(() => process.exit(1));
});
