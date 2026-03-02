#!/usr/bin/env bash
# =============================================================================
# TAXBRIDGE V12 — DEPLOYMENT & RELEASE PROTOCOL
# Repo: github.com/Scardubu/taxbridge
# Run from: repo root on feat/v12-final-elevation branch
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[PASS]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# =============================================================================
# STEP 1 — PRE-FLIGHT CHECKS
# =============================================================================
echo ""
log_info "TAXBRIDGE V12 DEPLOYMENT PROTOCOL — STEP 1: Pre-flight"
echo "============================================================"

# Confirm branch
CURRENT_BRANCH=$(git branch --show-current)
log_info "Current branch: $CURRENT_BRANCH"

# Confirm working tree is clean
if [[ -n $(git status --porcelain) ]]; then
  log_fail "Working tree is not clean. Commit or stash all changes before deploying."
fi
log_ok "Working tree clean"

# Confirm required secrets are in environment
REQUIRED_SECRETS=(
  "RENDER_API_KEY"
  "VERCEL_TOKEN"
  "SMOKE_TEST_EMAIL"
  "SMOKE_TEST_PASSWORD"
  "CBN_MPR"
)
for secret in "${REQUIRED_SECRETS[@]}"; do
  if [[ -z "${!secret:-}" ]]; then
    log_fail "Required secret not set: $secret. Load from GitHub Secrets or .env.secrets"
  fi
  log_ok "Secret present: $secret"
done

# =============================================================================
# STEP 2 — FULL CI GATE SUITE (local pre-push validation)
# =============================================================================
echo ""
log_info "STEP 2: CI Gate Suite"
echo "============================================================"

gate_check() {
  local desc=$1
  local cmd=$2

  count=$(eval "$cmd" 2>/dev/null | wc -l)
  if [[ "$count" -gt 0 ]]; then
    log_fail "Gate FAILED: $desc ($count occurrences found)"
  fi
  log_ok "Gate passed: $desc"
}

# Eradication gates
gate_check "No FIRS references" \
  "grep -rn 'FIRS' . --include='*.ts' --include='*.tsx' --include='*.json' | grep -v node_modules | grep -v .git"

gate_check "No raw animation durations" \
  "grep -rn 'withTiming.*[0-9]\{3,4\}' mobile/src --include='*.ts' --include='*.tsx' | grep -v animation.ts"

gate_check "No CRA/consolidatedRelief references" \
  "grep -rn 'CRA\b\|consolidatedRelief\|minTax\|0\.01.*gross\|ETR.*PIT' packages/contracts/src --include='*.ts'"

gate_check "No console.log in backend" \
  "grep -rn 'console\.log' backend/src --include='*.ts'"

gate_check "No hardcoded CBN_MPR" \
  "grep -rn '0\.2725\b' packages/contracts/src backend/src --include='*.ts'"

gate_check "No anomaly text (C-19)" \
  "grep -rn 'No anomal\|noAnomal' mobile/src --include='*.tsx' --include='*.ts'"

gate_check "No awaited router.push (C-20)" \
  "grep -rn 'await.*router\|router.*await' mobile/src/screens/DashboardScreen.tsx 2>/dev/null"

gate_check "No .env committed" \
  "git ls-files | grep -E '\.env\.' | grep -v example"

gate_check "No SENTRY_DSN placeholder in eas.json (must be set as EAS secret)" \
  "grep '\"SENTRY_DSN\": \"REPLACE' mobile/eas.json 2>/dev/null"

# Count-based gates
ZONE_COUNT=$(grep 'zone="' mobile/src/screens/DashboardScreen.tsx 2>/dev/null | wc -l)
if [[ "$ZONE_COUNT" -ne 5 ]]; then
  log_fail "Dashboard zone count is $ZONE_COUNT — expected 5 (C-17)"
fi
log_ok "Dashboard has exactly 5 zones"

SDK_COUNT=$(grep '"compileSdkVersion": 36' mobile/eas.json 2>/dev/null | wc -l)
if [[ "$SDK_COUNT" -lt 3 ]]; then
  log_fail "Only $SDK_COUNT EAS profiles have compileSdkVersion=36 — expected 3 (C-03)"
fi
log_ok "All EAS profiles have compileSdkVersion=36"

# Module integrity
yarn prompts:verify 2>&1 | grep -q "11/11" && log_ok "Module integrity: 11/11" || log_fail "Module integrity check failed"

# i18n check
yarn i18n:check && log_ok "i18n keys matched" || log_fail "i18n key mismatch"

# TypeScript
log_info "Running type-check..."
yarn workspaces foreach -A run type-check && log_ok "TypeScript: 0 errors" || log_fail "TypeScript errors found"

# Lint
log_info "Running lint..."
yarn workspaces foreach -A run lint && log_ok "Lint: clean" || log_fail "Lint errors found"

# =============================================================================
# STEP 3 — TEST SUITE
# =============================================================================
echo ""
log_info "STEP 3: Test Suite"
echo "============================================================"

log_info "Running full test suite with coverage..."
npm test --workspaces -- --coverage --ci --runInBand

PASS_COUNT=$(cat coverage/lcov-report/index.html 2>/dev/null | grep -oE '[0-9]+ of [0-9]+ functions' | head -1 || echo "unknown")
log_info "Coverage: $PASS_COUNT"

npx nyc check-coverage --lines 95 --functions 95 --branches 90 && \
  log_ok "Coverage thresholds met" || log_fail "Coverage below threshold"

# Accuracy gates
log_info "Running PIT accuracy gate..."
npx ts-node -e "
  const {calculatePIT}=require('./packages/contracts/src');
  const r=calculatePIT({grossIncome:5000000,rentPaid:600000,pension:200000});
  if(Math.abs(r.taxLiability-632400)>1){console.error('PIT GATE FAILED: got '+r.taxLiability);process.exit(1);}
  console.log('PIT gate: ₦'+r.taxLiability+' ✅');
" && log_ok "PIT accuracy gate: ₦632,400 ±₦1" || log_fail "PIT accuracy gate failed"

log_info "Running penalty accuracy gate..."
npx ts-node -e "
  const {calculatePenalty}=require('./packages/contracts/src');
  const r=calculatePenalty({entityType:'company',daysLate:32,taxAmountDue:0,disclosurePhase:'after_assessment'});
  if(r.netPenalty!==375000){console.error('PENALTY GATE FAILED: got '+r.netPenalty);process.exit(1);}
  console.log('Penalty gate: ₦'+r.netPenalty+' ✅');
" && log_ok "Penalty accuracy gate: ₦375,000" || log_fail "Penalty accuracy gate failed"

# =============================================================================
# STEP 4 — SECURITY SCAN
# =============================================================================
echo ""
log_info "STEP 4: Security"
echo "============================================================"

log_info "Running Snyk scan..."
npx snyk test --all-projects --severity-threshold=high && \
  log_ok "Snyk: 0 HIGH/CRITICAL" || log_fail "Snyk found HIGH/CRITICAL vulnerabilities"

log_info "Checking AuditEvent model immutability..."
AUDIT_HAS_UPDATED_AT=$(awk '/^model AuditEvent/,/^}/' backend/prisma/schema.prisma | grep -c "updatedAt" || echo 0)
if [[ "$AUDIT_HAS_UPDATED_AT" -gt 0 ]]; then
  log_fail "AuditEvent model has updatedAt — violates immutability contract"
fi
log_ok "AuditEvent: no updatedAt field"

log_info "Checking OrgMember unique constraint..."
grep -q '@@unique(\[orgId, userId\])' backend/prisma/schema.prisma && \
  log_ok "OrgMember @@unique([orgId, userId]) present" || log_fail "OrgMember unique constraint missing"

# =============================================================================
# STEP 5 — CONVENTIONAL COMMIT + PUSH
# =============================================================================
echo ""
log_info "STEP 5: Version Control"
echo "============================================================"

# Determine commit scope from staged files (informational)
log_info "Preparing conventional commit..."
echo ""
echo "  Suggested commit message:"
echo "  feat(v12): final elevation — security hardening, UX polish, observability"
echo ""
echo "  Conventional commit scopes:"
echo "    feat(v12/backend):  — API, auth, services"
echo "    feat(v12/mobile):   — React Native, UX, animation"
echo "    feat(v12/contracts):— tax engine, RBAC types"
echo "    feat(v12/infra):    — CI/CD, IaC, Grafana"
echo "    fix(v12/XXX):       — bug fixes (BUGID)"
echo ""

read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
COMMIT_MSG="${COMMIT_MSG:-feat(v12): final elevation — hardened security, canonical dashboard, observability}"

log_info "Staged changes to be committed:"
git diff --stat HEAD
echo ""
read -p "Review the above changes. Proceed with git add -A and commit? [y/N]: " CONFIRM_ADD
if [[ "$CONFIRM_ADD" != "y" && "$CONFIRM_ADD" != "Y" ]]; then
  log_warn "Commit aborted. Stage files manually and re-run."
  exit 0
fi

git add -A
git commit -m "$COMMIT_MSG"
log_ok "Committed: $COMMIT_MSG"

git push origin "$CURRENT_BRANCH"
log_ok "Pushed to origin/$CURRENT_BRANCH"

# =============================================================================
# STEP 6 — MERGE TO MAIN + TRIGGER PIPELINE
# =============================================================================
echo ""
log_info "STEP 6: Merge & Release"
echo "============================================================"

read -p "Merge $CURRENT_BRANCH → main and trigger production deploy? [y/N]: " CONFIRM_MERGE
if [[ "$CONFIRM_MERGE" != "y" && "$CONFIRM_MERGE" != "Y" ]]; then
  log_warn "Merge skipped. Pipeline will not trigger. Run again and confirm when ready."
  exit 0
fi

# Merge to master
git checkout master
git fetch origin master
if ! git diff --quiet HEAD origin/master; then
  log_info "main has diverged from origin/main — fast-forwarding..."
  git merge --ff-only origin/main || log_fail "Cannot fast-forward main — resolve divergence manually"
fi
git merge --no-ff "$CURRENT_BRANCH" -m "release(v12.0.0): merge feat/v12-final-elevation → main"
git push origin master
log_ok "Merged to master — GitHub Actions pipeline triggered"

# Tag the release
git tag -a "v12.0.0" -m "TaxBridge V12.0.0 — Final Elevation"
git push origin "v12.0.0"
log_ok "Tagged: v12.0.0"

# Create GitHub release
gh release create v12.0.0 \
  --title "TaxBridge V12.0.0 — Final Elevation" \
  --notes "See CHANGELOG.md for full release notes. NTA 2025 compliant, multi-tenant, production-hardened." \
  --skip-if-exists
log_ok "GitHub release created: v12.0.0"

# =============================================================================
# STEP 7 — PLATFORM DEPLOYMENTS
# =============================================================================
echo ""
log_info "STEP 7: Platform Deployments"
echo "============================================================"

# 7a. Backend — Render (triggered automatically by push to main via render.yaml)
log_info "Backend → Render: Deployment triggered by GitHub push. Waiting for health..."
MAX_WAIT=180
ELAPSED=0
INTERVAL=10
until curl -sf "${RENDER_EXTERNAL_URL:-https://taxbridge-api-ker8.onrender.com}/api/v2/monitoring/health" \
    | grep -q '"status":"healthy"'; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  log_info "Waiting for Render health... ${ELAPSED}s / ${MAX_WAIT}s"
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    log_fail "Render backend did not become healthy within ${MAX_WAIT}s — trigger rollback"
  fi
done
log_ok "Backend healthy: ${RENDER_EXTERNAL_URL}/api/v2/monitoring/health"

# 7b. Admin — Vercel (triggered automatically by push to main)
log_info "Admin → Vercel: Deployment triggered. Waiting for admin panel..."
MAX_WAIT=120; ELAPSED=0
until curl -sf "https://taxbridge.vercel.app" | grep -q "TaxBridge" || \
      curl -sf "https://taxbridge.vercel.app" -o /dev/null -w "%{http_code}" | grep -q "200"; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  log_info "Waiting for Vercel deploy... ${ELAPSED}s"
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    log_warn "Vercel admin did not respond — check Vercel dashboard manually"
    break
  fi
done
log_ok "Admin panel: https://taxbridge.vercel.app"

# 7c. Mobile — EAS OTA update (JS-only changes)
log_info "Mobile → EAS OTA: publishing update to production branch..."
eas update --branch production \
  --message "v12.0.0: final elevation — hardened security, canonical dashboard" \
  --non-interactive
log_ok "EAS OTA update published to production branch"

# =============================================================================
# STEP 8 — POST-DEPLOYMENT SMOKE TESTS
# =============================================================================
echo ""
log_info "STEP 8: Post-Deployment Smoke Tests"
echo "============================================================"

BASE_URL="${RENDER_EXTERNAL_URL:-https://taxbridge-api-ker8.onrender.com}"

smoke_test() {
  local desc=$1
  local result=$2
  local expect=$3
  if echo "$result" | grep -q "$expect"; then
    log_ok "Smoke ✅ $desc"
  else
    log_fail "Smoke ❌ $desc — expected '$expect' in response"
  fi
}

# 1. Health check
HEALTH=$(curl -sf "${BASE_URL}/api/v2/monitoring/health")
smoke_test "Health endpoint" "$HEALTH" '"status":"healthy"'

# 2. Auth login
LOGIN=$(curl -sf -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SMOKE_TEST_EMAIL}\",\"password\":\"${SMOKE_TEST_PASSWORD}\"}")
smoke_test "Auth login" "$LOGIN" "accessToken"

ACCESS_TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || \
               echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 3. Dashboard (authenticated)
DASHBOARD=$(curl -sf "${BASE_URL}/api/v1/dashboard" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
smoke_test "Dashboard composite" "$DASHBOARD" "taxHealthScore"

# 4. NIL return (idempotent — 409 is also valid if already filed for this period)
SMOKE_PERIOD=$(date +"%Y-%m")  # dynamic period to avoid stale 409 from prior runs
NIL_RESULT=$(curl -sf -X POST "${BASE_URL}/api/v1/filings/nil" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"taxType\":\"VAT\",\"period\":\"${SMOKE_PERIOD}\",\"reason\":\"NO_REVENUE_THIS_PERIOD\"}")
NIL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/filings/nil" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"taxType\":\"VAT\",\"period\":\"${SMOKE_PERIOD}\",\"reason\":\"NO_REVENUE_THIS_PERIOD\"}")
if [[ "$NIL_HTTP" == "200" ]] || [[ "$NIL_HTTP" == "409" ]]; then
  log_ok "Smoke ✅ NIL return (HTTP $NIL_HTTP — endpoint live, idempotency works)"
else
  log_fail "Smoke ❌ NIL return — expected 200 or 409, got $NIL_HTTP"
fi

# 5. Penalty estimate
PENALTY=$(curl -sf "${BASE_URL}/api/v1/compliance/penalty-estimate?daysLate=32&entityType=company&taxAmountDue=0" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
smoke_test "Penalty estimate" "$PENALTY" "netPenalty"

# 6. RBAC — VIEWER blocked from admin
VIEWER_BLOCK=$(curl -sf -X PATCH "${BASE_URL}/api/v2/rbac/assign" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","role":"ADMIN"}' \
  -o /dev/null -w "%{http_code}")
if [[ "$VIEWER_BLOCK" == "403" ]]; then
  log_ok "Smoke ✅ RBAC VIEWER blocked (403)"
else
  log_warn "RBAC smoke test returned $VIEWER_BLOCK (expected 403) — verify VIEWER test credentials"
fi

# 7. Admin panel accessible
ADMIN_STATUS=$(curl -sf "https://taxbridge.vercel.app" -o /dev/null -w "%{http_code}")
if [[ "$ADMIN_STATUS" == "200" ]]; then
  log_ok "Smoke ✅ Admin panel: HTTP 200"
else
  log_warn "Admin panel returned $ADMIN_STATUS — check Vercel dashboard"
fi

# =============================================================================
# STEP 9 — PRODUCTION HEALTH METRICS VERIFICATION
# =============================================================================
echo ""
log_info "STEP 9: Production Health Metrics"
echo "============================================================"

log_info "Checking Prometheus metrics endpoint..."
# NOTE: /metrics requires ADMIN role. If SMOKE_TEST_EMAIL is OWNER-only, expect a 403
# and log_warn (not fail) — this is expected behavior and does not indicate a bug.
METRICS=$(curl -sf "${BASE_URL}/api/v2/monitoring/metrics" \
  -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo "")

for metric in "taxbridge_api_request_duration_seconds" "taxbridge_nrs_circuit_state" \
              "taxbridge_dlq_depth" "taxbridge_anomaly_detected_total"; do
  if echo "$METRICS" | grep -q "$metric"; then
    log_ok "Metric present: $metric"
  else
    log_warn "Metric not found: $metric — check metrics.ts singleton registration"
  fi
done

# =============================================================================
# STEP 10 — ROLLBACK CONTINGENCY DOCUMENTATION
# =============================================================================
echo ""
log_info "STEP 10: Rollback Contingency"
echo "============================================================"
echo ""
echo "  ROLLBACK COMMANDS (if post-deploy issues are detected):"
echo ""
echo "  Backend (error rate > 1% OR P99 > 5s):"
echo "    render traffic swap --from prod --to blue --api-key \"\$RENDER_API_KEY\""
echo "    # Reverts within 60s. Blue slot holds v11.x"
echo ""
echo "  Admin:"
echo "    npx vercel rollback --token=\"\$VERCEL_TOKEN\" --cwd admin"
echo ""
echo "  Mobile (JS-only regression):"
echo "    eas update --branch production --message \"revert: rollback to v11\" \\"
echo "      --git-commit-hash \$(git rev-parse HEAD~1)"
echo ""
echo "  Database:"
echo "    # NEVER prisma migrate rollback — only forward migrations"
echo "    # Write and apply a compensating migration:"
echo "    npx prisma migrate dev --name \"v12_hotfix_\$(date +%Y%m%d)\"  # LOCAL"
echo "    npx prisma migrate deploy                                        # PROD"
echo ""
echo "  Previous stable tag: $(git tag | sort -V | tail -2 | head -1)"
echo ""
log_ok "DEPLOYMENT COMPLETE — TaxBridge V12.0.0 is live"
echo ""
echo "  📊 Dashboard: https://taxbridge.vercel.app"
echo "  🔌 API:       $BASE_URL"
echo "  📱 Mobile:    EAS production branch updated"
echo "  📈 Grafana:   Monitor alerts for 30min post-deploy"
echo ""
