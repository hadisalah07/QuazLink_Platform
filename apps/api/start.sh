#!/bin/sh
set -e
echo "🚀 Applying database migrations (migrate deploy)..."
npx prisma migrate deploy
echo "✅ Migrations up to date. Launching QuazLink API Server..."
exec node dist/server.js
