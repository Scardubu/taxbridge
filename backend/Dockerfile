# TaxBridge Backend Production Dockerfile
# Multi-stage build — Node 20 LTS, non-root, health-checked
# V12 §10.1 — Render deployment target

# ── Stage 0: Base ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install system dependencies for native modules (bcrypt, prisma engine)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates

# Copy package manifests
COPY package.json package-lock.json ./

# ── Stage 1: Install all deps (build + prod) ──────────────────────────────────
FROM base AS dependencies
RUN npm ci --ignore-scripts && npx prisma generate || true

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM dependencies AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl ca-certificates

# Create non-root user (C-DOCKER: never run as root in prod)
RUN addgroup -g 1001 -S taxbridge && \
    adduser -S taxbridge -u 1001

# Copy built artifacts only — no devDependencies, no source
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/lib ./lib

# Ensure non-root user owns the app directory
RUN chown -R taxbridge:taxbridge /app

USER taxbridge

# Health check — uses the composite monitoring endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/api/v2/monitoring/health || exit 1

EXPOSE 10000

CMD ["node", "dist/src/server.js"]
