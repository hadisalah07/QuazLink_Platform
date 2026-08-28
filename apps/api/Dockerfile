# Multi-stage production Dockerfile for QuazLink API & WSS Gateway
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Copy root and api manifests
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install all workspace dependencies cleanly and generate Prisma client
RUN npm install
RUN cd apps/api && npx prisma generate

# Copy source code and build TypeScript
COPY . .
RUN cd apps/api && npm run build

# Production runtime image
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app ./

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["sh", "start.sh"]
