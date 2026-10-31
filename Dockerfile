# Deterministic TaxBridge API image. Build context: repository root.
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat
RUN npm install --global npm@10.9.2

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY . .
RUN npm ci
RUN npm run build --workspace=@taxbridge/contracts
RUN npm run build --workspace=@taxbridge/backend

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget \
  && addgroup -S taxbridge \
  && adduser -S taxbridge -G taxbridge

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R taxbridge:taxbridge /app
USER taxbridge

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health/ready >/dev/null || exit 1

CMD ["node", "backend/dist/backend/src/server.js"]
