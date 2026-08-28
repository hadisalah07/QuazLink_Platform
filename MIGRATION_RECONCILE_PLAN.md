# Bucket #2 — Migration Reconciliation + Safe Deploy (Implementation Plan)

> **You implement this; I wait.** But this touches a **production database that holds real
> encrypted Facebook sessions** — so this plan is split so you run the **read-only diagnostics
> first (Part 0) and send me the output**, I confirm the exact commands for your case, and only
> then do you run the mutating steps (Part 2/3). Nothing here should ever run `migrate reset` or
> `db push --accept-data-loss` on prod.

---

## Why this bucket exists (the real situation, confirmed)

- Your `schema.prisma` describes **7 models**: `User, SocialAccount, Campaign, Post, Job, Catalog, Device`.
- Your migrations on disk describe only **5 tables** + `passwordHash`:
  - `20260803215835_init` → User, SocialAccount, Campaign, Post, Job (⚠️ **without** `destinations`/`targetUrl`)
  - `20260812221343_add_user_password` → adds `User.passwordHash`
- **Missing from every migration:** the `Catalog` table, the `Device` table, `SocialAccount.destinations`, and `Job.targetUrl`.
- Production has these tables anyway — because at some point you ran **`prisma db push`** manually against the prod DB. But:
  - The `Dockerfile` CMD is `node dist/server.js` and **`apps/api/start.sh` is never invoked** by any Dockerfile/compose → **there is no automatic migration step on deploy at all.**
  - So today, if you add a column to `schema.prisma` and redeploy, **prod's DB does not change** → the app crashes at runtime against the old schema.

**Goal of this bucket:** make the migration history fully describe the schema, "baseline" the existing
databases so Prisma knows they're already at that state, and wire an **automatic, fail-loud
`prisma migrate deploy`** into the deploy so future schema changes are applied safely and never silently skipped.

**No data is dropped anywhere in this plan.** We only (a) add a migration file, (b) write rows to the
`_prisma_migrations` bookkeeping table via `migrate resolve` (never touching your data tables), and
(c) change the boot command.

---

## PART 0 — Diagnostics (READ-ONLY — run these, paste me the output, then stop)

You can run SQL against prod either from a DB GUI pointed at the prod DB, or on the VPS:

```sh
# on the VPS, open a psql shell inside the running postgres container:
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U admin -d saas_automation
```

**0.1 — What migrations does prod think it has applied?**
```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY started_at;
```
- If it errors with `relation "_prisma_migrations" does not exist` → prod has **no migration history**
  (pure `db push` baseline). That's fine and expected — just tell me.
- Otherwise paste the list of `migration_name`s.

**0.2 — Confirm the drifted columns/tables really are present in prod:**
```sql
SELECT to_regclass('"Device"')   AS device_table,
       to_regclass('"Catalog"')  AS catalog_table;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'Job' AND column_name = 'targetUrl';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'SocialAccount' AND column_name = 'destinations';
```
Expected: both tables non-null, and both columns returned. (This proves the "already there via db push" theory.)

**0.3 — Which secrets is prod ACTUALLY running with right now?** (so we never rotate them)
```sh
docker compose -f docker-compose.prod.yml exec api printenv ENCRYPTION_KEY JWT_SECRET
```
- **Write these two values down.** The `ENCRYPTION_KEY` value is the one your prod Facebook sessions
  are encrypted with — it must **never change**, and it's the value the desktop agent must verify HMAC with.

**0.4 — The authoritative "is prod already in sync with schema.prisma?" check.**
From your machine (or the VPS), with `PROD_DATABASE_URL` set to the prod DB connection string:
```sh
cd apps/api
npx prisma migrate diff \
  --from-url "$PROD_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```
- **Empty output = prod's live schema already equals `schema.prisma`** → safe to baseline (Part 2).
- **If it prints any SQL**, that SQL is *additional* drift we must fold into the migration in Part 1
  before baselining. Paste it to me.

> 🚦 **Stop here and send me 0.1–0.4 output.** The exact `migrate resolve` commands in Part 2 depend
> on what 0.1 returns. Part 1 below you can do now (it's just adding a file, nothing runs).

---

## PART 1 — Add the missing migration file (local, committed to git — safe, nothing executes)

Create this folder + file (timestamp is deliberately after `20260812221343` so it sorts last):

**`apps/api/prisma/migrations/20260817101500_add_device_catalog_destinations_targeturl/migration.sql`**

```sql
-- AlterTable: columns that db push added but no migration recorded
ALTER TABLE "SocialAccount" ADD COLUMN "destinations" JSONB;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "targetUrl" TEXT;

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'custom',
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "authScheme" TEXT NOT NULL DEFAULT 'bearer',
    "authHeader" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Workstation',
    "platform" TEXT NOT NULL DEFAULT 'win32',
    "pairingToken" TEXT NOT NULL,
    "deviceToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "ipAddress" TEXT,
    "appVersion" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "keepAwake" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_pairingToken_key" ON "Device"("pairingToken");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceToken_key" ON "Device"("deviceToken");

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

> This SQL is hand-written to exactly match Prisma's own style (see `20260803215835_init/migration.sql`)
> and reflects the current `schema.prisma` precisely (`Json?`→`JSONB`, `String?`→`TEXT`,
> `keepAwake Boolean @default(false)`, the two `@unique` indexes on `Device`). **Do not run it yet** —
> on prod/your local it would fail with "already exists"; that's the whole point of baselining in Part 2.

**Alternative (if you'd rather generate it than trust my hand-written SQL):** on a machine with a
scratch Postgres available as a shadow DB:
```sh
cd apps/api
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```
Compare its output to the SQL above — they should be equivalent. Use whichever you trust; keep one.

---

## PART 2 — Baseline the existing databases (mark migrations "applied" WITHOUT running them)

> `prisma migrate resolve --applied <name>` writes ONLY to the `_prisma_migrations` table. It never
> creates/alters/drops a data table. That's exactly what we want: tell Prisma "this migration's
> result already exists, don't run it."

Run these against **each** database that already has the tables — **prod** (via the container/DATABASE_URL)
**and** your **local dev DB** (the one you've been `db push`-ing into). For prod, run from a context
where `DATABASE_URL` points at prod, e.g.:
```sh
docker compose -f docker-compose.prod.yml exec api sh -c \
  'cd /app/apps/api && npx prisma migrate resolve --applied <NAME>'
```

**Pick the branch based on Part 0.1:**

- **Branch A — `_prisma_migrations` was empty / did not exist** (most likely): mark **all three** applied:
  ```sh
  npx prisma migrate resolve --applied 20260803215835_init
  npx prisma migrate resolve --applied 20260812221343_add_user_password
  npx prisma migrate resolve --applied 20260817101500_add_device_catalog_destinations_targeturl
  ```

- **Branch B — it already listed `init` + `add_user_password`**: mark only the **new** one applied:
  ```sh
  npx prisma migrate resolve --applied 20260817101500_add_device_catalog_destinations_targeturl
  ```

**Then verify (both prod and local):**
```sh
npx prisma migrate status
```
Expected: **"Database schema is up to date!"** and no pending migrations.

---

## PART 3 — Wire automatic, fail-loud migrations into the deploy

Right now nothing migrates on boot. Make `migrate deploy` run on every container start and **refuse to
start** if it fails (the opposite of the old `db push ... || echo` that swallowed errors).

**3.1 — Replace `apps/api/start.sh` with:**
```sh
#!/bin/sh
set -e
echo "🚀 Applying database migrations (migrate deploy)..."
npx prisma migrate deploy
echo "✅ Migrations up to date. Launching QuazLink API Server..."
exec node dist/server.js
```
> `set -e` + no `|| echo` means a failed migration **stops the boot** instead of starting on a stale
> schema. `migrate deploy` only ever applies *pending* migrations and **never** resets or drops — it's
> the production-safe command.

**3.2 — Make the Dockerfile actually use it.** In `apps/api/Dockerfile`, change the last line:

**Find:**
```dockerfile
CMD ["node", "dist/server.js"]
```
**Replace with:**
```dockerfile
CMD ["sh", "start.sh"]
```
> WORKDIR is already `/app/apps/api`, and `start.sh` sits there (copied via `COPY . .`). `npx prisma`
> and the `prisma/migrations` folder are both present in the runtime image (the image copies the whole
> `/app`), so `migrate deploy` works at boot. The DB is reachable as the `postgres` service.

**3.3 — Redeploy.** After Part 2 baselining, the first boot will log `migrate deploy` finding **no
pending migrations** (because they're all baselined) and start normally. From now on, any new migration
you commit is applied automatically and safely on deploy.

---

## PART 4 — (Recommended, short) Deploy secret hygiene

Not strictly migrations, but it's the same file and a live risk. `docker-compose.prod.yml` currently
**commits real-looking secret defaults**:
```yaml
ENCRYPTION_KEY: ${ENCRYPTION_KEY:-ql_sec_9e2bf44a10c87d6531ea908bce5a7821}
JWT_SECRET:     ${JWT_SECRET:-ql_jwt_991823abcefd112349887711aaeeff00}
```
If prod is running on these defaults (Part 0.3 tells you), they're compromised (they're in git history).

**Do this:**
1. Put the **current** values (from Part 0.3 — the ones prod already uses) into the VPS `.env`
   (gitignored). ⚠️ **Same values — do not rotate `ENCRYPTION_KEY`** or every stored FB session orphans.
2. Change compose to **fail if unset** instead of shipping a default:
   ```yaml
   ENCRYPTION_KEY: ${ENCRYPTION_KEY:?ENCRYPTION_KEY must be set in .env}
   JWT_SECRET:     ${JWT_SECRET:?JWT_SECRET must be set in .env}
   ```
3. When you build the desktop agent installer (Bucket #3), it must ship/receive **this same
   `ENCRYPTION_KEY` value** so its HMAC verification matches the server's signature — otherwise every
   job dispatched to a paired device is silently rejected and gets stuck in `dispatched`.

> Later hardening (its own bucket): split the runner-signing secret out of `ENCRYPTION_KEY` into a
> dedicated `RUNNER_SIGNING_SECRET`, so the master DB-encryption key isn't shipped to every user's
> desktop. For now, matching values is what makes dispatch work.

---

## Verification checklist

- [ ] Part 0.4 (`migrate diff --from-url prod`) printed **empty** before baselining (prod == schema).
- [ ] `npx prisma migrate status` says **up to date** on **both** prod and local.
- [ ] Redeploy prod → boot log shows `migrate deploy` → "No pending migrations" → server starts, `/health` OK.
- [ ] **Fresh-DB proof (do this on a throwaway DB, not prod):** point `DATABASE_URL` at an empty
      Postgres, run `npx prisma migrate deploy` → it creates **all 7 tables incl. Device/Catalog and
      the destinations/targetUrl columns**, then signup works. This proves the history is now complete
      and a clean deploy no longer drifts.
- [ ] Existing prod FB session still decrypts (connect an account or run a prepare-only job — no decrypt
      error), confirming `ENCRYPTION_KEY` was not changed.

---

## Explicitly NOT in this bucket (later)

- Missing indexes and `@@unique` constraints — `SocialAccount(userId, platform)`, `Job(postId)`, plus
  FK/lookup indexes. These are **new** migrations; batch them as a small follow-up bucket (they'll flow
  through the now-working `migrate deploy` cleanly).
- Converting free-string `status` fields to Prisma enums.
- `packages/shared` typed job payload + `userId` in the queue payload.
- Splitting `RUNNER_SIGNING_SECRET` out of `ENCRYPTION_KEY` (Part 4 note).
- Desktop Runner completion + installer (**Bucket #3**).
