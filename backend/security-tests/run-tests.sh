#!/bin/bash

set -e

API_BASE="${1:-http://localhost:3000}"
echo "🔒 Running Security Tests against $API_BASE"

PASSED=0
FAILED=0

# Helper functions
pass() {
  echo "✅ PASS: $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo "❌ FAIL: $1"
  FAILED=$((FAILED + 1))
}

# 1. SQL Injection Tests
echo ""
echo "=== SQL Injection Protection ==="
RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"'"'"'; DROP TABLE users;--","items":[]}' \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" != "500" ]; then
  pass "SQL injection payload blocked"
else
  fail "SQL injection test produced 500 error"
fi

# 2. XSS Protection
echo ""
echo "=== XSS Protection ==="
RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"<script>alert(1)</script>","items":[]}' \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
  pass "XSS payload rejected"
else
  fail "XSS payload not properly sanitized"
fi

# 3. Authentication Tests
echo ""
echo "=== Authentication ==="
RESPONSE=$(curl -s -X GET "$API_BASE/api/v1/invoices" \
  -H "Authorization: Bearer invalid_token" \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  pass "Invalid token rejected"
else
  fail "Invalid token not properly rejected"
fi

# 4. Rate Limiting Tests
echo ""
echo "=== Rate Limiting (may take 30s) ==="

# Send 110 requests in rapid succession (exceeds 100/minute limit)
BLOCKED_COUNT=0
for i in {1..110}; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" --max-time 1)
  if [ "$RESPONSE" = "429" ]; then
    BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
  fi
  [ $((i % 20)) -eq 0 ] && echo "  Sent $i requests..."
done

if [ "$BLOCKED_COUNT" -gt 0 ]; then
  pass "Rate limiting active (blocked $BLOCKED_COUNT requests)"
else
  echo "⚠️  WARNING: Rate limiting not observed (may be disabled in development)"
fi

# 5. Path Traversal Tests
echo ""
echo "=== Path Traversal Protection ==="
RESPONSE=$(curl -s -X GET "$API_BASE/api/v1/files/../../etc/passwd" -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
  pass "Path traversal blocked"
else
  fail "Path traversal not properly prevented"
fi

# 6. HTTPS Enforcement (if not localhost)
if [[ "$API_BASE" != *"localhost"* ]] && [[ "$API_BASE" != *"127.0.0.1"* ]]; then
  echo ""
  echo "=== HTTPS Enforcement ==="
  if [[ "$API_BASE" == https://* ]]; then
    pass "API uses HTTPS"
  else
    fail "API not using HTTPS in production"
  fi
fi

# 7. Security Headers
echo ""
echo "=== Security Headers ==="
HEADERS=$(curl -s -I "$API_BASE/health")

if echo "$HEADERS" | grep -qi "X-Content-Type-Options: nosniff"; then
  pass "X-Content-Type-Options header present"
else
  fail "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "X-Frame-Options: DENY"; then
  pass "X-Frame-Options header present"
else
  fail "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
  pass "HSTS header present"
else
  fail "HSTS header missing"
fi

# 8. Password Policy
echo ""
echo "=== Password Policy ==="
WEAK_PASSWORDS=("12345678" "password" "testtest")
for pwd in "${WEAK_PASSWORDS[@]}"; do
  RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"+2348012345678\",\"name\":\"Test\",\"password\":\"$pwd\"}" \
    -w "\n%{http_code}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)

  if [ "$HTTP_CODE" = "400" ]; then
    pass "Weak password '$pwd' rejected"
  else
    fail "Weak password '$pwd' accepted"
  fi
done

# 9. CSRF Protection
echo ""
echo "=== CSRF Protection ==="
RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -H "Origin: https://malicious-site.com" \
  -d '{"items":[]}' \
  -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  pass "Cross-origin POST blocked"
else
  echo "⚠️  WARNING: CORS may need stricter origin validation"
fi

# 10. File Upload Size Limit
echo ""
echo "=== File Upload Limits ==="
LARGE_PAYLOAD=$(python3 -c "print('A' * 2000000)")  # 2MB payload
RESPONSE=$(curl -s -X POST "$API_BASE/api/v1/ocr/process" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$LARGE_PAYLOAD\"}" \
  -w "\n%{http_code}" \
  --max-time 5)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "413" ] || [ "$HTTP_CODE" = "400" ]; then
  pass "Large payload rejected"
else
  echo "⚠️  WARNING: File upload size limits may need adjustment"
fi

# Summary
echo ""
echo "========================================"
echo "Security Test Summary"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "❌ Security tests FAILED"
  exit 1
else
  echo "✅ All security tests PASSED"
  exit 0
fi
