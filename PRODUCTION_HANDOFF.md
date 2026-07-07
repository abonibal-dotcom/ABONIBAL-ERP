# ABONIBAL ERP — Final Production Handoff

## الحالة النهائية

Status: V1 Production Handoff  
Branch: v1/handoff-001-final-production-package  
Baseline tag: v1-ui-003-mobile-tables-rtl-polish  
Classification: ECS

هذا الملف يوثق حالة التسليم النهائية لمشروع ABONIBAL ERP بعد إغلاق مراحل الوظائف الأساسية، تحسين الواجهة، الترجمة العربية، وتحسين الجداول على الهاتف.

## آخر حالة مقبولة

Latest accepted UI baseline:

- Commit: a358654
- Tag: v1-ui-003-mobile-tables-rtl-polish
- Branch: v1/ui-003-mobile-tables-rtl-polish

Previous production regression baseline:

- Commit: e56bcb9
- Tag: v1-rel-001-full-v1-production-regression-release-candidate

## ما تم إنجازه في V1

- Authentication / login / logout
- Route Guard
- Account/session resolution
- Account-scoped product persistence
- Product CRUD/search/safe delete
- Inventory movement ledger
- Opening balance / manual adjustment
- Current stock view
- Stock availability gate
- Invoice draft create/update
- Invoice issuing with stock deduction
- Issued invoice audit view
- Invoice cancellation with stock reversal
- Invoice returns and partial returns
- Arabic RTL labels
- Professional RTL layout
- Mobile table/card polish

## التشغيل المحلي

Install:

pnpm install --frozen-lockfile

Create env:

cp .env.example .env

Required env values:

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

Run:

pnpm run dev -- --host 0.0.0.0

Open:

http://127.0.0.1:5173

## أوامر التحقق

TypeScript:

pnpm exec tsc --noEmit

Build:

pnpm run build

ملاحظة: تحذير حجم chunk في Vite مقبول حالياً ولا يعتبر فشل build.

## Firebase

المشروع يحتاج إعداد Firebase من خلال .env.

مهم:

- لا يتم رفع .env إلى Git
- لا يتم كشف مفاتيح Firebase في الرسائل أو الصور
- firebase.json غير موجود في هذا الـ checkout الحالي
- .firebaserc غير موجود في هذا الـ checkout الحالي

رابط الاستضافة الذي تم اختباره سابقاً:

https://abonibal-production.web.app

## قواعد سلامة البيانات

Storage keys المقبولة:

- products:{accountId}
- stockMovements:{accountId}
- invoices:{accountId}
- invoiceReturns:{accountId}

قواعد مهمة:

- لا يتم حذف localStorage.products بشكل تخريبي
- Product.quantity للتوافق القديم فقط
- المخزون مصدره ledger حركات المخزون
- لا يوجد default account fallback
- لا يتم افتراض Firebase uid كـ accountId
- الفواتير الصادرة لا تُحذف hard delete
- إلغاء الفاتورة يجب أن يعكس المخزون بحركة Stock Movement
- المرتجعات يجب أن تعيد المخزون بحركة Return Movement

## سلسلة UI المقبولة

- v1-ui-001-professional-rtl-layout-baseline
- v1-ui-002-arabic-labels-rtl-copy-cleanup
- v1-ui-003-mobile-tables-rtl-polish

## ملاحظات مؤجلة

- تنظيف بيانات المنتجات القديمة المشفرة إذا لزم
- إضافة/استرجاع firebase.json و .firebaserc إذا سيتم النشر من هذا الـ checkout
- تحسينات Desktop إضافية إذا رغبت
- تحسين code splitting لاحقاً إذا لزم

## لا يتم Commit لهذه الملفات

- .env
- node_modules
- dist
- pnpm-workspace.yaml إلا إذا تقرر ذلك صراحة
- أي صور أو مخرجات محلية غير مقصودة

## الخلاصة

ABONIBAL ERP V1 جاهز كتسليم إنتاجي وظيفي بعربي RTL وواجهة محسنة للهاتف.

هذه المهمة توثيقية فقط ولا تغيّر أي منطق في التطبيق.
