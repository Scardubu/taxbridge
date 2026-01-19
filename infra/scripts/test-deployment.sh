#!/usr/bin/env bash
#
# TaxBridge Production Deployment Test Script
# Validates all critical endpoints and integrations before go-live
#

set -euo pipefail

API_URL="${1:-https://api.taxbridge.ng}"
ADMIN_URL="${2:-https://admin.taxbridge.ng}"

PASSED=0
FAILED=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_test() {
  echo -e "${YELLOW}[TEST]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED++))
}

test_endpoint() {
  local url=$1
  local expected_status=${2:-200}
  local description=$3

  log_test "$description"
  
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  
  if [ "$status" = "$expected_status" ]; then
    log_pass "$description (HTTP $status)"
  else
    log_fail "$description (Expected $expected_status, got $status)"
  fi
}

test_json_field() {
  local url=$1
  local field=$2
  local expected_value=$3
  local description=$4

  log_test "$description"
  
  response=$(curl -s "$url" || echo "{}")
  actual_value=$(echo "$response" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4 || echo "")
  
  if [ "$actual_value" = "$expected_value" ]; then
    log_pass "$description"
  else
    log_fail "$description (Expected: $expected_value, Got: $actual_value)"
  fi
}

echo ""
echo "========================================="
echo "TaxBridge Production Deployment Tests"
echo "========================================="
echo "API URL: $API_URL"
echo "Admin URL: $ADMIN_URL"
echo ""

# Test 1: Liveness Check (no external deps)
test_endpoint "$API_URL/health/live" 200 "Liveness probe"

# Test 2: Readiness Check (DB + Redis)
test_endpoint "$API_URL/health/ready" 200 "Readiness probe"

# Test 3: Metrics Endpoint
test_endpoint "$API_URL/metrics" 200 "Prometheus metrics"

# Test 4: DigiTax Health (canonical) with legacy alias fallback
log_test "DigiTax integration health"
digitax_response=$(curl -s "$API_URL/health/digitax" || echo "{}")
digitax_status=$(echo "$digitax_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

# Backward-compatible fallback for older deployments
if [ "$digitax_status" = "unknown" ] || [ -z "$digitax_status" ]; then
  digitax_response=$(curl -s "$API_URL/health/duplo" || echo "{}")
  digitax_status=$(echo "$digitax_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
fi

if [ "$digitax_status" = "healthy" ] || [ "$digitax_status" = "degraded" ]; then
  log_pass "DigiTax health check (status: $digitax_status)"
else
  log_fail "DigiTax health check failed (status: $digitax_status)"
fi

# Test 5: Remita Health
log_test "Remita payment gateway health"
remita_response=$(curl -s "$API_URL/health/remita" || echo "{}")
remita_status=$(echo "$remita_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
if [ "$remita_status" = "healthy" ] || [ "$remita_status" = "degraded" ]; then
  log_pass "Remita health check (status: $remita_status)"
else
  log_fail "Remita health check failed (status: $remita_status)"
fi

# Test 6: CORS Headers
log_test "CORS headers configuration"
cors_header=$(curl -s -I -X OPTIONS "$API_URL/health/live" | grep -i "access-control-allow-origin" || echo "")
if [ -n "$cors_header" ]; then
  log_pass "CORS headers present"
else
  log_fail "CORS headers missing"
fi

# Test 7: Security Headers
log_test "Security headers (CSP, HSTS, X-Frame-Options)"
security_headers=$(curl -s -I "$API_URL/health" | grep -iE "(content-security-policy|strict-transport-security|x-frame-options)" | wc -l)
if [ "$security_headers" -ge 3 ]; then
  log_pass "Security headers present ($security_headers/3)"
else
  log_fail "Security headers incomplete ($security_headers/3)"
fi

# Test 8: Admin Dashboard
test_endpoint "$ADMIN_URL" 200 "Admin dashboard accessible"

# Test 9: Invoice Creation (401 expected without auth)
log_test "Invoice API endpoint (auth required)"
invoice_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v1/invoices" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Test"}' || echo "000")
if [ "$invoice_status" = "400" ] || [ "$invoice_status" = "401" ]; then
  log_pass "Invoice API responding (validation/auth working)"
else
  log_fail "Invoice API unexpected response ($invoice_status)"
fi

# Test 10: Payment Generation (validation error expected)
log_test "Payment generate API endpoint (validation)"
rrr_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v1/payments/generate" \
  -H "Content-Type: application/json" \
  -d '{}' || echo "000")
if [ "$rrr_status" = "400" ]; then
  log_pass "Payment API responding (validation working)"
else
  log_fail "Payment API unexpected response ($rrr_status)"
fi

# Test 11: SSL Certificate
log_test "SSL certificate validity"
if echo | openssl s_client -connect "${API_URL#https://}:443" -servername "${API_URL#https://}" 2>/dev/null | grep -q "Verify return code: 0"; then
  log_pass "SSL certificate valid"
else
  log_fail "SSL certificate invalid or not present"
fi

# Test 12: Response Time
log_test "API response time (<500ms)"
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/health" | awk '{print $1 * 1000}')
if (( $(echo "$response_time < 500" | bc -l) )); then
  log_pass "Response time acceptable (${response_time}ms)"
else
  log_fail "Response time too slow (${response_time}ms)"
fi

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Deployment is ready.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Review issues before going live.${NC}"
  exit 1
fi
