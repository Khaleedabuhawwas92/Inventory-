# نظام إدارة المخزون — تطبيق سطح المكتب (Electron)

غلاف Electron حول نفس نظام الويب (frontend/backend) لتشغيله كتطبيق سطح مكتب.

## كيف يعمل

- **وضع التطوير (Dev)**: يفترض أن الواجهة الأمامية (`frontend`) وواجهة الخادم (`backend`) تعملان بالفعل بشكل منفصل (عبر `npm run dev` في كل منهما)، ويكتفي Electron بفتح نافذة تشير إلى `http://localhost:5173`.
- **وضع الإنتاج (Production/Packaged)**: عند تشغيل التطبيق المُعبّأ، يقوم `electron/main.js` تلقائياً بتشغيل خادم `backend/server.js` كعملية فرعية، وينتظر حتى يصبح جاهزاً (`/api/health`)، ثم يفتح نافذة تشير إلى `http://localhost:5000`. الخادم نفسه (`backend/app.js`) يخدم ملفات `frontend/dist` مباشرة عند وجودها، بحيث يعمل التطبيق كله من عملية واحدة (Node.js + المتصفح المدمج)، دون الحاجة لخادمين منفصلين.

## الأمان

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `preload.js` يُعرّض فقط واجهة API محدودة وآمنة (`window.desktopApp`) عبر `contextBridge`، دون أي وصول مباشر لـ Node.js داخل صفحة الواجهة.

تم التحقق فعلياً (وليس نظرياً فقط) من أن `window.require` و`process` الكاملة **غير متسربين** إلى صفحة الواجهة، عبر اختبار تشغيلي حقيقي.

## التطوير (Dev)

```bash
# في نافذة طرفية منفصلة
cd backend && npm run dev

# في نافذة طرفية أخرى
cd frontend && npm run dev

# في نافذة طرفية ثالثة
cd desktop
npm install
npm run dev
```

## البناء للإنتاج (Production Build)

```bash
cd desktop
npm install
npm run build
```

هذا الأمر يقوم بـ:
1. بناء الواجهة الأمامية (`frontend/dist`).
2. تعبئة `electron-builder` للتطبيق، مع نسخ `backend/` (باستثناء `.env`) و`frontend/dist` كموارد إضافية (`extraResources`) داخل حزمة التطبيق.

الناتج يظهر في `desktop/release/`.

### إعداد قاعدة البيانات للنسخة المعبأة

التطبيق المُعبأ **لا يحتوي على MongoDB مدمج**. يجب توفير رابط اتصال (عادة MongoDB Atlas للتوزيع خارج جهاز واحد) عبر ملف `.env` يوضع يدوياً بجانب مجلد `backend` داخل حزمة التطبيق المثبتة (`resources/backend/.env`)، بنفس صيغة [`.env.example`](../.env.example) في جذر المشروع. هذا مقصود: لا تُدرج بيانات اتصال قاعدة البيانات أو أسرار JWT داخل حزمة التوزيع نفسها.

### الأيقونة

الملف الحالي `build/icon.png` **غير موجود بعد** — قبل بناء نسخة نهائية للتوزيع، يجب إضافة أيقونة حقيقية بالصيغ المطلوبة لكل نظام تشغيل:
- Windows: `build/icon.ico` (متعدد الأحجام)
- macOS: `build/icon.icns`
- Linux: `build/icon.png` (256×256 أو أكبر)

يمكن توليدها من شعار التطبيق (`frontend/public/favicon.svg`) باستخدام أداة مثل `electron-icon-builder`.
