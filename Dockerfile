# TaxBridge Backend Production Dockerfile
# Multi-stage build — Node 20 LTS, non-root, health-checked
# V12 §5.1 — Render deployment target

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN yarn install --frozen-lockfile
COPY packages/contracts/ packages/contracts/
COPY backend/ backend/
RUN yarn workspace @taxbridge/contracts build && yarn workspace backend build
RUN yarn workspace backend npx prisma generate

FROM node:20-alpine AS production
RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge
WORKDIR /app
COPY --from=builder /app/backend/dist    ./dist
COPY --from=builder /app/backend/prisma  ./prisma
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/packages        ./packages
RUN npx prisma generate --schema=./prisma/schema.prisma
USER taxbridge
ENV NODE_ENV=production
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:10000/api/v2/monitoring/health || exit 1
CMD ["node","dist/app.js"]
