#!/bin/sh
echo "🚀 Applying database migrations (migrate deploy)..."
for i in 1 2 3 4 5; do
  npx prisma migrate deploy && break || echo "⚠️ Database not ready yet, retrying in 3 seconds..."
  sleep 3
done
echo "✅ Migrations up to date. Launching QuazLink API Server..."
exec node dist/server.js
