# Bucket #1 — Security + Double-Post Prevention (Implementation Plan)

> **You implement this; I wait.** Every step below is copy-paste precise: exact file, exact
> "find this → replace with this". Tell me when you finish (or hit anything odd) and we move to
> bucket #2 (migration drift).
>
> **No database migration is needed for this whole bucket.** `Job.status` is a free-form `String`
> column, so the two new states (`dispatched`, `posting`) need no schema change. Migrations are
> bucket #2.

---

## ⚠️ Before you touch anything: flip AUTO_POST off while you work

You are editing the exact code path that clicks **Post** on a **real client page** (irreversible).
While implementing/testing this bucket, set in **`apps/worker/.env`**:

```
AUTO_POST=false
```

This forces the worker into "prepare + wait for manual click" mode, so a bug in the refactor can
**never** auto-publish. Turn it back to `true` only for a **deliberate, confirmed** live test at the end.

---

## The status model (what the states mean after this bucket)

| Status | Meaning | Claimable? |
|---|---|---|
| `pending` | Created, not yet taken by any runner | ✅ yes (exactly one path may take it) |
| `dispatched` | Sent to the user's Desktop Runner, awaiting result | ❌ no |
| `active` | Cloud worker has it, browser is running | ❌ no |
| `posting` | Point of no return — Post button is being/was clicked | ❌ no |
| `prepared` | Composer filled, waiting for a human to click Post | ❌ no |
| `completed` / `posted_unconfirmed` / `failed` | Terminal | ❌ no |

**The whole double-post fix is one idea:** a job can only be picked up while it is `pending`, and
picking it up is a **single atomic UPDATE** that flips it out of `pending`. Whoever wins the flip
runs it; everyone else sees "not pending" and backs off. This closes all three double-post paths
the audit found (worker stall-recovery, runner re-dispatch on reconnect, and cloud+runner racing
the same job).

*(Optional, doc-only)* update the comment on `Job.status` in `apps/api/prisma/schema.prisma:72` to
list the new states so the vocabulary is documented in one place.

---

## PART 1 — Double-post prevention (highest priority)

### 1.1 — Cloud worker: atomic claim instead of read-then-write

**File:** `apps/worker/src/processor.ts` (around lines 213–227)

**Find this:**
```ts
    // IDEMPOTENCY GUARD — publishing is irreversible. If this job already
    // reached a published/terminal state, NEVER run it again: a re-run (BullMQ
    // retry, stall recovery, or a stray duplicate) would re-click Post and
    // duplicate the post on the client's real page.
    const existing = await prisma.job.findUnique({ where: { id: jobId } });
    if (existing && ['completed', 'posted_unconfirmed', 'failed'].includes(existing.status)) {
      console.log(`⏭️ Job ${jobId} is already "${existing.status}" — skipping to avoid double-posting.`);
      return;
    }

    // Mark job active in the DB
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'active', startedAt: new Date() },
    });
```

**Replace with:**
```ts
    // ATOMIC CLAIM — publishing is irreversible, so exactly ONE runner may take a
    // job. Flip pending -> active in a single UPDATE and check we won the race.
    // Any job that is already dispatched/active/posting/prepared/terminal returns
    // count 0 here and is skipped. This closes the "stall recovery re-clicks Post"
    // window: after a crash mid-publish the status is NOT pending, so the re-run
    // refuses to run.
    const claim = await prisma.job.updateMany({
      where: { id: jobId, status: 'pending' },
      data: { status: 'active', startedAt: new Date() },
    });
    if (claim.count === 0) {
      const cur = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
      console.log(`⏭️ Job ${jobId} not claimable (status="${cur?.status ?? 'missing'}") — skipping to avoid double-posting.`);
      return;
    }
```

### 1.2 — Cloud worker: "point of no return" marker right before the click

**File:** `apps/worker/src/processor.ts` (around lines 486–488)

**Find this:**
```ts
        } else {
          await postBtn.click();
          console.log('🖱️ [AUTO-POST] Clicked "Post". Facebook is publishing (this can take a while with images)...');
```

**Replace with:**
```ts
        } else {
          // Point of no return: mark 'posting' the instant before we click, so if
          // the process dies during/after the click, the atomic claim in 1.1 sees a
          // non-pending status on re-entry and refuses to click Post a second time.
          await prisma.job.update({ where: { id: jobId }, data: { status: 'posting' } });
          await postBtn.click();
          console.log('🖱️ [AUTO-POST] Clicked "Post". Facebook is publishing (this can take a while with images)...');
```

### 1.3 — Runner dispatch: claim atomically before sending

**File:** `apps/api/src/ws/gateway.ts` — function `dispatchJobToLocalRunner` (around lines 201–234)

**Find this:**
```ts
  // Pick the first available active socket
  const [deviceId, socket] = Array.from(userDevices.entries())[0];
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  // Security: Generate HMAC signature with timestamp TTL (30 seconds)
```

**Replace with:**
```ts
  // Pick the first available active socket
  const [deviceId, socket] = Array.from(userDevices.entries())[0];
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  // ATOMIC CLAIM — flip pending -> dispatched before sending. If the job is no
  // longer pending (another path already took it, or a duplicate reconnect is
  // re-dispatching), do NOT send it again — this prevents a double dispatch.
  const claim = await prisma.job.updateMany({
    where: { id: jobData.id, status: 'pending' },
    data: { status: 'dispatched' },
  });
  if (claim.count === 0) {
    console.log(`⏭️ Job ${jobData.id} not pending — skipping runner dispatch (already claimed).`);
    return false;
  }

  // Security: Generate HMAC signature with timestamp TTL (30 seconds)
```

> **Why this is safe with `posts.ts`:** if the claim fails and `dispatchJobToLocalRunner` returns
> `false`, `posts.ts` falls back to enqueuing on the cloud queue — but the cloud worker's own
> atomic claim (step 1.1, `where status: 'pending'`) will also find count 0 and skip. Two claim
> gates on the same `pending` state means only one path ever runs the job.

> **Known tradeoff (acceptable, note it):** a job flipped to `dispatched` whose runner then dies
> before reporting back stays `dispatched` (reconcile only picks up `pending` — see 1.4), so it
> won't auto-retry. For an irreversible action, **stuck-safe beats double-post.** We'll add a
> manual "reset to pending" action for stuck jobs in a later bucket.

### 1.4 — Reconcile only re-dispatches `pending` (confirm — no change if already so)

**File:** `apps/api/src/ws/gateway.ts` — function `reconcilePendingJobs` (around lines 243–255)

Confirm the query filters on `status: 'pending'` (it currently does). Leave it as-is:
```ts
    const pendingJobs = await prisma.job.findMany({
      where: {
        status: 'pending',
        post: { campaign: { userId } },
      },
```
With 1.3 in place, each reconciled job is atomically flipped to `dispatched` as it's sent, so a
second reconnect can't re-send the same job. **No edit needed here — just verify.**

### 1.5 — API-side target safety (compose path)

**File:** `apps/api/src/routes/posts.ts` (the ownership guard around lines 22–28)

**Find this:**
```ts
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId },
      select: { id: true },
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
```

**Replace with:**
```ts
    const account = await prisma.socialAccount.findFirst({
      where: { id: socialAccountId, userId },
      select: { id: true, destinations: true },
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Target safety: never let an empty/foreign URL silently fall back to the
    // personal timeline in the worker. Require the target to be one of THIS
    // account's detected page destinations.
    const destinations = Array.isArray(account.destinations) ? (account.destinations as any[]) : [];
    if (!targetUrl || !destinations.some((d) => d?.url === targetUrl)) {
      return res.status(400).json({ error: 'A valid target page is required (must be one of the account destinations).' });
    }
```

> The Compose UI already sends `targetUrl` from `account.destinations`, so the happy path is
> unchanged. This just rejects an empty/foreign target instead of defaulting to the personal feed.

### 1.6 — Worker-side target safety net (covers every path)

**File:** `apps/worker/src/processor.ts` (line ~435)

**Find this:**
```ts
      const autoPost = process.env.AUTO_POST === 'true';
```

**Replace with:**
```ts
      // Never auto-post without an explicit target — a missing targetUrl would
      // fall back to https://www.facebook.com (the personal timeline). Only the
      // deterministic, human-intended Page URL may be auto-published to.
      const autoPost = process.env.AUTO_POST === 'true' && !!targetUrl;
      if (process.env.AUTO_POST === 'true' && !targetUrl) {
        console.log('🛑 [AUTO-POST] Skipped: no targetUrl on this job — falling back to manual review.');
      }
```

This is the backstop for the legacy `POST /api/jobs` route too (it enqueues without a `targetUrl`),
so those jobs can never auto-post to the wrong surface.

---

## PART 2 — Kill the hardcoded secret fallbacks

### 2.1 — JWT secret: fail loudly instead of using a committed key

**File:** `apps/api/src/lib/auth.ts` (lines 17–23)

**Find this:**
```ts
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'null' || secret === 'undefined' || secret === '') {
    return 'ql_jwt_super_secret_production_key_2026_x89a';
  }
  return secret;
}
```

**Replace with:**
```ts
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET is missing or too short. Refusing to sign/verify with an insecure fallback — set it in the API .env.');
  }
  return secret;
}
```

> `apps/api/.env` already has a real `JWT_SECRET`, so dev keeps working. This only guarantees a
> misconfigured **production** deploy fails fast instead of silently signing forgeable tokens.

### 2.2 — Encryption key: require it (⚠️ keep the SAME value)

> **DANGER — read first.** Your live Facebook session (`SocialAccount.encryptedStorageState`) and
> catalog keys are encrypted with the constant `default_secret_key_needs_32_byte`. **Do NOT change
> the value** — that would orphan those rows and break the real publish flow. We are only removing
> the *silent code fallback*, not rotating the key.

**Step A —** make the key explicit in **both** env files (same value that's already in use):

- `apps/api/.env` — already has `ENCRYPTION_KEY=default_secret_key_needs_32_byte` ✅ (verify it's there)
- `apps/worker/.env` — **add the same line** (it's currently missing, so the worker is silently on the fallback):
  ```
  ENCRYPTION_KEY=default_secret_key_needs_32_byte
  ```

**Step B —** remove the fallback in **both** copies of crypto.ts:
`apps/api/src/lib/crypto.ts` **and** `apps/worker/src/lib/crypto.ts` (identical files, line ~8).

**Find this (in each file):**
```ts
// Ensure a 32-byte key is used. If ENCRYPTION_KEY is not set or not 32 bytes, fallback to a default (for local dev only).
const rawKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_32_byte';
```

**Replace with (in each file):**
```ts
// ENCRYPTION_KEY must be set explicitly — no fallback. It must match the value
// the existing encrypted rows were written with, or they won't decrypt.
const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || rawKey.length < 32) {
  throw new Error('ENCRYPTION_KEY must be set to a 32+ char secret (matching existing encrypted rows).');
}
```

### 2.3 — Runner dispatch signing secret (⚠️ verify the agent first — do LAST)

**File:** `apps/api/src/ws/gateway.ts` (line ~217)

**Find this:**
```ts
  const secret = process.env.ENCRYPTION_KEY || 'default_runner_secret_key_32_bytes_len';
```

**Replace with:**
```ts
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    console.error('❌ Cannot sign runner dispatch: ENCRYPTION_KEY not set.');
    return false;
  }
```

> **Before doing this one:** check what secret `apps/desktop-agent` uses to *verify* the signature.
> If the agent currently verifies against `default_runner_secret_key_32_bytes_len`, changing the
> server side will break dispatch to your paired device. Make both sides use `ENCRYPTION_KEY` (or a
> dedicated shared `RUNNER_SIGNING_SECRET`) together. This is the lowest-priority security item —
> do it after 2.1/2.2 and only once you've confirmed the agent side.

---

## PART 3 — CORS + WebSocket ownership

### 3.1 — CORS: stop reflecting every origin

**File:** `apps/api/src/server.ts` (lines 27–34)

**Find this:**
```ts
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);
```

**Replace with:**
```ts
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin, curl, server-to-server, or WS upgrade — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
```

> `allowedOrigins` is already built at the top of the file (localhost:3000, app.quazlink.site,
> quazlink.site, `WEB_ORIGIN`). **Before deploying**, make sure every real front-end origin you use
> is in that list, or its requests will be blocked.

### 3.2 — WebSocket: a device may only touch its owner's jobs

**File:** `apps/api/src/ws/gateway.ts` — the `job:completed` and `job:failed` handlers (lines ~139–162)

**Find this:**
```ts
          if (msg.type === 'job:completed') {
            console.log(`✅ Job #${msg.jobId} Completed by Desktop Runner!`);
            await prisma.job.update({
              where: { id: msg.jobId },
              data: {
                status: 'completed',
                completedAt: new Date(),
                screenshotUrl: msg.screenshotUrl || null,
                result: msg.result || 'Published successfully via Local Runner',
              },
            });
          }

          if (msg.type === 'job:failed') {
            console.error(`❌ Job #${msg.jobId} Failed on Runner: ${msg.error}`);
            await prisma.job.update({
              where: { id: msg.jobId },
              data: {
                status: 'failed',
                completedAt: new Date(),
                result: msg.error || 'Execution failed on local runner',
              },
            });
          }
```

**Replace with:**
```ts
          if (msg.type === 'job:completed' && typeof msg.jobId === 'string') {
            console.log(`✅ Job #${msg.jobId} Completed by Desktop Runner!`);
            // Scope the update to jobs THIS device's user owns — a runner must not
            // be able to mutate another tenant's job by guessing an id.
            const scoped = await prisma.job.updateMany({
              where: { id: msg.jobId, post: { campaign: { userId: ws.userId } } },
              data: {
                status: 'completed',
                completedAt: new Date(),
                screenshotUrl: msg.screenshotUrl || null,
                result: msg.result || 'Published successfully via Local Runner',
              },
            });
            if (scoped.count === 0) {
              console.warn(`⚠️ Device ${ws.deviceId} reported completion for job ${msg.jobId} it does not own — ignored.`);
            }
          }

          if (msg.type === 'job:failed' && typeof msg.jobId === 'string') {
            console.error(`❌ Job #${msg.jobId} Failed on Runner: ${msg.error}`);
            const scoped = await prisma.job.updateMany({
              where: { id: msg.jobId, post: { campaign: { userId: ws.userId } } },
              data: {
                status: 'failed',
                completedAt: new Date(),
                result: msg.error || 'Execution failed on local runner',
              },
            });
            if (scoped.count === 0) {
              console.warn(`⚠️ Device ${ws.deviceId} reported failure for job ${msg.jobId} it does not own — ignored.`);
            }
          }
```

---

## Verification checklist (after implementing)

Run `npx tsc --noEmit` in `apps/api` and `apps/worker` — both should exit 0.

**Double-post (the important one):**
- [ ] Create a post from Compose → a `Job` row appears. While it's `active`/`prepared`, manually
      re-add the same `jobId` to the queue (or restart the worker mid-run) → worker logs
      `not claimable … skipping`, and **no second Post click** happens.
- [ ] With a Desktop Runner paired: create a post → job goes `dispatched`, runner posts once.
      Disconnect+reconnect the runner → reconcile does **not** re-send it (it's not `pending`).
- [ ] A post with no/foreign `targetUrl` → API returns 400 (compose path); a legacy job with no
      target → worker logs `Skipped: no targetUrl` and never auto-posts.

**Security:**
- [ ] Temporarily unset `JWT_SECRET` → API throws on any auth call (then restore it).
- [ ] `ENCRYPTION_KEY` present in **both** `.env` files with the **same** value → existing FB
      session still decrypts (connect an account / run a job and confirm no decrypt error).
- [ ] A request from a random `Origin` is rejected; `localhost:3000` still works.
- [ ] (If you did 2.3) dispatch to your paired device still works with the shared secret.

**Confirm untouched:** the manual-review flow (`AUTO_POST=false`) still fills the composer and waits.

---

## Explicitly NOT in this bucket (later)

- Migration drift — `Catalog`/`Device` tables, `destinations`/`targetUrl` columns missing from
  migrations (**bucket #2**).
- `packages/shared` job-payload type + `userId` in payload, DB indexes, `@@unique` on
  `SocialAccount(userId, platform)` and `Job(postId)`, converting statuses to Prisma enums.
- Desktop Runner completion (**bucket #3**), stuck-`dispatched`/`active` job recovery action.
- AES-CBC → AES-GCM (integrity), real key rotation.
