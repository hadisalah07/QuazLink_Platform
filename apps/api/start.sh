#!/bin/sh
set -e

echo "🚀 Syncing database schema (db push)..."
npx prisma db push --accept-data-loss

echo "✅ Database synced. Launching QuazLink API Server..."
exec node dist/server.js
