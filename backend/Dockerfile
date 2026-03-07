# TaxBridge Backend — Multi-Stage Dockerfile
# Stages: base → development | builder → production
# V13 Sovereign — Render deployment target (port 10000)
# Non-root user, health-checked, minimal attack surface

# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# Build-time: install native tool deps (prisma, sharp, tesseract bindings)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    libc6-compat

# ─── Development ──────────────────────────────────────────────────────────────
# Used by: docker compose up (local dev with hot-reload via tsx watch)
FROM base AS development

ENV NODE_ENV=development

# Install ALL deps (including devDependencies)
COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN yarn install --frozen-lockfile

# Copy source (compose overrides with volume mounts, but need initial copy)
COPY packages/contracts/ packages/contracts/
COPY backend/ backend/

# Generate Prisma client
RUN yarn workspace backend npx prisma generate

WORKDIR /app/backend
EXPOSE 3000

# tsx watch for hot-reload; falls back to ts-node if tsx not available
CMD ["node", "-e", "require('child_process').spawn(require.resolve('.bin/tsx') + ' watch src/server.ts || npx ts-node src/server.ts', { shell: true, stdio: 'inherit' })"]

# ─── Builder ──────────────────────────────────────────────────────────────────
# Compiles TypeScript to JavaScript for the production stage
FROM base AS builder

COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN yarn install --frozen-lockfile

COPY packages/contracts/ packages/contracts/
COPY backend/ backend/

# Build contracts first (backend depends on it)
RUN yarn workspace @taxbridge/contracts build
RUN yarn workspace backend build
RUN yarn workspace backend npx prisma generate

# Prune devDependencies for lean production image
RUN yarn workspaces focus @taxbridge/backend --production 2>/dev/null || true

# ─── Production ───────────────────────────────────────────────────────────────
# Minimal, non-root, health-checked image for Render / Docker production
FROM node:20-alpine AS production

# Non-root user for security
RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge

# Runtime deps only (openssl required by Prisma)
RUN apk add --no-cache openssl libc6-compat curl wget

WORKDIR /app

# Copy compiled artefacts
COPY --from=builder /app/backend/dist      ./dist
COPY --from=builder /app/backend/prisma    ./prisma
COPY --from=builder /app/node_modules      ./node_modules
COPY --from=builder /app/packages          ./packages

# Regenerate Prisma client in production image (ensures correct binary)
RUN npx prisma generate --schema=./prisma/schema.prisma

# Drop to non-root
USER taxbridge

ENV NODE_ENV=production
# Render assigns PORT; fallback 10000 matches Render default
ENV PORT=10000

EXPOSE 10000

# Health check — always HTTP 200 per C-07 (health degrades, never 503)
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-10000}/api/v2/monitoring/health || exit 1

CMD ["node", "dist/server.js"]
