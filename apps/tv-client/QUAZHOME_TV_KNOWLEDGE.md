# QuazHome TV Engineering Knowledge Base (Android TV / Google TV)

## 1. مشكلة الإغلاق التلقائي لخدمة إمكانية الوصول (Accessibility Snap-Off Bug)
### الأعراض:
- يقوم المستخدم بالدخول إلى: `Settings > Device Preferences > Accessibility > QuazHome TV`.
- يوافق على رسالة النظام ("Allow QuazHome TV to have full control...").
- يتحول المفتاح إلى ON ثم يرتد فوراً إلى OFF بشكل تلقائي خلال أجزاء من الثانية.

### السبب الجذري الهندسي (Root Cause):
1. **Dynamic ServiceInfo Override Across Binder:**
   عند استدعاء `onServiceConnected()`، كان الكود البرمجي يستدعي `serviceInfo = info` أو `setServiceInfo(info)`.
   في نظام أندرويد، استدعاء `setServiceInfo` بشكل برمجي ديناميكي يؤدي إلى استبدال كائن الإعدادات المترجم من `accessibility_service_config.xml`.
   إذا كان الكائن منشأ حديثاً أو تنقصه أي صلاحيات أمان (مثل `eventTypes == 0` أو تجريد `canRequestFilterKeyEvents`)، يقوم نظام `AccessibilityManagerService` في الـ `system_server` بإلقاء `IllegalArgumentException: service must request at least one event type` أو `SecurityException`.
   كنظام حماية مدمج في أندرويد لحماية النظام من الانهيار المستمر، يقوم الـ OS بإنهاء ربط الخدمة (Unbind) فوراً وإعادة تعيين مفتاح الإذن إلى `DISABLED` في إعدادات النظام الآمنة (`Secure Settings`).
2. **نوع الأحداث في ملف التكوين (Event Types Mask):**
   استخدام `android:accessibilityEventTypes="typeWindowStateChanged"` كان شديد التقييد؛ حيث تشترط خدمات فلترة أزرار الريموت في أندرويد استخدام `android:accessibilityEventTypes="typeAllMask"` لتمكين خط أنابيب معالجة الأحداث المباشرة بدون تعارض مع تطبيقات النظام.

### الحل المعتمد في v1.0.5:
1. ضبط `res/xml/accessibility_service_config.xml` بنمط Static XML صارم:
   ```xml
   <accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
       android:accessibilityEventTypes="typeAllMask"
       android:accessibilityFeedbackType="feedbackGeneric"
       android:accessibilityFlags="flagDefault|flagRequestFilterKeyEvents"
       android:canRequestFilterKeyEvents="true"
       android:canRetrieveWindowContent="false"
       android:description="@string/accessibility_service_desc"
       android:notificationTimeout="100" />
   ```
2. حذف استدعاء `setServiceInfo()` نهائياً من `RemoteKeyInterceptorService.kt:onServiceConnected()`، وترك نظام التشغيل يربط الخدمة مباشرة عبر الـ XML Metadata المصرح بها في الـ Manifest.

---

## 2. معمارية تخصيص أزرار الريموت وأنماط الضغط (Remote Key Customization & Multi-Mode Engine)
### الأنماط المدعومة:
1. **ضغطة عادية (Single Click):**
   - استجابة فورية عند `ACTION_DOWN` مع `repeatCount == 0`.
   - استهلاك الحدث (`return true`) لمنع أي تفاعل غير مقصود من التطبيق الخلفي.
2. **ضغطة مطولة (Long Press - 500ms):**
   - عند `ACTION_DOWN` مع `repeatCount == 0`، يتم جدولة `Runnable` على `Handler(Looper.getMainLooper())` لمدة 500ms.
   - عند `ACTION_UP`، يتم إلغاء الـ Runnable فوراً في حال رفع الإصبع مبكراً.
   - إذا مرت 500ms يتم تفعيل القائمة العائمة واستهلاك الحدث كاملاً.
3. **ضغطتان متتاليتان (Double Click - 350ms):**
   - تتبع الفارق الزمني `delta = currentTime - lastClickTime`.
   - إذا كان الفارق بين 50ms و 350ms يتم تفعيل القائمة وإعادة تصفير العداد فوراً.

### محرك التقاط الأزرار (Key Capture State Machine):
- زر `[ 🎯 تسجيل زر جديد من الريموت ]` يدخل التطبيق في وضع الاستماع (`isCapturingKey = true`).
- التقاط أي `keyCode` قادم من ريموت التلفزيون وترجمته إلى اسم عربي وإنجليزي واضح (مثلاً: الزر الأزرق، زر القائمة Menu، زر الدليل Guide، الخ).
- حماية أزرار التنقل الأساسية (D-Pad و Back) من الكتابة الفوقية العشوائية أثناء تصفح الإعدادات.
