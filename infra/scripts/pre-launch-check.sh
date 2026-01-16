#!/bin/bash
# TaxBridge Pre-Launch Checklist (V5)
# Run this script before production launch to verify all systems are ready
# Usage: bash infra/scripts/pre-launch-check.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

# Functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
    ((CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
    ((CHECKS++))
}

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Header
echo ""
echo -e "${BLUE}🚀 TaxBridge Pre-Launch Checklist (V5)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Required Tools
section "1. Required Tools"

required_tools=("psql" "redis-cli" "curl" "openssl" "jq" "node" "npm" "k6" "bc")

for tool in "${required_tools[@]}"; do
    if command -v "$tool" &> /dev/null; then
        check_pass "$tool installed"
    else
        check_fail "$tool not installed - please install before launch"
    fi
done

# Check Node version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        check_pass "Node.js version $NODE_VERSION (≥18 required)"
    else
        check_fail "Node.js version $NODE_VERSION (need ≥18)"
    fi
fi

# 2. Infrastructure Connectivity
section "2. Infrastructure Connectivity"

# Database
if [ -n "${DATABASE_URL:-}" ]; then
    if timeout 5 psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        check_pass "Database connection successful"
        
        # Check database size
        DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()))" | xargs)
        echo "   Database size: $DB_SIZE"
        
        # Check table counts
        TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" | xargs)
        echo "   Tables: $TABLE_COUNT"
    else
        check_fail "Cannot connect to database"
    fi
else
    check_fail "DATABASE_URL not set"
fi

# Redis
if [ -n "${REDIS_URL:-}" ]; then
    REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/\([^:]*\).*/\1/p')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
    
    if [ -z "$REDIS_PORT" ]; then
        REDIS_PORT=6379
    fi
    
    if timeout 5 redis-cli -h "${REDIS_HOST:-localhost}" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        check_pass "Redis connection successful"
        
        # Check memory
        REDIS_MEM=$(redis-cli -h "${REDIS_HOST:-localhost}" -p "$REDIS_PORT" INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        echo "   Redis memory: $REDIS_MEM"
    else
        check_warn "Cannot connect to Redis (queues will be disabled)"
    fi
else
    check_warn "REDIS_URL not set (queues disabled)"
fi

# Backend API
if [ -n "${BACKEND_URL:-}" ]; then
    if timeout 10 curl -f -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
        check_pass "Backend API responding"
        
        # Get detailed health
        HEALTH_JSON=$(curl -s "${BACKEND_URL}/health" || echo "{}")
        if command -v jq &> /dev/null; then
            STATUS=$(echo "$HEALTH_JSON" | jq -r '.status // "unknown"')
            echo "   Status: $STATUS"
        fi
    else
        check_fail "Backend API not responding at ${BACKEND_URL}/health"
    fi
else
    check_warn "BACKEND_URL not set - using localhost:3000"
    BACKEND_URL="http://localhost:3000"
fi

# Admin Dashboard
if [ -n "${ADMIN_DASHBOARD_URL:-}" ]; then
    if timeout 10 curl -f -s -o /dev/null "${ADMIN_DASHBOARD_URL}" 2>&1; then
        check_pass "Admin dashboard accessible"
    else
        check_warn "Admin dashboard not accessible (deploy may be pending)"
    fi
fi

# 3. Integration Health Checks
section "3. Integration Health Checks"

# DigiTax (canonical) with legacy alias fallback
if timeout 10 curl -f -s "${BACKEND_URL}/health/digitax" > /dev/null 2>&1; then
    DIGITAX_JSON=$(curl -s "${BACKEND_URL}/health/digitax" || echo "{}")
elif timeout 10 curl -f -s "${BACKEND_URL}/health/duplo" > /dev/null 2>&1; then
    DIGITAX_JSON=$(curl -s "${BACKEND_URL}/health/duplo" || echo "{}")
else
    DIGITAX_JSON="{}"
fi

if [ "$DIGITAX_JSON" != "{}" ]; then
    if command -v jq &> /dev/null; then
        DIGITAX_STATUS=$(echo "$DIGITAX_JSON" | jq -r '.status // "unknown"')
        if [ "$DIGITAX_STATUS" = "healthy" ]; then
            check_pass "DigiTax integration healthy"
        else
            check_warn "DigiTax status: $DIGITAX_STATUS"
        fi
    else
        check_pass "DigiTax endpoint responding"
    fi
else
    check_warn "DigiTax health check inconclusive"
fi

# Remita
if timeout 10 curl -f -s "${BACKEND_URL}/health/remita" > /dev/null 2>&1; then
    REMITA_JSON=$(curl -s "${BACKEND_URL}/health/remita" || echo "{}")
    if command -v jq &> /dev/null; then
        REMITA_STATUS=$(echo "$REMITA_JSON" | jq -r '.status // "unknown"')
        if [ "$REMITA_STATUS" = "healthy" ]; then
            check_pass "Remita integration healthy"
        else
            check_warn "Remita status: $REMITA_STATUS - manual verification recommended"
        fi
    else
        check_pass "Remita endpoint responding"
    fi
else
    check_warn "Remita health check inconclusive - manual verification recommended"
fi

# External Remita availability (fallback)
if curl -f -m 5 "https://api.remita.net/health" > /dev/null 2>&1; then
    check_pass "Remita external API reachable"
else
    check_warn "Remita public health endpoint unreachable - run manual payment test"
fi

# 4. Security Checks
section "4. Security Checks"

# Check for vulnerability scanner
if command -v trivy &> /dev/null; then
    echo "   Running Trivy security scan (this may take a minute)..."
    if trivy image --exit-code 1 --no-progress --severity HIGH,CRITICAL taxbridge:latest > /dev/null 2>&1; then
        check_pass "No HIGH/CRITICAL vulnerabilities found"
    else
        check_warn "Security scan found issues - review with 'trivy image taxbridge:latest'"
    fi
else
    check_warn "Trivy not installed - skipping vulnerability scan"
fi

# Stablecoin/Blockchain compliance prep (future)
if [ -n "${STABLECOIN_API_KEY:-}" ]; then
    check_pass "Stablecoin API configured (for future cross-border features)"
else
    check_warn "Stablecoin API not configured (optional for now)"
fi

# Required environment variables
required_vars=(
    "DATABASE_URL"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "ENCRYPTION_KEY"
    "DUPLO_API_KEY"
    "DUPLO_CLIENT_ID"
    "DUPLO_CLIENT_SECRET"
    "REMITA_MERCHANT_ID"
    "REMITA_API_KEY"
    "AFRICASTALKING_API_KEY"
    "AFRICASTALKING_USERNAME"
    "ADMIN_API_KEY"
)

required_vars+=("ML_MODEL_PATH")

for var in "${required_vars[@]}"; do
    if [ -n "${!var:-}" ]; then
        check_pass "$var configured"
    else
        check_fail "$var not set - required for production"
    fi
done

# ML-related env vars (for churn prediction)
if [ -n "${ML_MODEL_PATH:-}" ]; then
    if [ -f "${ML_MODEL_PATH}" ]; then
        # Validate model file size (< 10MB for performance)
        MODEL_SIZE=$(stat -f%z "${ML_MODEL_PATH}" 2>/dev/null || stat -c%s "${ML_MODEL_PATH}" 2>/dev/null || echo "0")
        MODEL_SIZE_MB=$((MODEL_SIZE / 1024 / 1024))
        
        if [ "$MODEL_SIZE_MB" -lt 10 ]; then
            check_pass "ML model found at $ML_MODEL_PATH (${MODEL_SIZE_MB}MB)"
        else
            check_warn "ML model too large (${MODEL_SIZE_MB}MB) - may impact performance"
        fi
        
        # Check TensorFlow.js is installed
        if npm list @tensorflow/tfjs-node --depth=0 &>/dev/null || npm list -g @tensorflow/tfjs-node --depth=0 &>/dev/null; then
            check_pass "TensorFlow.js installed"
        else
            check_fail "TensorFlow.js not installed - run: npm install @tensorflow/tfjs-node"
        fi
    else
        check_warn "ML_MODEL_PATH set but file not found (churn prediction disabled)"
    fi
else
    check_warn "ML_MODEL_PATH not set (churn prediction will be disabled)"
fi

# 5. Database Schema Validation
section "5. Database Schema Validation"

if [ -n "${DATABASE_URL:-}" ]; then
    # Check critical tables
    CRITICAL_TABLES=("users" "invoices" "payments" "sync_queue" "audit_logs")
    
    for table in "${CRITICAL_TABLES[@]}"; do
        if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table'" | grep -q 1; then
            check_pass "Table '$table' exists"
        else
            check_fail "Table '$table' missing - run migrations"
        fi
    done
    
    # Check indexes
    INDEX_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'" | xargs)
    if [ "$INDEX_COUNT" -gt 10 ]; then
        check_pass "Database indexes: $INDEX_COUNT"
    else
        check_warn "Only $INDEX_COUNT indexes found - performance may suffer"
    fi
fi

# 6. Performance Baselines
section "6. Performance Baselines"

if timeout 10 curl -f -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
    # Measure API latency
    START_TIME=$(date +%s%N)
    curl -s "${BACKEND_URL}/health" > /dev/null
    END_TIME=$(date +%s%N)
    LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ "$LATENCY" -lt 500 ]; then
        check_pass "API latency: ${LATENCY}ms (target <500ms)"
    else
        check_warn "API latency: ${LATENCY}ms (target <500ms) - may need optimization"
    fi
fi

# Check error rate (last 1000 requests)
if [ -n "${DATABASE_URL:-}" ]; then
    ERROR_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%ERROR%' AND created_at > NOW() - INTERVAL '1 hour'" 2>/dev/null | xargs || echo "0")
    if [ "$ERROR_COUNT" -lt 10 ]; then
        check_pass "Error rate: $ERROR_COUNT errors in last hour (target <10)"
    else
        check_warn "Error rate: $ERROR_COUNT errors in last hour - investigate logs"
    fi
fi

# 7. Backup & Recovery
section "7. Backup & Recovery"

# Check for recent backups
if [ -n "${DATABASE_URL:-}" ]; then
    # This is a placeholder - actual backup checking depends on your provider
    check_warn "Verify offsite backups manually (Supabase/Render dashboard)"
fi

# Check rollback readiness
if [ -d ".git" ]; then
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
    if [ "$LAST_TAG" != "none" ]; then
        check_pass "Last stable tag: $LAST_TAG (rollback target)"
    else
        check_warn "No git tags found - create v1.0.0 tag before launch"
    fi
fi

# 8. Monitoring & Alerting
section "8. Monitoring & Alerting"

# Check if metrics endpoint is enabled
if [ "${ENABLE_METRICS:-false}" = "true" ]; then
    if timeout 10 curl -f -s "${BACKEND_URL}/metrics" > /dev/null 2>&1; then
        check_pass "Metrics endpoint accessible (Prometheus format)"
    else
        check_warn "Metrics endpoint not accessible"
    fi
else
    check_warn "ENABLE_METRICS not set to 'true' - monitoring limited"
fi

# Check Sentry
if [ -n "${SENTRY_DSN:-}" ]; then
    check_pass "Sentry DSN configured (error tracking enabled)"
else
    check_warn "Sentry DSN not set - error tracking disabled"
fi

# 9. Compliance & Legal
section "9. Compliance & Legal"

# Check for NDPC compliance docs
if [ -f "docs/DPIA.md" ] || [ -f "docs/dpia.md" ]; then
    check_pass "DPIA document exists"
else
    check_warn "DPIA document not found - required for NDPC compliance"
fi

# Check for terms of service
if [ -f "docs/TERMS_OF_SERVICE.md" ] || [ -f "legal/terms.md" ]; then
    check_pass "Terms of Service document exists"
else
    check_warn "Terms of Service not found - required before launch"
fi

# Privacy policy
if [ -f "docs/PRIVACY_POLICY.md" ] || [ -f "legal/privacy.md" ]; then
    check_pass "Privacy Policy document exists"
else
    check_warn "Privacy Policy not found - required before launch"
fi

# Regulatory alerts endpoint (new in V5)
if timeout 10 curl -f -s "https://ndpc.gov.ng/api/alerts" > /dev/null 2>&1; then
    check_pass "NDPC alerts endpoint accessible"
else
    check_warn "NDPC alerts endpoint not checked (API may not exist yet)"
fi

# 10. Launch Readiness
section "10. Launch Readiness"

# Check if README is up to date
if [ -f "README.md" ]; then
    if grep -q "TaxBridge" "README.md"; then
        check_pass "README.md exists and mentions TaxBridge"
    else
        check_warn "README.md may be outdated"
    fi
fi

# Check if launch plan exists
if [ -f "docs/launch-plan.md" ]; then
    check_pass "Launch plan documented"
else
    check_warn "Launch plan not found at docs/launch-plan.md"
fi

# Check if runbook exists
if [ -f "docs/launch-day-runbook.md" ]; then
    check_pass "Launch day runbook documented"
else
    check_warn "Launch day runbook not found at docs/launch-day-runbook.md"
fi

# 11. Partnership & Community Readiness
section "11. Partnership & Community Readiness"

# Check SMEDAN contact documented
if [ -f "docs/community-strategy.md" ]; then
    if grep -q "SMEDAN" docs/community-strategy.md; then
        check_pass "SMEDAN partnership documented"
    else
        check_warn "SMEDAN partnership not documented in community-strategy.md"
    fi
else
    check_fail "community-strategy.md not found"
fi

# Check ambassador roster
if [ -f "partnerships/ambassadors.csv" ]; then
    AMBASSADOR_COUNT=$(tail -n +2 partnerships/ambassadors.csv | wc -l | xargs)
    if [ "$AMBASSADOR_COUNT" -ge 5 ]; then
        check_pass "Ambassador roster: $AMBASSADOR_COUNT ambassadors"
    else
        check_warn "Only $AMBASSADOR_COUNT ambassadors (target: 5+ for pilot)"
    fi
else
    check_warn "Ambassador roster not found (partnerships/ambassadors.csv)"
fi

# Check referral code generator endpoint
if [ -n "${BACKEND_URL:-}" ]; then
    REFERRAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/referral/generate" -H "Authorization: Bearer test-token" 2>/dev/null || echo "000")
    if [ "$REFERRAL_STATUS" = "200" ] || [ "$REFERRAL_STATUS" = "401" ]; then
        check_pass "Referral code generator endpoint active"
    else
        check_warn "Referral code generator not responding (HTTP $REFERRAL_STATUS)"
    fi
else
    check_warn "BACKEND_URL not set - cannot test referral endpoint"
fi

# Check growth service queues
if [ -n "${REDIS_URL:-}" ]; then
    EMAIL_QUEUE_LEN=$(redis-cli -u "$REDIS_URL" LLEN "bull:email-campaign:wait" 2>/dev/null || echo "0")
    SMS_QUEUE_LEN=$(redis-cli -u "$REDIS_URL" LLEN "bull:sms-campaign:wait" 2>/dev/null || echo "0")
    
    if [ "$EMAIL_QUEUE_LEN" != "ERROR" ] && [ "$SMS_QUEUE_LEN" != "ERROR" ]; then
        check_pass "Growth service queues initialized (email: $EMAIL_QUEUE_LEN, sms: $SMS_QUEUE_LEN pending)"
    else
        check_warn "Growth service queues not initialized"
    fi
fi

# Final Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Total checks: $CHECKS"
echo -e "${GREEN}Passed: $((CHECKS - ERRORS - WARNINGS))${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failures: $ERRORS${NC}"
echo ""

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -lt 5 ]; then
    echo -e "${GREEN}✓ System is READY for launch!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review warnings above"
    echo "  2. Execute launch day runbook: docs/launch-day-runbook.md"
    echo "  3. Notify team of launch time"
    echo ""
    exit 0
elif [ "$ERRORS" -eq 0 ]; then
    echo -e "${YELLOW}⚠ System has warnings but may proceed with caution${NC}"
    echo ""
    echo "Action required:"
    echo "  1. Review all warnings above"
    echo "  2. Address critical warnings before launch"
    echo "  3. Document acknowledged risks"
    echo ""
    exit 0
else
    echo -e "${RED}✗ System is NOT ready for launch${NC}"
    echo ""
    echo "Action required:"
    echo "  1. Fix all failures above"
    echo "  2. Run this script again"
    echo "  3. Do not proceed to launch until all checks pass"
    echo ""
    exit 1
fi
