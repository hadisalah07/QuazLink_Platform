# Docker Startup & Prisma Rules

When writing or modifying entrypoint scripts (e.g., `start.sh`) for Docker containers that depend on a database:

## 1. Database Readiness & Retry Loops
1. **Never use strict fail-fast (`set -e`) for the initial connection attempt** if the service might still be booting up. Docker's `depends_on` only waits for the container to start, not to be healthy.
2. **Always implement a retry loop** with a delay. For example:
   ```sh
   echo "🚀 Waiting for database to be ready..."
   for i in 1 2 3 4 5; do
     npx prisma db push --skip-generate && break || echo "⚠️ Database not ready yet, retrying in 3 seconds..."
     sleep 3
   done
   ```

## 2. Prisma Migration Strategy (P3005 Guardrail)
1. If a production project has been using `npx prisma db push` to sync the schema, **do NOT blindly switch** to `npx prisma migrate deploy`. 
2. Running `migrate deploy` on an existing database without the `_prisma_migrations` baseline will crash the startup script with **Error P3005 (The database schema is not empty)**.
3. Stick to `db push` for rapid prototyping, or explicitly follow the [Prisma Baseline Workflow](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/baselining) before switching.
