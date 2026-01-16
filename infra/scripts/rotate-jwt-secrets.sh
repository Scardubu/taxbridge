#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${1:-"../backend/.env.production"}
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Environment file not found at $ENV_FILE" >&2
  exit 1
fi

BACKUP_FILE="$ENV_FILE.$(date +%Y%m%d%H%M%S).bak"
cp "$ENV_FILE" "$BACKUP_FILE"
echo "📦 Backup created → $BACKUP_FILE"

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
}

normalize() {
  echo "$1" | sed 's/^"//;s/"$//'
}

current_value() {
  local key="$1"
  local value=$(grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d'=' -f2- || true)
  normalize "$value"
}

set_value() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    perl -0pi -e "s/^${key}=.*$/${key}=\"${value}\"/" "$ENV_FILE"
  else
    printf '\n%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

CURRENT_JWT=$(current_value "JWT_SECRET")
CURRENT_REFRESH=$(current_value "JWT_REFRESH_SECRET")

NEW_JWT=$(generate_secret)
NEW_REFRESH=$(generate_secret)

if [ -n "$CURRENT_JWT" ]; then
  set_value "JWT_SECRET_PREVIOUS" "$CURRENT_JWT"
fi
if [ -n "$CURRENT_REFRESH" ]; then
  set_value "JWT_REFRESH_SECRET_PREVIOUS" "$CURRENT_REFRESH"
fi

set_value "JWT_SECRET" "$NEW_JWT"
set_value "JWT_REFRESH_SECRET" "$NEW_REFRESH"

cat <<"EON"
✅ JWT secrets rotated.
- JWT_SECRET updated
- JWT_SECRET_PREVIOUS now holds the last active key
- JWT_REFRESH_SECRET updated
- JWT_REFRESH_SECRET_PREVIOUS now holds the last active key

Next steps:
1. Deploy the backend so both current + previous secrets are available in runtime.
2. After 24 hours (or once you are sure no tokens reference the previous key), manually clear *_PREVIOUS if you need to force-expire legacy tokens.
EON
