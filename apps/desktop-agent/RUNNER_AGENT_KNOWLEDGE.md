# QuazLink Desktop Runner — Agent Knowledge & Continuous Learning Log
> **مسؤول السجل**: `runner-lead` (QuazLink Desktop Runner Lead & Manager)  
> **الغرض**: التوثيق التراكمي المستمر لكافة القرارات الهندسية، الدروس المستفادة، وتفاصيل حل الأخطاء لمنع تكرارها نهائياً وضمان تطور الوكيل باستمرار.

---

## 📌 المعايير الهندسية الثابتة (Architectural Invariants)

1. **معيار البث الآمن (Zero-Trust WebSocket Gateway):**
   - الرانر يتصل عبر `wss://api.quazlink.site` (أو الرابط المعرف في الإعدادات).
   - يتم تبادل الـ Heartbeat كل 30 ثانية.
   - في حال انقطاع الاتصال، يُطبق Exponential Backoff بفترات: 2s -> 4s -> 8s -> 16s (بحد أقصى 60s).

2. **معيار التشغيل التلقائي مع الويندوز (Windows Auto-Launch & Silent Boot):**
   - تفعيل الإقلاع عبر:
     ```ts
     app.setLoginItemSettings({
       openAtLogin: true,
       path: process.execPath,
       args: ['--hidden']
     });
     ```
   - عند رصد المعامل `--hidden`، يجب عدم إظهار النافذة الرئيسية نهائياً عند بدء التشغيل، والبدء كـ System Tray Icon مع إشعار بالبالون فقط.

3. **معيار منع السكون (Keep-System-Awake):**
   - استدعاء `powerSaveBlocker.start('prevent-app-suspension')` لمنع دخول المعالج أو بطاقة الشبكة في وضع الخمول أثناء تشغيل المهام المجدولة.

---

## 🧠 سجل الدروس المستفادة والأخطاء المحلولة (Historical Lessons & Solutions)

### الدرس #1: أخطاء التوجيه في تحديثات GitHub Releases (Host Whitelisting)
- **المشكلة**: خطأ `Security Violation: Redirect to unauthorized host 'https://release-assets.githubusercontent.com/...'` أثناء محاولة الرانر تحميل ملف التحديث `QuazLink-Runner-Setup.exe`.
- **السبب الجذري**: قامت GitHub بنقل استضافة الـ Release Assets من `objects.githubusercontent.com` إلى النطاق الجديد `release-assets.githubusercontent.com`، بينما كان كود الـ Updater يسمح فقط بالنطاق القديم.
- **الحل الجذري المتبع**:
  تحديث دالة التحقق من النطاقات في `app-updater.ts` لتشمل:
  ```ts
  const allowedHosts = [
    'github.com',
    'api.github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com'
  ];
  ```
- **القاعدة المستفادة**: لا تقم بحصر نطاقات التوجيه في نطاق واحد؛ اسمح بكلا النطاقين مع فحص مسار الـ Path للتأكد من أمان التحميل.

### الدرس #2: نقص استيراد الأنواع البرمجية (Missing Type Import)
- **المشكلة**: خطأ `error TS2304: Cannot find name 'ExecutionResult'` في `src/client/ws-client.ts`.
- **السبب الجذري**: تم استخدام النوع كـ return type في دالة تنفيذ المهام دون استيراده من `../executor/playwright-runner`.
- **الحل الجذري المتبع**:
  إضافة `import type { ExecutionResult } from '../executor/playwright-runner';`.
- **القاعدة المستفادة**: تشغيل `npx tsc --noEmit` إلزامي قبل تشغيل `npm run build` أو إعلان انتهاء أي تعديل.

### الدرس #3: منع العمليات الشبحية للمتصفح (Zombie Processes)
- **المشكلة**: في حال فشل مهمة أتمتة الواتساب أو فيسبوك بشكل مفاجئ، قد يظل مثيل `chrome.exe` يعمل في الخلفية ويستهلك الرام.
- **الحل المتبع**:
  استخدام بنية `try { ... } finally { await context.close(); await browser.close(); }` الصارمة لضمان تحرير كافة الموارد عند أي خطأ أو إلغاء مهمة.

---

## 📝 تعليمات التحديث المستمر للوكيل:
- بعد كل تعديل جديد، يقوم الوكيل بإضافة بند جديد تحت "سجل الدروس المستفادة" يوضح المشكلة، السبب، والحل المطبق.
- الالتزام بنظام الترقيم الدلالي (SemVer) عند كل إصدار جديد.

