# TaxBridge Backend Production Dockerfile
# Multi-stage build for optimized production image

FROM node:18-alpine AS base
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    wget \
    curl

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Stage 1: Dependencies
FROM base AS dependencies
RUN yarn install --frozen-lockfile --production=false

# Stage 2: Build
FROM dependencies AS build
COPY . .
RUN yarn prisma generate
RUN yarn build

# Download UBL XSD for validation
RUN wget https://docs.peppol.eu/poacc/billing/3.0/files/UBL-Invoice-2.1.xsd -O lib/ubl-invoice-2.1.xsd || \
    echo "XSD download failed - will retry at runtime"

# Stage 3: Production
FROM node:18-alpine AS production
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    wget \
    ca-certificates

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/lib ./lib
COPY --from=build /app/prisma ./prisma

# Create non-root user
RUN addgroup -g 1001 -S taxbridge && \
    adduser -S taxbridge -u 1001
USER taxbridge

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/src/server.js"]
