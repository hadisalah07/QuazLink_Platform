# SaaS Automation Platform — Architecture

> منصة automation شبه n8n، بس التنفيذ عن طريق **AI Agent بيشوف المتصفح ويضغط الأزرار فعليًا** (Playwright/Stagehand) — **من غير أي API رسمي** للمنصات.
>
> **First vertical:** Social Media Posting
> **Stack:** TypeScript (Node) end-to-end — Stagehand + Playwright + Claude

---

## 1. المبادئ الأساسية (Design Principles)

هذه القرارات تحكم كل باقي التصميم:

1. **Session طويلة العمر لكل حساب** — نعمل login مرة واحدة ونحفظ الـ cookies. ممنوع تسجيل دخول متكرر (أكبر سبب للـ ban).
2. **Template-first, AI-fallback** — خطوات ثابتة معروفة لكل منصة، والـ AI Agent يتدخل فقط في الحالات غير المتوقعة (popup, زرار اتغيّر). مش AI في كل خطوة.
3. **عزل كامل لكل حساب** — كل حساب = browser context + proxy + fingerprint ثابتين، يبان كأنه نفس الجهاز كل مرة.
4. **Queue-based من اليوم الأول** — كل مهمة = job في طابور، للتحكم في rate-limiting والـ retries والـ scaling.
5. **كل تنفيذ لازم يتأكّد من نفسه (verification)** — بعد النشر ناخد screenshot ونتحقق إن البوست ظهر فعلًا.

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│   Workflow Builder (React Flow) · Post Composer · Accounts · Logs   │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ REST / WebSocket
┌───────────────────────────────▼────────────────────────────────────┐
│                        API / BACKEND (Node)                         │
│   Auth · Campaigns · Accounts API · Scheduler · Job Producer        │
└───┬───────────────┬───────────────────┬───────────────┬────────────┘
    │               │                   │               │
    ▼               ▼                   ▼               ▼
┌────────┐   ┌──────────────┐   ┌───────────────┐  ┌──────────────┐
│Postgres│   │ Session Vault│   │  Job Queue     │  │ Object Store │
│(state) │   │ (encrypted   │   │  (BullMQ+Redis)│  │ (S3: media)  │
│        │   │  cookies)    │   │                │  │              │
└────────┘   └──────┬───────┘   └───────┬────────┘  └──────────────┘
                    │                   │
                    │           ┌───────▼────────┐
                    │           │  WORKER POOL   │  (يسحب jobs)
                    │           └───────┬────────┘
                    │                   │
                    └──────────────►┌───▼──────────────────────────┐
                                    │      AI AGENT RUNNER          │
                                    │  Stagehand + Claude           │
                                    │  Template Engine + AI fallback│
                                    └───────────┬───────────────────┘
                                                │ act/extract/observe
                                    ┌───────────▼───────────────────┐
                                    │   BROWSER EXECUTION LAYER      │
                                    │  Playwright + Stealth          │
                                    │  (Browserbase أو self-hosted)  │
                                    └───────────┬───────────────────┘
                                                │
                                    ┌───────────▼───────────────────┐
                                    │        PROXY LAYER             │
                                    │  Residential proxy لكل حساب    │
                                    └───────────┬───────────────────┘
                                                │
                                    ┌───────────▼───────────────────┐
                                    │   Facebook / Instagram / ...   │
                                    └────────────────────────────────┘
```

---

## 3. الـ Components بالتفصيل

### 3.1 Frontend (React)
- **Workflow Builder**: drag-and-drop زي n8n (مكتبة `React Flow`). كل node = خطوة (مثلًا "انشر على فيسبوك").
- **Post Composer**: كتابة النص، رفع الصور/الفيديو، اختيار المنصات والميعاد.
- **Accounts Page**: ربط الحسابات ومتابعة حالتها (connected / expired / needs re-login).
- **Runs & Logs**: متابعة كل تنفيذ + الـ screenshots كإثبات.

### 3.2 API / Backend (Node)
- Auth & multi-tenancy (كل عميل معزول).
- CRUD للـ campaigns والـ posts والـ accounts.
- **Scheduler**: يحوّل البوستات المجدولة لـ jobs في وقتها.
- **Job Producer**: يحط المهام في الطابور.

### 3.3 Postgres — مصدر الحقيقة (state)
الجداول الأساسية:
- `users`, `organizations`
- `social_accounts` — الحسابات المربوطة + حالتها + مرجع للـ session
- `campaigns`, `posts` — المحتوى والمواعيد
- `jobs` — كل تنفيذ + حالته + النتيجة + مرجع للـ screenshot
- `platform_templates` — خطوات كل منصة (نسخة/version)

### 3.4 Session Vault (مشفّر)
- تخزين cookies + fingerprint لكل حساب، **encrypted at rest**.
- أنظر [قسم 5](#5-session-management-deep-dive) للتفصيل الكامل.

### 3.5 Job Queue (BullMQ + Redis)
- طابور لكل نوع مهمة.
- بيدّي: **rate limiting** (عدد بوستات/ساعة لكل حساب)، **retries** مع backoff، **concurrency control**.
- **مهم:** الـ rate limit لكل حساب مش عام — كل حساب له سقفه.

### 3.6 AI Agent Runner
- العقل المدبّر. بياخد job → يشغّل الـ template → يستدعي الـ AI عند اللزوم.
- أنظر [قسم 6](#6-agent--templates-deep-dive).

### 3.7 Browser Execution Layer
- كل job بيفتح **browser context معزول** بالـ session والـ proxy بتاع الحساب.
- **البداية:** Browserbase (hosted stealth) لتوفير وجع الـ infra. **التوسّع:** self-hosted (Playwright + `patchright`/`playwright-stealth` في containers).

### 3.8 Proxy Layer
- **Residential proxy ثابت لكل حساب** (مش datacenter). زي Bright Data / IPRoyal.
- الحساب لازم يبان دايمًا من نفس البلد/الـ IP-range.

---

## 4. Data Flow — من "اعمل بوست" لحد "اتنشر"

```
(1) المستخدم يكتب بوست + يختار الحسابات + الميعاد
        │
        ▼
(2) Backend يخزّن الـ post في Postgres (status: scheduled)
        │
        ▼
(3) Scheduler يوصل ميعاده → ينشئ Job لكل (post × account)
        │            job = { postId, accountId, platform }
        ▼
(4) Job يدخل الطابور (BullMQ) — بيحترم rate-limit الحساب
        │
        ▼
(5) Worker يسحب الـ Job:
        ├─ يجيب الـ session من الـ Vault (يفك التشفير)
        ├─ يجيب الـ proxy + fingerprint بتاع الحساب
        └─ يفتح browser context بالكل
        │
        ▼
(6) AI Agent Runner:
        ├─ يحمّل template المنصة (خطوات النشر)
        ├─ ينفّذ خطوة خطوة (Stagehand act/extract)
        ├─ لو خطوة فشلت → AI fallback يحلها
        └─ يرفع الصور، يكتب النص، يدوس Post
        │
        ▼
(7) Verification: screenshot + تأكيد إن البوست ظهر
        │
        ▼
(8) تحديث Job (success/failed) + حفظ الـ screenshot في S3
        │
        ▼
(9) Frontend يعرض النتيجة + الإثبات (real-time عبر WebSocket)
```

---

## 5. Session Management — Deep Dive

ده أهم جزء في المنصة كلها. لو الـ session management غلط، الحسابات هتتباظ.

### المبدأ: Login مرة واحدة، واستخدم الـ session للأبد (تقريبًا)

المنصات بتكره حاجتين: (1) تسجيل دخول متكرر، (2) نفس الجهاز بيدخل من IPs مختلفة.
الحل: **نعمل login مرة، ونحفظ كل حاجة، ونعيد استخدامها بنفس الظروف بالظبط.**

### مرحلة الربط (Connect Account) — مرة واحدة

```
المستخدم يدوس "Connect Facebook"
        │
        ▼
Backend يفتح browser context جديد + يخصّص:
        ├─ residential proxy (هيفضل ثابت للحساب ده)
        └─ fingerprint (userAgent, viewport, timezone, locale...)
        │
        ▼
المستخدم بنفسه يعمل login جوّه الـ browser (نشوفه live عبر VNC/stream)
        ├─ يدخل username + password بنفسه
        └─ يعدّي الـ 2FA بنفسه
        │  ⚠️ إحنا ما بنخزّنش الباسورد إطلاقًا
        ▼
بعد نجاح الدخول، Backend يستخرج:
        ├─ cookies (الأهم)
        ├─ localStorage / sessionStorage
        └─ الـ storage state كامل (Playwright: context.storageState())
        │
        ▼
يشفّر الكل (AES-256) ويخزّنه في الـ Vault:
        social_account = {
          id, userId, platform,
          encryptedStorageState,   // cookies + storage
          fingerprint,             // نفسه كل مرة
          proxyId,                 // نفسه كل مرة
          status: 'active',
          lastUsedAt, lastValidatedAt
        }
```

### مرحلة الاستخدام (كل job)

```
Worker ياخد الـ accountId
        │
        ▼
يجيب من الـ Vault: storageState + fingerprint + proxy
        │
        ▼
يفتح context بالظبط بنفس الظروف:
        browser.newContext({
          storageState: decrypted,   // بيرجّع الـ session
          proxy, userAgent, viewport, timezone, locale
        })
        │
        ▼
الصفحة بتفتح وهو مسجّل دخول خلاص — من غير login
        │
        ▼
بعد الشغل: نحدّث الـ storageState المخزّن
        (الـ cookies بتتجدد، فلازم نحفظ الجديد)
```

### نقاط حرجة

| النقطة | التفصيل |
|--------|---------|
| **متعملش login أوتوماتيك** | المستخدم يعمله بنفسه. auto-login = أسرع طريق للـ ban. |
| **متخزّنش الباسورد** | إحنا بنخزّن الـ session بس. أأمن قانونيًا وأمنيًا. |
| **fingerprint ثابت** | لو غيّرت الـ userAgent أو الـ timezone، المنصة تشك. |
| **proxy ثابت** | نفس الـ IP (أو نفس الـ range) لكل حساب دايمًا. |
| **جدّد الـ storageState** | بعد كل جلسة، احفظ الـ cookies المحدّثة. |
| **Health check دوري** | افتح الحساب بهدوء كل فترة، تأكد لسه logged-in. لو لأ → status = 'needs_relogin' وبلّغ المستخدم. |
| **Encryption at rest** | AES-256، والمفتاح في KMS/Vault مش في الكود. |

### دورة حياة الحساب (Account Lifecycle)

```
active ──(session expired / logout)──► needs_relogin
active ──(banned/checkpoint)─────────► flagged  → بلّغ المستخدم فورًا
needs_relogin ──(user re-connects)───► active
```

---

## 6. Agent + Templates — Deep Dive

### الفكرة الجوهرية: مش الـ AI بيعمل كل حاجة

لو سِبت الـ AI يكتشف كل خطوة من الصفر كل مرة:
- **غالي** (tokens كتير كل نشرة)
- **بطيء** (كل خطوة = round-trip للموديل)
- **غير مستقر** (ممكن ياخد قرار غلط)

الحل: **Template بيحدد الخطوات المعروفة، والـ AI يتدخل بس لما حاجة تكسر.**

### شكل الـ Template (خطوات النشر في منصة)

الـ template = وصفة declarative لكل منصة. مثال مبسّط لفيسبوك:

```jsonc
{
  "platform": "facebook",
  "version": 7,               // نعمل version عشان الـ UI بيتغير
  "task": "create_post",
  "steps": [
    { "id": "goto",        "action": "navigate", "url": "https://facebook.com" },
    { "id": "open_composer","action": "click",   "target": "زرار What's on your mind" },
    { "id": "type_text",   "action": "type",     "target": "منطقة كتابة البوست", "value": "{{postText}}" },
    { "id": "upload_media","action": "upload",   "target": "زرار Photo/Video", "value": "{{mediaFiles}}",
      "optional": true },
    { "id": "publish",     "action": "click",    "target": "زرار Post" },
    { "id": "verify",      "action": "verify",   "expect": "البوست ظهر في الـ feed" }
  ]
}
```

> **ملاحظة:** الـ `target` مكتوب بالمعنى مش بالـ CSS selector. Stagehand بيترجم الوصف ده لعنصر فعلي في الصفحة — وده اللي بيخلّي الـ template يصمد لما الـ UI يتغيّر.

### الـ Execution Loop — إزاي الـ Template والـ AI يتعاونوا

```
لكل step في الـ template:
        │
        ▼
    جرّب تنفّذها بالطريقة السريعة (Stagehand act على الـ target)
        │
        ├─ نجحت؟ ──► الخطوة اللي بعدها ✅
        │
        └─ فشلت / العنصر مش لاقيه؟
                │
                ▼
        🧠 AI FALLBACK يتفعّل:
                ├─ ياخد screenshot + accessibility tree
                ├─ يفهم "أنا عايز أعمل الخطوة الفلانية"
                ├─ يقرر: العنصر فين دلوقتي؟ فيه popup؟ الزرار اتغير؟
                ├─ ينفّذ الحل (يقفل الـ popup، يلاقي الزرار الجديد)
                └─ يكمّل من نفس النقطة
                │
                ├─ AI نجح؟ ──► كمّل + سجّل التغيير (ممكن نحدّث الـ template)
                │
                └─ AI فشل برضه؟ ──► وقف، سجّل screenshot، status = failed
                                     + نبّه إن template المنصة محتاج مراجعة
```

### مستويات إدراك الـ Agent (Perception)

الـ Agent بيشوف الصفحة بطريقتين حسب الحاجة:

1. **DOM / Accessibility tree** (الأساسي): سريع ورخيص. Stagehand بيستخدمه أول.
2. **Vision / Screenshot** (fallback): لما الـ DOM ما يكفيش (canvas, عناصر معقدة). أغلى بس أقوى.

**Hybrid:** DOM الأول، وvision عند الحاجة. ده بيوازن بين التكلفة والقدرة.

### ليه ده أذكى تصميم

| بدون templates (AI بيعمل كله) | مع Template-first + AI-fallback |
|-------------------------------|--------------------------------|
| غالي جدًا (tokens كل خطوة) | رخيص (AI عند الأعطال بس) |
| بطيء | سريع (الخطوات المعروفة فورية) |
| غير متوقّع | مستقر + متوقّع |
| بيتكسر مع تغيّر الـ UI | يتأقلم (AI بيصلّح + بيحدّث الـ template) |

### الـ Self-Healing (ميزة قوية)

لما الـ AI fallback يلاقي إن زرار اتغيّر وينجح في إيجاد البديل:
- نسجّل ده كـ **suggested template update**.
- بعد ما يتكرر أو يتأكّد، نعمل **version جديد للـ template أوتوماتيك**.
- كده المنصة **بتتعلّم وتتصلّح لوحدها** مع تغيّرات المنصات.

<!-- PLACEHOLDER_TECH -->
