# TaxBridge Admin Dashboard — Multi-Stage Dockerfile
# Next.js 15 App Router — Vercel-compatible standalone output
# Stages: base → development | builder → production

# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Install root workspace manifest + admin manifest
COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY admin/package.json admin/
RUN yarn install --frozen-lockfile

# Copy source (volume-mounted by compose in dev)
COPY packages/contracts/ packages/contracts/
COPY admin/ admin/

WORKDIR /app/admin
EXPOSE 3001
CMD ["npx", "next", "dev", "-p", "3001"]

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY admin/package.json admin/
RUN yarn install --frozen-lockfile

COPY packages/contracts/ packages/contracts/
COPY admin/ admin/

# Build contracts, then admin
RUN yarn workspace @taxbridge/contracts build
RUN yarn workspace @taxbridge/admin build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

# Next.js standalone output
COPY --from=builder /app/admin/.next/standalone  ./
COPY --from=builder /app/admin/.next/static      ./.next/static
COPY --from=builder /app/admin/public            ./public

USER taxbridge
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -sf http://localhost:3001/admin/analytics || exit 1

CMD ["node", "server.js"]
