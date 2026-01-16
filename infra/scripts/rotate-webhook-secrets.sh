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

TARGET_KEYS=(
  "WEBHOOK_SECRET"
  "REMITA_WEBHOOK_SECRET"
  "DIGITAX_HMAC_SECRET"
)

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
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

for key in "${TARGET_KEYS[@]}"; do
  NEW_VALUE=$(generate_secret)
  set_value "$key" "$NEW_VALUE"
  echo "🔐 Rotated $key"
done
echo ""

echo "✅ Webhook + HMAC secrets rotated. Deploy the backend before acknowledging any new callbacks."
