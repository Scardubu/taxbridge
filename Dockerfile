FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/prisma ./backend/prisma
RUN npm ci
COPY . .
RUN npx prisma generate --schema=./backend/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/package.json ./package.json
RUN npx prisma generate --schema=./backend/prisma/schema.prisma
USER taxbridge
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v2/monitoring/health || exit 1
CMD ["node", "dist/server.js"]
