# Canonical TaxBridge API image. Render builds from the repository root.
FROM node:26-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl libc6-compat curl
COPY . .

RUN npm ci
RUN npm run build --workspace=@taxbridge/contracts
RUN npm run ubl:download-xsd --workspace=@taxbridge/backend
RUN npm run build --workspace=@taxbridge/backend

FROM node:26-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget \
  && addgroup -S taxbridge \
  && adduser -S taxbridge -G taxbridge

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/lib ./lib
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000

USER taxbridge
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health/live >/dev/null || exit 1

CMD ["node", "dist/backend/src/server.js"]
