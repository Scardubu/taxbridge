#!/usr/bin/env bash
set -euo pipefail

run_node_tool() {
  local command="$1"

  if [[ -n "${WSL_DISTRO_NAME:-}" || -n "${MSYSTEM:-}" || -n "${MINGW_PREFIX:-}" ]]; then
    eval "$command"
    return
  fi

  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "$command"
    return
  fi

  eval "$command"
}

pass() {
  printf 'CHECK %s: PASS\n' "$1"
}

check_absent_pattern() {
  local label="$1"
  local command="$2"
  if eval "$command"; then
    printf 'CHECK %s: FAIL\n' "$label" >&2
    exit 1
  fi
  pass "$label"
}

check_present_command() {
  local label="$1"
  local command="$2"
  eval "$command"
  pass "$label"
}

check_present_command "1/8 CHANGELOG v13 entry" "grep -qF '## [13.' docs/CHANGELOG.md"
run_node_tool "npm run prompts:verify"
pass "2/8 prompt markers"
check_absent_pattern "3/8 contamination scan" "grep -Ern \"\\bFIRS\\b|from 'express'\" backend/src mobile/src admin/src packages --include='*.ts' --include='*.tsx' --include='*.json' | grep -v node_modules | grep -q ."
check_absent_pattern "4/8 forbidden legacy tokens" "grep -Ern \"NRSt|CRA[^A-Za-z0-9_]|CRA_|import.*ProgressBar\" backend/src mobile/src --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -q ."
check_absent_pattern "5/8 inline tax constants drift" "grep -Ern \"0\\.075|0\\.30|0\\.04|0\\.10\" backend/src mobile/src admin/src --include='*.ts' --include='*.tsx' | grep -v contracts | grep -v node_modules | grep -v '//.*0\\.' | grep -Ev '\\.test\\.|\\.spec\\.' | grep -Ev 'shadowOpacity|opacity|rgba|boxShadow|WEIGHTS\\.|@risk-weight|\\.min\\(|\\.max\\(|resolvedSize|Math\\.max|Math\\.min' | grep -q ."
check_absent_pattern "6/8 rogue redis constructors" "grep -Ern \"new IORedis|new Redis\" backend/src --include='*.ts' | grep -v 'backend/src/lib/redis.ts' | grep -v 'backend/src/services/eventBus.ts' | grep -q ."
check_absent_pattern "7/8 backend console.log" "grep -rn \"console\\.log\" backend/src --include='*.ts' | grep -v '//.*console\\.log' | grep -v '\\*.*console\\.log' | grep -q ."
run_node_tool "npx tsc --noEmit"
[ -s docs/api/openapi.json ]
pass "8/8 TypeScript + OpenAPI gate"

printf 'All 8 session-opening checks passed.\n'
