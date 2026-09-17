# نظام إدارة المخزون (Inventory Management System)

نظام إدارة مخزون متكامل، جاهز للإنتاج (Production-Ready)، بواجهة عربية (RTL) واستجابة كاملة لكل الأجهزة، مبني بـ Vue 3 + Express + MongoDB، قابل للنشر على الويب أو كتطبيق سطح مكتب (Electron).

## البنية

```
inventory-system/
├── frontend/     Vue 3 + Vite + Pinia + Tailwind (RTL)
├── backend/      Node.js + Express + MongoDB (Mongoose)
├── desktop/      غلاف Electron لتشغيل النظام كتطبيق سطح مكتب
├── uploads/      ملفات مرفوعة (صور المنتجات، الصور الشخصية...)
├── backups/      نسخ احتياطية لقاعدة البيانات (يُنشئها النظام تلقائياً)
└── .env.example  قالب متغيرات البيئة للـ Backend
```

## المتطلبات

- Node.js 18+
- MongoDB 6+ (محلي للتطوير، أو MongoDB Atlas للإنتاج)
- npm

## البدء السريع (تطوير محلي)

```bash
# 1) الخادم (Backend)
cd backend
cp ../.env.example .env      # عدّل القيم إن لزم — القيم الافتراضية تعمل مع MongoDB محلي
npm install
npm run dev                  # http://localhost:5000

# 2) الواجهة الأمامية (Frontend) — في نافذة طرفية أخرى
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

افتح `http://localhost:5173` — سيوجهك النظام تلقائياً لمعالج الإعداد الأولي (Setup Wizard) لإنشاء المؤسسة والمدير العام والمخزن الرئيسي.

### بيانات تجريبية سريعة (اختياري)

بدلاً من تعبئة معالج الإعداد يدوياً، يمكن تشغيل:

```bash
cd backend
npm run seed
```

ينشئ الأدوار الافتراضية، وحدات ومخزن وتصنيفات تجريبية، ومدير عام بكلمة مرور **عشوائية** تُطبع في الطرفية مرة واحدة فقط. **هذا السكربت يرفض العمل في بيئة الإنتاج (`NODE_ENV=production`) عمداً** — في الإنتاج استخدم معالج الإعداد داخل التطبيق فقط.

## متغيرات البيئة

راجع [.env.example](.env.example) لكل المتغيرات المطلوبة للـ Backend:

| المتغير | الوصف |
|---|---|
| `PORT` | منفذ الخادم |
| `NODE_ENV` | `development` أو `production` — يُشدّد التحقق من الأسرار المطلوبة والـ rate limiting في الإنتاج |
| `MONGO_URI` | رابط الاتصال بقاعدة بيانات MongoDB |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | مفاتيح توقيع رموز الدخول — **يجب أن تكون قيماً عشوائية طويلة وفريدة في الإنتاج**، ولا تُستخدم القيم الافتراضية أبداً هناك |
| `ACCESS_TOKEN_EXPIRES` / `REFRESH_TOKEN_EXPIRES` | مدة صلاحية رموز الدخول والتحديث |
| `FRONTEND_URL` | رابط الواجهة الأمامية المنشورة (لإعدادات CORS وملف تعريف الارتباط الخاص بالتحديث) |

للواجهة الأمامية، أضف `frontend/.env` عند الحاجة لتوجيهها لخادم غير محلي:

```
VITE_API_URL=https://your-backend-domain.example/api
```

## أوامر التطوير والبناء

| الأمر | الموقع | الوصف |
|---|---|---|
| `npm run dev` | backend | تشغيل الخادم مع nodemon (إعادة تشغيل تلقائية) |
| `npm start` | backend | تشغيل الخادم في وضع الإنتاج |
| `npm run seed` | backend | تعبئة بيانات تطوير أولية (يرفض العمل في الإنتاج) |
| `npm run dev` | frontend | تشغيل واجهة التطوير مع Hot Reload |
| `npm run build` | frontend | بناء نسخة الإنتاج الثابتة في `frontend/dist` |
| `npm run preview` | frontend | معاينة نسخة الإنتاج محلياً |
| `npm run dev` | desktop | تشغيل تطبيق سطح المكتب (يتطلب تشغيل backend وfrontend أولاً) |
| `npm run build` | desktop | بناء تطبيق سطح مكتب موزّع (Windows/macOS/Linux) |

## النشر على الويب (Production)

### 1) قاعدة البيانات — MongoDB Atlas

أنشئ Cluster على [MongoDB Atlas](https://www.mongodb.com/atlas) (حتى الطبقة المجانية M0 تعمل، وهي مجموعة نسخ متماثلة Replica Set تلقائياً، مما يفعّل معاملات MongoDB الكاملة (Transactions) لسلامة عمليات المخزون — على عكس تشغيل MongoDB محلي بدون هذا الإعداد). انسخ رابط الاتصال إلى `MONGO_URI`.

### 2) الخادم (Backend) — Railway

1. اربط المستودع بـ Railway وحدد **مجلد الجذر (Root Directory) = `backend`**.
2. أمر البدء يُقرأ تلقائياً من `package.json` (`npm start`).
3. أضف متغيرات البيئة من الجدول أعلاه — خصوصاً `MONGO_URI` و`JWT_SECRET` و`JWT_REFRESH_SECRET` (قيم عشوائية جديدة، وليست القيم الافتراضية في `.env.example`) و`NODE_ENV=production` و`FRONTEND_URL` (رابط الواجهة على Vercel بعد نشرها).
4. تحقق من عمل الخادم عبر `GET /api/health`.

### 3) الواجهة الأمامية (Frontend) — Vercel

1. اربط المستودع بـ Vercel وحدد **مجلد الجذر = `frontend`**.
2. أمر البناء: `npm run build`، مجلد الإخراج: `dist` (يكتشفهما Vercel تلقائياً كمشروع Vite).
3. أضف متغير البيئة `VITE_API_URL` بقيمة رابط الخادم على Railway (مع `/api` في النهاية).
4. ملف [`frontend/vercel.json`](frontend/vercel.json) موجود مسبقاً لضبط إعادة التوجيه (rewrites) اللازمة لعمل توجيه الصفحات من جهة العميل (Vue Router)، بحيث لا تُعطي الروابط المباشرة مثل `/products` خطأ 404.
5. بعد النشر، ارجع لإعدادات Railway وحدّث `FRONTEND_URL` برابط Vercel النهائي.

### 4) بعد النشر

افتح رابط الواجهة الأمامية — سيوجهك النظام تلقائياً لمعالج الإعداد الأولي لإنشاء أول مستخدم مدير عام حقيقي (لا تستخدم سكربت `seed` في الإنتاج).

## تطبيق سطح المكتب (Electron)

راجع [`desktop/README.md`](desktop/README.md) للتفاصيل الكاملة (وضع التطوير، البناء، إعداد الأيقونة، وكيفية توفير `MONGO_URI` لنسخة سطح المكتب الموزّعة دون تضمين الأسرار داخل حزمة التثبيت).

## الأمان في الإنتاج — قائمة تحقق سريعة

- [ ] `NODE_ENV=production` على الخادم.
- [ ] `JWT_SECRET` و`JWT_REFRESH_SECRET` قيم عشوائية فريدة (لا تُستخدم القيم الافتراضية في `.env.example`).
- [ ] `MONGO_URI` يشير إلى قاعدة بيانات محمية بكلمة مرور (MongoDB Atlas تفرض هذا افتراضياً).
- [ ] `FRONTEND_URL` يطابق رابط الواجهة الأمامية الفعلي بالضبط (لإعدادات CORS وملفات تعريف الارتباط).
- [ ] لم يتم تشغيل `npm run seed` في بيئة الإنتاج (السكربت نفسه يرفض ذلك، لكن تأكد من استخدام معالج الإعداد الداخلي).
- [ ] النسخ الاحتياطي التلقائي مُفعّل من صفحة الإعدادات → النسخ الاحتياطي.

## حالة المشروع

جميع مراحل التطوير الخمس عشرة (Setup، Auth & Users، Warehouses/Products، Inventory Engine، Stock In/Out، Transfers/Returns، Inventory Count، Suppliers/Purchases، Dashboard/Reports، Barcode، Notifications/Audit، Settings/Backups، Testing، Electron، وهذا التوثيق النهائي) مكتملة ومُختبرة فعلياً (وليس نظرياً فقط) عبر تشغيل حقيقي للتطبيق في متصفح حقيقي وتطبيق Electron حقيقي، وليس فقط عبر فحص الكود.
