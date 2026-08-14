# Multi-stage production Dockerfile for QuazLink API & WSS Gateway
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package manifests for caching
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install dependencies and generate Prisma Client
RUN npm install
RUN cd apps/api && npx prisma generate

# Copy source code and build TypeScript
COPY apps/api ./apps/api
RUN cd apps/api && npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy built artifacts and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/server.js"]
