#!/bin/sh
echo "🚀 Syncing database schema (db push)..."
for i in 1 2 3 4 5; do
  npx prisma db push --skip-generate && break || echo "⚠️ Database not ready yet, retrying in 3 seconds..."
  sleep 3
done
echo "✅ Migrations up to date. Launching QuazLink API Server..."
exec node dist/server.js
