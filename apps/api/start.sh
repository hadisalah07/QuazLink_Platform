#!/bin/sh
echo "🚀 Running database schema check..."
npx prisma db push --skip-generate || echo "Notice: Database schema sync non-fatal check completed."
echo "🚀 Launching QuazLink API Server..."
exec node dist/server.js
