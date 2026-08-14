# Production Readiness Plan (Phase 6) — Revised

> جاهزية QuazLink للـ production. النسخة دي مبنية على **الكود الفعلي** بعد مراجعته:
> `processor.ts`, `connect.ts`, `crypto.ts`, `docker-compose.yml` (موجود فعلًا!)، و`package.json` بتاع كل workspace.

---

## 0. 🔴 رأيي بإيجاز — الاتجاه صح، بس الخطة فاتتها أخطر نقطة

الخطة كويسة في الفكرة العامة (Docker + headless + توثيق env)، **بس فيها افتراض غلط خطير:** إنها بتعامل `headless: true` كأنه مجرد toggle في env.

**الحقيقة من الكود:** تدفّق النشر الحالي **human-in-the-loop بالتصميم** — الـ [processor.ts:233-251](apps/worker/src/processor.ts#L233-L251) **بيقف قبل ما ينشر**، بيحفظ screenshot، ويطبع "click Post YOURSELF"، وبعدين **بيستنى إنسان يقفل نافذة المتصفح** (`page.waitForEvent('close')` بـ timeout 10 دقايق).

يعني لو حوّلت `headless: true` من غير ما تعيد تصميم التدفّق ده:
- مفيش نافذة يشوفها حد، ومفيش حد يقفلها → **كل job هيعلّق 10 دقايق كاملة** وبعدين يـ timeout.
- البوست **مش هيتنشر أصلًا** (الـ worker بيقف قبل ضغط Post).

**فـ الـ headless مش config toggle — لازم يسبقه إعادة تصميم لتدفّق النشر (auto-post).** دي أكبر نقطة، وموضّحة في قسم 2.

كمان الـ verification رقم 2 في خطتك ("post runs in background without a visible window") — بالتصميم الحالي هيعلّق مش هينجح.

---

## 1. جدول التصحيحات (مبني على الكود)

| # | في الخطة | الصح (من الكود) |
|---|----------|-----------------|
| 1 | `docker-compose.yml` **[NEW]** | **موجود بالفعل** في الروت (Postgres 15 + Redis 7 بس). المفروض **[MODIFY]** — نضيف app services اختياريًا |
| 2 | `.env.example` **[MODIFY]** | **مش موجود** خالص. المفروض **[NEW]**. وفيه `.env` منفصلة لكل service (`apps/api/.env`, `apps/worker/.env`) |
| 3 | صورة `playwright:v1.40.0-jammy` | الـ worker مثبّت عليه `playwright@^1.41.0` → **الصورة أقدم من المكتبة**، المتصفحات مش هتطابق. لازم تطابق نسخة **1.41.x** |
| 4 | "ENCRYPTION_KEY must be 32 bytes" | الـ `crypto.ts` بيعمل `padEnd(32).slice(0,32)` — بيقبل **أي** نص (بيبطّط/يقص). التوثيق ده مضلّل. والأخطر: فيه **fallback key ثابت** في الكود → ثغرة (قسم 3) |
| 5 | Dockerfile واحد لكل الـ services على صورة Playwright | 3 services مختلفة. **الـ api و web مش محتاجين متصفح** (~2GB زيادة). ولازم كل واحد process لوحده مش "startup commands" في كونتينر واحد (قسم 6) |
| 6 | `HEADLESS` في `connect.ts` | الـ connect **بيحتاج لوجن يدوي** — لو `HEADLESS=true` اتحطّت عليه، هيبقى أعمى ومينفعش (قسم 5) |
| 7 | قائمة env: `ENCRYPTION_KEY, HEADLESS, DATABASE_URL, REDIS_URL` | **ناقصة `GEMINI_API_KEY`** (الـ worker محتاجه — [processor.ts:22](apps/worker/src/processor.ts#L22)) + رابط الـ API للـ web |

> ✅ **ملاحظة إيجابية:** الـ decrypt bug من الخطط السابقة **اتصلّح** — [processor.ts:140](apps/worker/src/processor.ts#L140) بيعمل `JSON.parse(decrypt(...))` دلوقتي. النشر بعد re-connect هيشتغل.

---

## 2. 🔴 البلوكر الحقيقي — تدفّق النشر لازم يتحوّل لـ Auto-Post قبل الـ Headless

ده **شرط مسبق** لأي كلام عن headless/cloud. من غيره، النشر على السيرفر مستحيل.

### المشكلة (الكود الحالي)
[processor.ts:233-251](apps/worker/src/processor.ts#L233-L251):
```ts
// STOP BEFORE POST — human reviews and clicks Post manually
await prisma.job.update({ ..., status: 'prepared', ... });
console.log('👀 Review it in the browser, then click "Post" YOURSELF.');
await page.waitForEvent('close', { timeout: 10 * 60 * 1000 }); // ← يستنى إنسان
```

ده مصمّم للـ **local dev** (إنسان بيراجع وبيضغط Post). على سيرفر headless مفيش إنسان → تعليق + timeout + مفيش نشر.

### الحل المقترح — وضعين بـ env flag
```ts
// processor.ts — بدل الـ block اللي بيستنى الإنسان:
const autoPost = process.env.AUTO_POST === 'true';

if (autoPost) {
  // ابحث عن زرار Post/Publish (Fast Path + Vision fallback زي post creation)
  const postBtn = page.getByRole('button', { name: /^(post|publish|نشر)$/i }).first();
  await postBtn.click({ timeout: 8000 });
  await page.waitForTimeout(5000);
  // verification: screenshot بعد النشر + تأكيد الرابط اتغير/ظهر البوست
  await prisma.job.update({ where: { id: jobId }, data: { status: 'completed', completedAt: new Date(), ... } });
} else {
  // السلوك الحالي (local review) — زي ما هو
  await page.waitForEvent('close', { timeout: 10 * 60 * 1000 }).catch(() => {});
}
```

> **ليه flag مش استبدال:** تحب تفضل قادر تراجع يدويًا على جهازك (`AUTO_POST=false`) وتنشر تلقائي على السيرفر (`AUTO_POST=true`). backward-compatible بالكامل.

> **تحذير دقّة:** زرار "Post" في فيسبوك أحيانًا بيبقى فيه أكتر من زرار بنفس الاسم (مثلًا modal + composer). الأفضل تدوّر عليه **جوه الـ composer dialog** تحديدًا (`page.getByRole('dialog').getByRole('button', { name: /post/i })`) عشان ماتضغطش الغلط. ومهم screenshot **بعد** النشر للإثبات.

> **الـ Vision fallback لزرار Post كمان:** زي post creation بالظبط — لو الـ DOM selector فشل، screenshot → Gemini يطلّع إحداثيات الزرار. نفس الـ hybrid pattern.

---

## 3. 🔒 أمان الـ Encryption Key — لازم يفشل بصوت عالي في production

### المشكلة
[crypto.ts:8](apps/worker/src/lib/crypto.ts#L8):
```ts
const rawKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_32_byte'; // ← fallback ثابت!
const secretKey = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32));
```

مشكلتين:
1. **Fallback key ثابت في الكود:** لو نسيت `ENCRYPTION_KEY` على السيرفر، السيشنات هتتشفّر بمفتاح **معروف للعالم كله** (موجود في الكود). أي حد يقرا الـ DB يفك التشفير.
2. **`padEnd/slice` بيخفي الأخطاء:** مفتاح قصير غلط بيتقبل بصمت. ولو المفتاح اختلف بين connect و publish (أو اتغير) → **كل السيشنات تموت** ومفيش رسالة واضحة.

### الحل (production hardening)
```ts
const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || rawKey.length < 32) {
  throw new Error('ENCRYPTION_KEY must be set and at least 32 bytes in production');
}
const secretKey = crypto.createHash('sha256').update(rawKey).digest(); // 32 byte ثابت ومحدّد
```
- **يفشل عند الإقلاع** لو المفتاح ناقص (مش بصمت وقت النشر).
- `sha256` بيدّي 32 byte حتمية من أي مدخل (أنضف من padEnd/slice).
- **تحذير migration:** أي تغيير في طريقة اشتقاق المفتاح = السيشنات القديمة متقدرش تتفك. مقبول دلوقتي (لسه قليلين) بس لازم re-connect بعد التغيير.

> **hardening لاحق (مش بلوكر):** انتقل لـ AES-256-GCM (بيضيف authentication ضد العبث). دلوقتي CBC من غير HMAC — يشتغل بس مش موثّق.

<!-- PR_P3 -->

---

## 4. 🌐 مخاطرة معمارية الخطة سكتت عنها — Facebook Session + Datacenter IP

دي مش عيب في الخطة بس **لازم تعرفها قبل ما تصرف على سيرفر**، لأنها ممكن تبوّظ الفكرة كلها:

- السيشين بتتولد على **جهازك (IP منزلي)**، وبعدين هتتستخدم من **cloud datacenter IP** (AWS/Render).
- فيسبوك بيرصد ده بقوة: نفس الكوكيز فجأة بتشتغل من IP مركز بيانات في بلد تانية → **"login from new location" / checkpoint / session invalidation**.
- ده السبب الجذري إن أدوات automation كتير بتموت على السيرفر رغم إنها اشتغلت local.

**التخفيفات (بترتيب الأولوية):**
1. **Residential/mobile proxy** ثابت للحساب — الأهم. خلّي الـ datacenter IP ما يلمسش فيسبوك خالص. (Playwright بيدعم proxy في `launch`/`newContext`.)
2. **نفس الـ User-Agent والـ viewport** بين connect و publish (الكود بالفعل ثابت — كويس).
3. **ابدأ بسيرفر في نفس بلد/منطقة الحساب** لو مفيش proxy.

> **توصية:** جرّب أول deploy بحساب **تجريبي مش مهم** (throwaway) — متجربش على حساب حقيقي لحد ما تتأكد إن الـ IP/proxy مش بيتفلغ. ده أرخص درس.

> ده **مش بلوكر للكود** بس بلوكر للنجاح الفعلي — حطه في الحسبان في تكلفة الـ VPS (proxy = تكلفة شهرية إضافية).

---

## 5. Headless Configuration — الصح

### [MODIFY] `apps/worker/src/processor.ts` (النشر — ده اللي يتعمله headless)
```ts
const headless = process.env.HEADLESS === 'true'; // default false (آمن للـ local)
const browser = await chromium.launch({ headless });
```
- **الـ default لازم يكون `false`** (السلوك الحالي) — عشان لو الـ env مش موجودة على جهازك ما يتكسرش.
- الـ headless للـ processor **مربوط بـ `AUTO_POST=true`** (قسم 2) — من غير auto-post، الـ headless مالوش لازمة.

### [MODIFY] `apps/worker/src/connect.ts` (اللوجن — ده يفضل headed دايمًا)
```ts
const browser = await chromium.launch({ headless: false }); // سيبه زي ما هو
```
- **متضفش `HEADLESS` للـ connect.** الـ connect محتاج إنسان يعمل لوجن يدوي — headless هيخليه أعمى.
- لو خفت حد يحط `HEADLESS=true` عالمي، خلي الـ connect يتجاهله صراحةً (hardcoded `false`) — أأمن من إنه يقرا env مشترك.

> **الخلاصة:** الـ `HEADLESS` env يخص **الـ processor بس**. الخطة الأصلية كانت هتحطه على الاتنين — ده غلط.

---

## 6. Docker — الصح (خدمات منفصلة، مش كونتينر واحد)

3 خدمات بطبائع مختلفة → **ما ينفعش Dockerfile واحد بـ startup commands**. القاعدة: كونتينر = process واحد.

| الخدمة | بتحتاج متصفح؟ | الصورة الأساس المناسبة |
|--------|:---:|------------------------|
| `api` (Express) | ❌ | `node:20-slim` (خفيفة) |
| `web` (Next.js) | ❌ | `node:20-slim` + `output: 'standalone'` |
| `worker` (Playwright) | ✅ | `mcr.microsoft.com/playwright:v1.41.x-jammy` |

### [MODIFY] `apps/web/next.config.ts` — شرط للـ Docker image خفيفة
```ts
const nextConfig: NextConfig = {
  output: 'standalone', // ضروري: يطلّع bundle مستقل صغير للـ Docker
};
```

### [NEW] `apps/worker/Dockerfile` — ده الوحيد على صورة Playwright
```dockerfile
FROM mcr.microsoft.com/playwright:v1.41.2-jammy   # طابق نسخة playwright في package.json
WORKDIR /app
COPY package*.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci
COPY . .
RUN npm run build --workspace=@saas/shared && npm run build --workspace=@saas/worker
CMD ["node", "apps/worker/dist/index.js"]
```

### [NEW] `apps/api/Dockerfile` و `apps/web/Dockerfile`
- نفس النمط بس على `node:20-slim` (من غير متصفح).
- **الـ api لازم يعمل `npx prisma generate`** في الـ build (الـ Prisma client بيتولّد).

> **⚠️ Prisma في production:** إنتوا بتستخدموا `prisma db push` (من الخطط السابقة). ده للـ dev. في production استخدم **`prisma migrate deploy`** بملفات migration حقيقية. حدّد الـ migration بيتعمل امتى (release step قبل ما الـ api يشتغل) — مش جوه كل كونتينر.

### [MODIFY] `docker-compose.yml` (الموجود) — أضف الخدمات اختياريًا
الملف الحالي فيه Postgres + Redis بس. ممكن تضيف الـ 3 apps للـ **local production-simulation**. بس **في production حقيقي على Render/AWS** الأغلب هتستخدم **Postgres/Redis مُدارين** (managed) مش containers — فخلّي الـ compose ده لـ **local بس**، ووضّح كده بتعليق فوقه.

> **مهم:** كلمات السر في الـ compose الحالي (`password123`) **local-only**. متستخدمهاش في production — استخدم secrets/managed DB.

### [NEW] `.dockerignore`
```
node_modules
**/dist
**/.next
**/.env
screenshots
poc
```
> `poc/` فيها `node_modules` كاملة و`.env` — لازم تتستبعد.

---

## 7. Environment Variables — [NEW] `.env.example` (مش MODIFY، مش موجود)

في الروت، موثّق ومقسّم حسب الخدمة:
```dotenv
# ---- Shared / Infra ----
DATABASE_URL="postgresql://admin:CHANGE_ME@localhost:5432/saas_automation"
REDIS_URL="redis://127.0.0.1:6379"

# ---- Security (worker + api) ----
# مفتاح تشفير السيشنات. لازم ≥ 32 حرف. لو مش موجود، الـ worker/api يفشل عند الإقلاع (قسم 3).
# ولّده بـ: openssl rand -hex 32
ENCRYPTION_KEY=""

# ---- Worker ----
GEMINI_API_KEY=""          # مطلوب — الـ Vision fallback ([processor.ts:22])
HEADLESS="false"           # true على السيرفر فقط (مع AUTO_POST=true)
AUTO_POST="false"          # true على السيرفر: ينشر تلقائي بدل ما يستنى إنسان (قسم 2)
# PROXY_URL=""             # اختياري بس موصى به بشدة على السيرفر (قسم 4)

# ---- Web ----
NEXT_PUBLIC_API_URL="http://localhost:PORT"   # رابط الـ api اللي الـ frontend بيكلّمه
```
- **الـ `GEMINI_API_KEY` و`ENCRYPTION_KEY` أسرار** — متحطهمش في الـ image، مررهم runtime (compose env / Render secrets).
- في الـ `.env` الفعلية دلوقتي بتتقرأ من `apps/api/.env` و`apps/worker/.env` منفصلين — قرر تحافظ على ده ولا توحّدهم في root `.env`.

---

## 8. مراحل التنفيذ (بالترتيب)

**Phase A — Auto-Post (البلوكر الحقيقي، قسم 2):**
- `processor.ts`: `AUTO_POST` flag + منطق الضغط على Post + verification. اختبر local بـ `AUTO_POST=true` **و`HEADLESS=false`** (تشوفه بيضغط بعينك) قبل ما تخفيه.
- ✅ من غير ده، مفيش نشر على السيرفر أصلًا.

**Phase B — Headless + Key hardening (قسم 3 و5):**
- `crypto.ts`: fail-fast على المفتاح + `sha256` derive. **re-connect حساب واحد للاختبار.**
- `processor.ts`: `HEADLESS` flag (default false). `connect.ts` يفضل headed.

**Phase C — Docker (قسم 6):**
- `next.config.ts`: `output: 'standalone'`.
- 3 Dockerfiles (worker على playwright، api/web على node-slim) + `.dockerignore`.
- Prisma: قرار `migrate deploy` بدل `db push`.

**Phase D — Compose + env docs (قسم 6 و7):**
- `docker-compose.yml`: أضف الـ apps للـ local-sim + وضّح إنه local.
- `.env.example` جديدة.

**Phase E — Deploy تجريبي (قسم 4):**
- حساب throwaway + proxy → اختبر السيشين بتصمد من الـ datacenter IP.
- لو صمد → انقل لحساب حقيقي.

---

## 9. Verification Plan (مصحّح)

1. **local, headed, auto-post:** `AUTO_POST=true HEADLESS=false` → شوف الـ worker بيضغط Post فعلًا وينجح. (خطوة خطتك رقم 2 "background without window" **مش صح دلوقتي** — لازم Phase A الأول.)
2. **local, headless:** `HEADLESS=true AUTO_POST=true` → البوست يتنشر من غير نافذة، والـ job يبقى `completed` (مش معلّق).
3. **key fail-fast:** شيل `ENCRYPTION_KEY` → الـ worker **يرفض يقلع** برسالة واضحة (مش fallback صامت).
4. **docker build:** الـ 3 images تتبني من غير errors. اتأكد نسخة Playwright في الصورة = اللي في `package.json` (1.41.x).
5. **connect لسه headed:** حتى مع `HEADLESS=true` في البيئة، الـ connect يفتح نافذة مرئية للّوجن.
6. **deploy تجريبي:** حساب throwaway على السيرفر → السيشين تصمد وتنشر (يثبت مسألة الـ IP/proxy).

---

## 10. ملخص القرارات

- 🔴 **Auto-Post الأول** — التدفّق الحالي بيقف ويستنى إنسان يقفل المتصفح؛ headless من غير auto-post = تعليق 10 دقايق ومفيش نشر. ده أكبر شغلانة، مش مجرد toggle.
- 🔒 **الـ key يفشل بصوت عالي** — شيل الـ fallback الثابت، fail-fast + sha256 derive.
- 🌐 **الـ datacenter IP خطر حقيقي على سيشين فيسبوك** — خطّط لـ proxy واختبر بحساب throwaway. تكلفة إضافية في الـ VPS.
- 🐳 **خدمات Docker منفصلة** — worker بس على صورة Playwright (1.41.x، مش 1.40)؛ api/web على node-slim + `output: 'standalone'`.
- `HEADLESS` للـ **processor بس**؛ الـ connect يفضل headed دايمًا.
- `docker-compose.yml` **موجود** (MODIFY)؛ `.env.example` **مش موجود** (NEW) ولازم يضم `GEMINI_API_KEY`.
- Prisma: `migrate deploy` في production مش `db push`.
- ✅ الـ decrypt bug القديم **اتصلّح خلاص** — النشر بعد re-connect شغّال.




