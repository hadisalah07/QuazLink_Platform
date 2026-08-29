#!/bin/sh
set -e
echo "🚀 Auto-Baselining existing database..."
npx prisma migrate resolve --applied 20260830000000_init_catalog_device || true
echo "🚀 Applying database migrations (migrate deploy)..."
npx prisma migrate deploy
echo "✅ Migrations up to date. Launching QuazLink API Server..."
exec node dist/server.js
