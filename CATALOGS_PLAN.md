# Integrate Products Catalog API — Implementation Plan (Revised)

> ميزة **Catalogs**: المستخدم يربط API خارجي لمنتجاته (Shopify / WooCommerce / Custom)، والـ AI Agent يسحب منتج، يولّد إعلان (ad copy)، وينزّله في الـ composer جاهز للمراجعة والنشر.
>
> النسخة دي متبنية على **الكود الفعلي** للمشروع (schema, routes/index.ts, worker/processor.ts, web/lib/api.ts, compose/page.tsx) بعد مراجعته — مش على قوالب عامة.

---

## 0. مبادئ حاكمة (مستخلصة من الكود الحالي)

1. **Single-user pattern:** لسه مفيش auth. كل الـ routes بتستخدم `getDefaultUser()` من `../lib/user`. الميزة دي تمشي على نفس النمط.
2. **Native fetch only في الويب:** `apps/web/src/lib/api.ts` بيستخدم `fetch` بس (مفيش axios/swr). نكمّل على نفس الأسلوب.
3. **الـ routes بتتسجل في `routes/index.ts`** مش في `server.ts`.
4. **الميديا في الـ worker لوكال:** الـ worker بيرفع ملفات بالـ path المحلي (`fs.existsSync` + `setInputFiles`). أي رابط remote لازم يتنزّل لوكال الأول.
5. **الموديل هو Gemini** (`@google/generative-ai`, `gemini-3.5-flash-lite`) — أي توليد نص يستخدمه، مش Claude.
6. **أسرار متشفّرة:** زي `storageState`، الـ `apiKey` أمانة — plaintext لوكال مؤقتًا، AES-256 قبل الـ deploy.

---

## 1. تصحيحات على الخطة الأصلية (لازمة)

| # | في الخطة الأصلية | الصح |
|---|------------------|------|
| 1 | تعديل `server.ts` لتسجيل الـ route | التسجيل في **`routes/index.ts`** عبر `router.use('/catalogs', catalogsRouter)` |
| 2 | موديل `Catalog` لوحده | لازم إضافة `catalogs Catalog[]` في موديل **`User`** وإلا الـ migration يفشل |
| 3 | إرفاق صورة المنتج مباشرة | صورة المنتج **remote URL** — لازم خطوة **تنزيل لوكال** قبل الرفع (الـ worker بيفلتر بـ `fs.existsSync`) |
| 4 | fetch لأي `apiUrl` | **حماية SSRF**: منع localhost/private-IP/metadata |
| 5 | `apiKey` نص عادي | تشفير قبل الـ deploy (نفس دَين `storageState`) |
| 6 | (غير محدد) مكان توليد الإعلان | **endpoint متزامن** في الـ API يرجّع نص قابل للتعديل — مش في الـ worker |

---

## 2. Data Model (Prisma)

### [MODIFY] `apps/api/prisma/schema.prisma`

**(أ) إضافة الطرف التاني للعلاقة في `User`:**
```prisma
model User {
  // ... الحقول الحالية
  socialAccounts SocialAccount[]
  campaigns      Campaign[]
  catalogs       Catalog[]        // ← جديد (إجباري وإلا db push يفشل)
}
```

**(ب) موديل `Catalog` (نسخة محسّنة):**
```prisma
model Catalog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String                       // "Main Store"
  sourceType  String   @default("custom")  // 'custom' | 'shopify' | 'woocommerce'
  apiUrl      String
  apiKey      String?                       // متشفّر قبل الـ deploy (زي storageState)
  authScheme  String   @default("bearer")  // 'bearer' | 'header' | 'query' | 'none'
  authHeader  String?                       // اسم الهيدر لو authScheme='header'
  lastSyncAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

> **ليه الحقول الزيادة؟** `sourceType` يحدد أي adapter يتنادى. `authScheme`/`authHeader` عشان الـ APIs بتختلف في طريقة الـ auth (بعضها Bearer، بعضها هيدر مخصص، بعضها query param). ده يخليك ما تتقفلش على شكل واحد.

> **بدون Product table (مقصود):** المنتجات بتتسحب **live** عند الطلب. مفيش داعي نخزّنها في DB في الـ MVP — ده over-engineering. نضيف caching بعدين لو احتجنا.

---

## 3. طبقة التطبيع (Normalized Product + Adapters)

المصادر بترجّع JSON بأشكال مختلفة. نعرّف نوع موحّد داخلي، وكل مصدر له adapter صغير يحوّل لِـه.

### [NEW] `apps/api/src/lib/catalog/types.ts`
```ts
export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string | null;   // remote URL — هيتنزّل لوكال وقت النشر
  productUrl: string | null;
}
```

### [NEW] `apps/api/src/lib/catalog/adapters.ts`
- `customAdapter(json)` — يتوقّع `[{ title, price, image, ... }]` (نبدأ بيها).
- `shopifyAdapter(json)` — يقرأ `products[].variants[0].price` و`images[0].src`.
- `wooAdapter(json)` — يقرأ حقول WooCommerce.
- `pickAdapter(sourceType)` — يرجّع الدالة المناسبة.

> **ابدأ بـ `custom` بس.** ضيف Shopify/Woo لما تحتاجهم فعلًا. (مبدأ "ابدأ ضيّق".)

### [NEW] `apps/api/src/lib/catalog/fetchProducts.ts`
- يبني الـ headers حسب `authScheme` (Bearer / custom header / query / none).
- يعمل fetch للـ `apiUrl` **بعد فحص SSRF** (قسم 6).
- يمرّر النتيجة على الـ adapter → `Product[]`.
- timeout + حجم رد أقصى (يمنع ردود ضخمة).

---

## 4. Backend API (`apps/api`)

### [NEW] `src/routes/catalogs.ts`
يتبع نفس نمط `accounts.ts`/`posts.ts` بالظبط (`getDefaultUser()` + `prisma` + `try/catch`).
- `GET /` → قائمة الكتالوجات (بدون `apiKey` في الـ response — زي ما `accounts` بيخفي الـ session).
- `POST /` → إضافة كتالوج (`name, sourceType, apiUrl, apiKey, authScheme`).
- `DELETE /:id` → مسح كتالوج.
- `GET /:id/products` → يسحب المنتجات live عبر `fetchProducts()` ويرجّع `Product[]`.

### [NEW] `src/routes/ai.ts` — توليد الإعلان (متزامن)
- `POST /generate-copy` — الـ body: `{ product, tone?, language? }`.
- ينادي Gemini (نفس الـ SDK بتاع الـ worker) بـ prompt احترافي:
  > "اكتب إعلان سوشيال ميديا جذّاب لمنتج «{title}» بسعر {price} {currency}. الوصف: {description}. النبرة: {tone}. اللغة: {language}. أضف call-to-action وإيموجي مناسب. رجّع النص فقط."
- يرجّع `{ copy: string }` — **نص قابل للتعديل**، المستخدم يراجعه قبل النشر.

> **ليه sync مش worker؟** ده تفاعلي — المستخدم مستني النص عشان يعدّله. الـ worker/queue للمهام الطويلة (النشر). ماتخلطش الاتنين.

### [MODIFY] `src/routes/index.ts`
```ts
import catalogsRouter from './catalogs';
import aiRouter from './ai';
// ...
router.use('/catalogs', catalogsRouter);
router.use('/ai', aiRouter);
```

---

## 5. Worker — تنزيل الصور الـ Remote (الثغرة الحرجة)

**المشكلة:** [processor.ts:73](apps/worker/src/processor.ts#L73) بيعمل:
```ts
const mediaFiles = (post.mediaUrls || []).filter((p) => fs.existsSync(p));
```
ده بيشيل أي `https://...` (صورة منتج) بصمت لأنها مش ملف لوكال.

### [MODIFY] `apps/worker/src/processor.ts`
اعمل الـ mediaUrls "URL-aware": نزّل أي رابط remote لملف مؤقت قبل الرفع.
```ts
async function resolveMedia(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    if (/^https?:\/\//i.test(u)) {
      const localPath = await downloadToTemp(u);   // fetch → tmp file
      out.push(localPath);
    } else if (fs.existsSync(u)) {
      out.push(u);
    }
  }
  return out;
}
// بدل السطر القديم:
const mediaFiles = await resolveMedia(post.mediaUrls || []);
// ... وبعد النشر: نظّف الملفات المؤقتة (cleanup)
```

> **بديل:** تنزّل الصورة في الـ API وقت إنشاء البوست وتخزّن الـ path المحلي في `mediaUrls`. بس عمله في الـ worker أعمّ وبيفتح الباب لأي ميديا remote مستقبلًا.

---

## 6. الأمان (لازم قبل أي deploy)

### (أ) حماية SSRF — [NEW] `src/lib/catalog/ssrfGuard.ts`
قبل أي fetch لـ `apiUrl` من المستخدم:
- امنع: `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (metadata), `::1`.
- اسمح بـ `https://` بس (اختياري لكن مفضّل).
- resolve الـ DNS وتأكد الـ IP مش خاص (يمنع DNS-rebinding).
- طبّق نفس الحارس في `fetchProducts` **و** في تنزيل الصور في الـ worker.

### (ب) تشفير `apiKey`
- نفس دَين `storageState` (ARCHITECTURE §5). AES-256 قبل الـ deploy، المفتاح في env/KMS مش في الكود.
- في التخزين: شفّر عند الكتابة، فك عند الاستخدام في `fetchProducts` بس. **متطلّعوش أبدًا في أي API response.**

---

## 7. Frontend (`apps/web`)

### [MODIFY] `src/lib/api.ts`
ضيف على نفس النمط (native fetch + interfaces):
```ts
export interface Catalog {
  id: string; name: string; sourceType: string; apiUrl: string;
  authScheme: string; lastSyncAt: string | null; createdAt: string;
}
export interface Product { /* نفس شكل الـ backend */ }

export async function getCatalogs(): Promise<Catalog[]>
export async function addCatalog(input): Promise<Catalog>
export async function deleteCatalog(id: string): Promise<void>
export async function getCatalogProducts(id: string): Promise<Product[]>
export async function generateCopy(input): Promise<{ copy: string }>
```

### [MODIFY] `src/components/dashboard/Sidebar.tsx`
عنصر تنقّل جديد "Catalogs" (أيقونة `Package` أو `ShoppingBag` من lucide).
> ⚠️ الـ log بيقول أيقونة `Facebook` اتشالت من lucide واتعملها inline SVG — تأكد الأيقونة اللي هتختارها موجودة في نسختك، وإلا استخدم inline SVG.

### [NEW] `src/app/(dashboard)/catalogs/page.tsx`
صفحة بنفس ثيم `GlassCard` (زي `accounts`/`compose`):
- فورم إضافة كتالوج (name, sourceType select, apiUrl, apiKey, authScheme).
- Grid للكتالوجات المتصلة + زر Delete.
- زر "Test / Preview" يستدعي `getCatalogProducts` ويعرض أول منتجات (تأكيد إن الربط شغّال).

### [MODIFY] `src/app/(dashboard)/compose/page.tsx`
- زر **"Generate from Catalog"**.
- يفتح picker: يختار كتالوج → يعرض منتجاته (`getCatalogProducts`) → يختار منتج.
- ينادي `generateCopy(product)` → يملأ `content` بالنص المولّد **(قابل للتعديل)**.
- يحط `product.imageUrl` في الـ mediaUrls اللي هتترفع (الـ worker هينزّلها لوكال — قسم 5).
- الـ flow القائم زي ما هو: بعدها "Prepare & Publish" → الـ agent يجهّز ويقف قبل النشر.

---

## 8. مراحل التنفيذ (بالترتيب)

**Phase 1 — Data + CRUD (الأساس):**
- تعديل `schema.prisma` (User back-relation + Catalog) → `npx prisma db push`.
- `routes/catalogs.ts` (GET/POST/DELETE) + تسجيله في `routes/index.ts`.
- `lib/api.ts`: `getCatalogs`/`addCatalog`/`deleteCatalog`.
- صفحة `catalogs/page.tsx` + عنصر Sidebar.
- ✅ محصلة: تقدر تضيف/تشوف/تمسح كتالوج من الـ UI ويتخزّن في DB.

**Phase 2 — سحب المنتجات (Read):**
- `lib/catalog/types.ts` + `adapters.ts` (custom بس) + `fetchProducts.ts` + `ssrfGuard.ts`.
- `GET /catalogs/:id/products`.
- زر Test/Preview في صفحة الكتالوجات.
- ✅ محصلة: تربط API حقيقي وتشوف منتجاتك معروضة.

**Phase 3 — توليد الإعلان (AI):**
- `routes/ai.ts` (`POST /generate-copy` عبر Gemini).
- ✅ محصلة: تدّي منتج، يرجّعلك نص إعلان.

**Phase 4 — الدمج مع Compose + صور remote:**
- زر "Generate from Catalog" + product picker في `compose`.
- تعديل الـ worker: `resolveMedia()` (تنزيل remote → لوكال) + cleanup.
- ✅ محصلة: منتج → إعلان مولّد → صورة تتنزّل وتترفع → الـ agent يجهّز البوست.

**Phase 5 — تصليب أمني (قبل الـ deploy):**
- تشفير `apiKey` (AES-256) + تطبيق `ssrfGuard` على تنزيل الصور كمان.
- (نفس شغلة تشفير `storageState` — يتعملوا مع بعض.)

---

## 9. Verification Plan

**Phase 1:** `prisma db push` ينجح بدون error العلاقة → إضافة كتالوج من الـ UI → موجود في DB (`GET /catalogs` بيرجّعه من غير `apiKey`).

**Phase 2:** ربط API تجريبي → المنتجات تظهر. جرّب URL خبيث (`http://localhost:3001`) → لازم **يترفض** (SSRF guard).

**Phase 3:** منتج → نص إعلان معقول بالنبرة/اللغة المطلوبة.

**Phase 4 (end-to-end):** اختَر منتج في compose → النص اتملأ (وعدّلته) → Prepare & Publish → الـ worker نزّل الصورة (اتأكد من الـ log) → البوست اتجهّز بالنص + الصورة → screenshot إثبات → الملف المؤقت اتمسح.

**أمان:** تأكد إن `apiKey` مش بيظهر في أي response ولا في أي log.

---

## 10. ملخص القرارات

- ابنِ على أنماط المشروع القائمة (getDefaultUser، native fetch، Gemini، GlassCard).
- **صور المنتجات remote → تنزيل لوكال إجباري** قبل الرفع (أهم نقطة تقنية).
- **توليد الإعلان sync في الـ API**، مش في الـ worker.
- **SSRF + تشفير apiKey** مش اختياريين لـ SaaS.
- ابدأ بـ adapter واحد (custom)، وسّع بعدين.
- خلّي flow "الوقوف قبل النشر" زي ما هو — آمن للمرحلة دي.
