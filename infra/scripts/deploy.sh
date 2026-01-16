#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.production ]; then
  echo "Missing .env.production at repo root" >&2
  exit 1
fi

source .env.production
VERSION=${1:-$(git rev-parse --short HEAD)}
REGISTRY=${REGISTRY:-taxbridge}

printf "\n🚀 Deploying TaxBridge %s\n" "$VERSION"

# Build backend and OCR images
DOCKER_BUILDKIT=1 docker build -t "$REGISTRY/backend:$VERSION" ./backend
DOCKER_BUILDKIT=1 docker build -t "$REGISTRY/ocr-service:$VERSION" ./ml/ocr_service

docker push "$REGISTRY/backend:$VERSION"
docker push "$REGISTRY/ocr-service:$VERSION"

# Run database migrations
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  "$REGISTRY/backend:$VERSION" \
  yarn prisma migrate deploy

# Validate UBL sample before rollout
if [ -f backend/dist/src/tools/ubl-validate.js ]; then
  docker run --rm \
    -e UBL_XSD_PATH="/app/lib/ubl-invoice-2.1.xsd" \
    "$REGISTRY/backend:$VERSION" \
    node dist/src/tools/ubl-validate.js
fi

# Deploy stack
VERSION=$VERSION docker compose -f infra/docker-compose.prod.yml pull || true
VERSION=$VERSION docker compose -f infra/docker-compose.prod.yml up -d --remove-orphans

sleep 10
curl -fsS https://api.taxbridge.ng/health/digitax || curl -fsS https://api.taxbridge.ng/health/duplo
curl -fsS https://api.taxbridge.ng/health/remita

if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"✅ TaxBridge ${VERSION} deployed successfully\"}"
fi

printf "\n🎉 Deployment complete\n"
