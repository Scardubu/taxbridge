#!/usr/bin/env bash

# Route-aware smoke/regression checks. These checks intentionally target routes
# registered by backend/src/app.ts; they do not treat arbitrary 404s as security
# controls or claim to prove SQL-injection/XSS safety by submitting inert payloads.

set -euo pipefail

API_BASE="${1:-http://localhost:3000}"
TMP_DIR="$(mktemp -d)"
BODY_FILE="$TMP_DIR/body.json"
HEADER_FILE="$TMP_DIR/headers.txt"
PASSED=0
FAILED=0

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pass() {
  printf 'PASS: %s\n' "$1"
  PASSED=$((PASSED + 1))
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  FAILED=$((FAILED + 1))
}

request_status() {
  curl --silent --show-error --output "$BODY_FILE" --write-out '%{http_code}' --max-time 15 "$@"
}

expect_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$label (HTTP $actual)"
  else
    fail "$label (expected HTTP $expected, received HTTP $actual)"
    if [ -s "$BODY_FILE" ]; then
      sed -n '1,20p' "$BODY_FILE" >&2
    fi
  fi
}

printf 'Running TaxBridge API security checks against %s\n' "$API_BASE"

# 1. The live and ready routes are registered at the application root.
status="$(request_status "$API_BASE/health/live")"
expect_status "Liveness endpoint" "200" "$status"

status="$(request_status "$API_BASE/health/ready")"
expect_status "Readiness endpoint (PostgreSQL and Redis available)" "200" "$status"

# 2. Helmet headers must be present on a real application response.
# The API trusts its configured reverse proxy. Simulate the TLS-terminating proxy
# so Helmet emits HSTS; an HTTP-only localhost request correctly omits HSTS.
curl --silent --show-error --dump-header "$HEADER_FILE" --output /dev/null --max-time 15 \
  -H 'X-Forwarded-Proto: https' "$API_BASE/health/live"
if grep -Eiq '^x-content-type-options: *nosniff' "$HEADER_FILE"; then
  pass "X-Content-Type-Options nosniff"
else
  fail "X-Content-Type-Options nosniff header missing"
fi

if grep -Eiq "^content-security-policy:.*frame-ancestors 'none'" "$HEADER_FILE"; then
  pass "CSP frame-ancestors none"
else
  fail "CSP frame-ancestors none directive missing"
fi

if grep -Eiq '^strict-transport-security:' "$HEADER_FILE"; then
  pass "HSTS header present"
else
  fail "HSTS header missing"
fi

# 3. Authentication is required on the authenticated invoice-management route.
status="$(request_status -H 'Authorization: Bearer invalid-taxbridge-token' "$API_BASE/api/v1/invoice-mgmt")"
expect_status "Invalid bearer token rejected by invoice-management route" "401" "$status"

status="$(request_status "$API_BASE/api/v1/invoices")"
expect_status "Unauthenticated legacy invoice list rejected" "401" "$status"

status="$(request_status -H 'Authorization: Bearer invalid-taxbridge-token' "$API_BASE/api/v1/invoices")"
expect_status "Invalid bearer token rejected by legacy invoice list" "401" "$status"

# 4. Login schema rejects malformed credentials before authentication logic runs.
status="$(request_status -X POST "$API_BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  --data '{"email":"not-an-email","password":"short"}')"
expect_status "Malformed login payload rejected by schema validation" "400" "$status"

# 5. Login attempts must be rate-limited by the configured route policy.
blocked=0
for attempt in $(seq 1 8); do
  status="$(request_status -X POST "$API_BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    --data '{"email":"invalid@example.invalid","password":"not-a-valid-password"}')"
  if [ "$status" = "429" ]; then
    blocked=$((blocked + 1))
  fi
done

if [ "$blocked" -gt 0 ]; then
  pass "Login endpoint rate limit enforced ($blocked of 8 requests returned HTTP 429)"
else
  fail "Login endpoint did not enforce its configured rate limit"
fi

# 6. A disallowed browser origin must not be reflected in CORS response headers.
curl --silent --show-error --dump-header "$HEADER_FILE" --output /dev/null --max-time 15 \
  -X OPTIONS "$API_BASE/api/v1/auth/login" \
  -H 'Origin: https://malicious-site.invalid' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
if grep -Eiq '^access-control-allow-origin: *https://malicious-site\.invalid' "$HEADER_FILE"; then
  fail "Untrusted Origin was reflected by CORS"
else
  pass "Untrusted Origin is not reflected by CORS"
fi

# 7. The application JSON parser must reject bodies above its 1 MiB limit.
python3 - <<'PY' > "$BODY_FILE"
import json
print(json.dumps({"email": "a" * (2 * 1024 * 1024), "password": "not-used"}))
PY
status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 20 \
  -X POST "$API_BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  --data-binary "@$BODY_FILE")"
expect_status "JSON request body above 1 MiB is rejected" "413" "$status"

printf '\nSecurity check summary: %s passed, %s failed\n' "$PASSED" "$FAILED"
if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
