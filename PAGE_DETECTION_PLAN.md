# Facebook Page Detection & Post Destination — Implementation Plan (Revised)

> اكتشاف صفحات فيسبوك تلقائيًا بعد الربط، واختيار وجهة النشر (بروفايل شخصي أو صفحة) من الـ Compose.
>
> النسخة دي مبنية على **الكود الفعلي** بعد مراجعته: `connect.ts`, `processor.ts`, `posts.ts`, `accounts.ts`, `queue.ts`, `schema.prisma`, `compose/page.tsx`, `lib/api.ts`.

---

## 0. 🔴 BLOCKER — Bug لازم يتصلّح قبل ما تنفّذ أي خطوة من الخطة دي

**اكتشاف مهم من مراجعة الكود:** الـ `connect.ts` بيعمل تشفير فعلًا (`encrypt(JSON.stringify(storageState))` — سطر 74)، **بس الـ `processor.ts` مبيعملش فك تشفير** لما بيقراها — بيعمل `JSON.parse(account.encryptedStorageState)` مباشرة (سطر 80) **من غير `decrypt()`**.

ده معناه:
- الـ session اللي اتحفظت **قبل** إضافة التشفير: plaintext → `JSON.parse` شغّال (الـ end-to-end اللي نجح كان على حساب متصل من قبل).
- أي حساب يتعمل له **re-connect** (زي خطوة الـ Verification رقم 1 في خطتك) هيخزّن `iv:cipher` → **`JSON.parse` هيرمي error** والنشر هيبوظ.

**الحل (قبل أي حاجة):**
```ts
// processor.ts — أضف الاستيراد
import { decrypt } from './lib/crypto';

// وحوّل السطر ده:
const storageState = JSON.parse(decrypt(account.encryptedStorageState));
```

> الخطة دي بتيجي بخطوة إعادة اتصال إجبارية، فإصلاح الـ bug ده **شرط مسبق** لنجاحها. مفيهوش بديل.

---

## 1. تصحيحات على الخطة الأصلية (مبنية على الكود)

| # | في الخطة الأصلية | الصح |
|---|------------------|------|
| 1 | "الـ worker هيتنقّل لـ `job.targetUrl`" | الـ worker بيقرا `post` و`account` من الـ DB بالـ id بس — **مبيقراش الجدول نفسه**. لازم نعدّل إنه (أ) يقرا الـ job row من الـ DB، **و/أو** (ب) نمرّر `targetUrl` جوه الـ BullMQ payload من `posts.ts` |
| 2 | "حدّث الـ createPost عشان يبعت `targetUrl`" | لازم تعدّل **الـ backend كمان**: `posts.ts` يقبل `targetUrl` ويخزّنه في الـ Job **ويبعته** في الـ queue payload |
| 3 | الـ compose هيملأ الـ dropdown من الحساب | الـ `GET /accounts` بيعمل `select` لحقول معينة بس **مفيش فيه `profiles`** — لازم يضيفه في الـ `select` وإلا الـ UI مش هيشوف البيانات |
| 4 | جمع الصفحات بعد اللوجن | **لو الجمع ده فشل، مينفعش يهوّق الاتصال كله** — السيشين أهما. الجمع لازم يكون **non-fatal** (متلفش بـ try/catch) |
| 5 | اسم `profiles` | غامض (البروفايل الشخصي + صفحات). الأوضح: `destinations` |

---

## 2. Data Model (Prisma)

### [MODIFY] `apps/api/prisma/schema.prisma`

```prisma
model SocialAccount {
  // ... الحقول الحالية
  destinations Json?   // [{ name, url }] — البروفايل الشخصي + الصفحات (بدل `profiles`)
}

model Job {
  // ... الحقول الحالية
  targetUrl String?    // وجهة النشر: facebook.com أو رابط الصفحة
}
```

> **ليه `Json?` مش جدول:** الصفحات بتتغير والـ scrape شبه مؤقت — جدول علاقاتي over-engineering لـ MVP. `Json` كفاية ومبسّطة.

---

## 3. Connect Worker — كشف الصفحات (non-fatal، بعد حفظ السيشين)

### [MODIFY] `apps/worker/src/connect.ts`

**الترتيب حرج:** السيشين بتتحفظ الأول (زي دلوقتي، سطر 68–77). كشف الصفحات يتحط **بعدها** في `try/catch` مستقل **مبيرميش error**:

```ts
// بعد حفظ الـ storageState ونجاح الاتصال:
let destinations = [{ name: 'Personal Profile', url: 'https://www.facebook.com' }];
try {
  await page.goto('https://www.facebook.com/bookmarks/pages', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const pages = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/profile"], a[role="link"]'));
    return links
      .map((a) => ({ name: (a.textContent || '').trim(), url: (a as HTMLAnchorElement).href }))
      .filter((p) => p.name && p.url.includes('facebook.com'));
  });
  // تنظيف + إزالة التكرار + دمج مع البروفايل الشخصي
  destinations = [destinations[0], ...dedupe(pages)];
} catch (e) {
  console.log('⚠️ Page detection failed (non-fatal). Saving Personal Profile only.');
}
await prisma.socialAccount.update({
  where: { id: socialAccountId },
  data: { destinations },
});
```

> **الـ selectors هشّة عن قصد نتعامل معاها:** فيسبوك بيغيّر شكله. الفلسفة: لو الـ scrape رجّع صفر صفحات، مفيش مشكلة — البروفايل الشخصي متسجّل، والمستخدم يعمل re-detect بعدين. **متبنيش على إن الـ scrape هينجح دايمًا.**

> **بديل أقوى (اختياري):** لو الـ DOM scrape فشل، خُد screenshot واسأل Gemini يطلّع أسماء الصفحات — بس الـ URLs مش بتبان في الصورة، فالـ DOM أفضل للـ URLs. سيبها fallback بعدين.

### [NEW اختياري] endpoint لإعادة الكشف بدون re-login
`POST /accounts/:id/detect-pages` → connect-style job يفتح بالسيشين المحفوظة ويحدّث `destinations` بس. مفيد لأن الصفحات بتتغير. (ممكن يتأجل لـ Phase لاحق.)

---

## 4. Backend API (`apps/api`)

### [MODIFY] `src/routes/accounts.ts`
في الـ `GET /` ضيف `destinations` للـ `select` (وإلا الـ UI مش هيشوفها):
```ts
select: {
  id: true, platform: true, status: true,
  lastUsedAt: true, createdAt: true,
  destinations: true,   // ← جديد
},
```

### [MODIFY] `src/routes/posts.ts`
الـ endpoint ده (الـ compose الحقيقي) لازم:
1. يقبل `targetUrl` من الـ body.
2. يخزّنه في الـ Job: `prisma.job.create({ data: { ..., targetUrl } })`.
3. يمرّره في الـ payload: `addJobToQueue({ jobId, postId, socialAccountId, targetUrl })`.
```ts
const { content, socialAccountId, targetUrl } = req.body;
// ... بعد إنشاء الـ job:
await addJobToQueue({ jobId: job.id, postId: post.id, socialAccountId, targetUrl });
```

> **الوجهة اختيارية بأمان:** لو `targetUrl` مبعتش، الـ worker يقع على `https://www.facebook.com` (السلوك الحالي). مفيش كسر للتوافق.

---

## 5. Publish Worker — التنقّل للوجهة

### [MODIFY] `apps/worker/src/processor.ts`
1. اقرا `targetUrl` من الـ payload (موجود في `job.data`):
```ts
const { jobId, postId, socialAccountId, targetUrl } = job.data;
```
2. بدل الـ hardcode (سطر 92):
```ts
await page.goto(targetUrl || 'https://www.facebook.com');
```
3. **مهم:** ماتنساش fix الـ decrypt من قسم 0 في نفس الملف ده.

> **الـ composer بتاع الصفحة بيختلف عن الهوم:** في الصفحة اللي بتديرها بيظهر "Write something..." / "Create post" بدل "What's on your mind?". الـ Fast Path الحالي بيدوّر على `What's on your mind` بس — فغالبًا **الـ Vision fallback هو اللي هيشتغل على الصفحات**، وده متوقّع وسليم (النظام الهجين مصمّم لكده). تحسين: زوّد كلمات الـ Fast Path (`/what's on your mind|write something|create post/i`) عشان يمسك الصفحات كمان من غير AI.

> **تحذير سلوكي:** أحيانًا النشر "باسم الصفحة" بيحتاج إن الحساب يكون في وضع الصفحة (Profile switch). التنقّل المباشر لرابط الصفحة بيشتغل لأغلب الصفحات المُدارة، بس **الـ verification (screenshot + تأكيد) مهم** يتأكد إنه نشر في المكان الصح مش على البروفايل بالغلط.

---

## 6. Frontend (`apps/web`)

### [MODIFY] `src/lib/api.ts`
- ضيف `destinations` للـ `Account` interface: `destinations?: { name: string; url: string }[] | null`.
- عدّل `createPost` تقبل `targetUrl?: string` وتبعته في الـ body.

### [MODIFY] `src/app/(dashboard)/compose/page.tsx`
- تحت dropdown الحساب، ضيف dropdown **"Post Destination"**.
- لما الحساب يتغيّر، املأه من `account.destinations` (fallback: "Personal Profile" لو `null`).
- خزّن `targetUrl` في state وابعته مع `createPost`.
- الـ flow الباقي زي ما هو (Prepare & Publish → الوقوف قبل النشر).

---

## 7. مراحل التنفيذ (بالترتيب)

**Phase 0 — إصلاح الـ decrypt (شرط مسبق):**
- `processor.ts`: `JSON.parse(decrypt(...))` + import. اختبر بوست عادي بعد re-connect ينجح.
- ✅ من غير ده، أي خطوة بعده مش هتتأكّد.

**Phase 1 — Schema:**
- `destinations Json?` على `SocialAccount` + `targetUrl String?` على `Job` → `npx prisma db push`.

**Phase 2 — كشف الصفحات (Connect):**
- `connect.ts`: كشف non-fatal بعد حفظ السيشين + حفظ `destinations`.
- ✅ re-connect → الصفحات تتخزّن (أو البروفايل بس لو فشل الكشف) — من غير ما يكسر الاتصال.

**Phase 3 — تمرير الوجهة (Backend):**
- `accounts.ts` select + `posts.ts` (يقبل/يخزّن/يمرّر `targetUrl`) + `processor.ts` (يقرا `targetUrl`).

**Phase 4 — UI:**
- dropdown الوجهة في compose + تعديلات `api.ts`.
- ✅ end-to-end: اختَر صفحة → البوست يتجهّز عليها.

**Phase 5 (اختياري) — Re-detect:**
- `POST /accounts/:id/detect-pages` لتحديث الصفحات بدون re-login.

---

## 8. Verification Plan (مصحّح)

1. **الأهم:** طبّق fix الـ decrypt (Phase 0). اعمل re-connect لحساب، وانشر بوست عادي → لازم ينجح (يثبت إن التشفير/فك التشفير سليم).
2. `prisma db push` ينجح بالحقول الجديدة.
3. re-connect → اتأكد إن `destinations` اتخزّنت في الـ DB (وإن فشل الكشف، البروفايل الشخصي لوحده اتخزّن **والاتصال فضل active**).
4. الـ Compose يعرض dropdown الوجهة بالصفحات (مثال: "House Of Glass").
5. اختَر الصفحة → اكتب بوست → راقب الـ worker بيروح **لرابط الصفحة** (مش الهوم) → الـ screenshot يثبت إن الـ composer فتح على الصفحة الصح.

---

## 9. ملخص القرارات

- **صلّح الـ decrypt الأول** — أهم حاجة، بلوكر حقيقي لخطتك.
- كشف الصفحات **non-fatal وبعد حفظ السيشين** — السيشين أغلى من الكشف.
- **`targetUrl` لازم يتمرّر في الـ queue payload** من `posts.ts`، والـ `accounts.ts` select لازم يضيف `destinations` — دول أكتر نقطتين الخطة الأصلية فاتتهم.
- الـ composer بتاع الصفحة مختلف → اعتمد على الـ Vision fallback + زوّد كلمات الـ Fast Path + verification.
- سمِّها `destinations` مش `profiles`.
- خلّي كل حاجة **backward-compatible**: من غير `targetUrl` → الهوم (السلوك الحالي).
