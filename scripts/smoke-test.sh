#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
  echo "Usage: bash scripts/smoke-test.sh <base-url>" >&2
  exit 1
fi

# 1. Liveness probe — must be 200 (never fails)
curl --fail --silent --show-error "$BASE_URL/health/live" > /dev/null

# 2. Readiness probe — must be 200 (degraded is still 200 per C-07)
curl --fail --silent --show-error "$BASE_URL/health/ready" > /dev/null

# 3. Monitoring health — canonical V2 health endpoint
curl --fail --silent --show-error "$BASE_URL/api/v2/monitoring/health" > /dev/null

# 4. Filings preflight — auth-gated; allowed to return 401 (not 5xx)
STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" "$BASE_URL/api/v1/filings/preflight?taxType=VAT")
[ "$STATUS" -lt 500 ] || { echo "❌ Preflight returned $STATUS (5xx)"; exit 1; }

# 5. OpenAPI spec — only available in non-production
curl --fail --silent --show-error "$BASE_URL/docs/json" > /dev/null || true

# 6. V2 dashboard — auth-gated; must not return 5xx
STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" "$BASE_URL/api/v2/dashboard")
[ "$STATUS" -lt 500 ] || { echo "❌ V2 dashboard returned $STATUS (5xx)"; exit 1; }

# 7. V2 analytics revenue — auth-gated; must not return 5xx
STATUS=$(curl --silent --output /dev/null --write-out "%{http_code}" "$BASE_URL/api/v2/analytics/revenue")
[ "$STATUS" -lt 500 ] || { echo "❌ Analytics revenue returned $STATUS (5xx)"; exit 1; }

echo "✅ Smoke test passed (7/7) for $BASE_URL"
