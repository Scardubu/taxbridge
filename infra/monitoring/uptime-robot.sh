#!/usr/bin/env bash
# TaxBridge Uptime Robot Monitor Setup
# Creates monitors for all critical endpoints including Duplo and Remita integrations
# Usage: ./uptime-robot.sh [--dry-run]
# API Key is pre-configured below, or override with UPTIMEROBOT_API_KEY env var
set -euo pipefail

# Pre-configured API key (provided by TaxBridge)
DEFAULT_API_KEY="u3190142-067fdd9005c914bd7b152b5a"
API_URL="${UPTIMEROBOT_API_URL:-https://api.uptimerobot.com/v2}"
BASE_DOMAIN="${TAXBRIDGE_DOMAIN:-api.taxbridge.ng}"
DRY_RUN="${1:-}"

# Use environment variable if set, otherwise use default
UPTIMEROBOT_API_KEY="${UPTIMEROBOT_API_KEY:-$DEFAULT_API_KEY}"

if [ -z "$UPTIMEROBOT_API_KEY" ]; then
  echo "Error: UPTIMEROBOT_API_KEY is not set" >&2
  exit 1
fi

# Create or update a monitor
# Args: name, url, type (1=HTTP, 2=Keyword, 3=Ping, 4=Port), interval (seconds), keyword (optional)
create_monitor() {
  local name="$1"
  local url="$2"
  local type="${3:-1}"
  local interval="${4:-300}"
  local keyword="${5:-}"
  local alert_contacts="${UPTIMEROBOT_ALERT_CONTACTS:-}"

  # Dry run mode - just print what would be created
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "🔍 [DRY RUN] Would create: $name -> $url (type=$type, interval=${interval}s)"
    return 0
  fi

  local data="api_key=$UPTIMEROBOT_API_KEY&format=json&friendly_name=$name&url=$url&type=$type&interval=$interval"
  
  if [ -n "$keyword" ]; then
    data="$data&keyword_type=1&keyword_value=$keyword"
  fi
  
  if [ -n "$alert_contacts" ]; then
    data="$data&alert_contacts=$alert_contacts"
  fi

  local response
  response=$(curl -sS -X POST "$API_URL/newMonitor" -d "$data" 2>/dev/null || echo '{"stat":"fail"}')
  
  if echo "$response" | grep -q '"stat":"ok"'; then
    echo "✅ Monitor created: $name -> $url"
  elif echo "$response" | grep -q 'already exists'; then
    echo "⚠️  Monitor already exists: $name"
  else
    echo "❌ Failed to create monitor: $name"
    echo "   Response: $response"
  fi
}

echo "=================================================="
echo "TaxBridge Uptime Monitor Setup (January 2026)"
echo "=================================================="
echo ""

# Core API Health Endpoints
echo "📡 Creating Core API Monitors..."
create_monitor "TaxBridge API Health" "https://$BASE_DOMAIN/health" 2 300 '"status":"ok"'
create_monitor "TaxBridge API Ready" "https://$BASE_DOMAIN/ready" 2 300 '"status":"ready"'
create_monitor "TaxBridge Metrics" "https://$BASE_DOMAIN/metrics" 1 600

# Integration Health Endpoints (Duplo/DigiTax for NRS e-invoicing)
echo ""
echo "🔗 Creating Duplo Integration Monitors..."
create_monitor "TaxBridge Duplo Health" "https://$BASE_DOMAIN/health/duplo" 2 300 '"status":"healthy"'
create_monitor "Duplo API Gateway" "https://api.duplo.co" 1 300

# Remita Payment Gateway Monitors
echo ""
echo "💳 Creating Remita Integration Monitors..."
create_monitor "TaxBridge Remita Health" "https://$BASE_DOMAIN/health/remita" 2 300 '"status":"healthy"'
create_monitor "Remita Gateway" "https://login.remita.net" 1 300
create_monitor "Remita Demo API" "https://remitademo.net" 1 600

# OCR Service Monitor
echo ""
echo "📷 Creating OCR Service Monitors..."
create_monitor "TaxBridge OCR Service" "https://ocr.$BASE_DOMAIN/health" 1 600

# Admin Dashboard
echo ""
echo "🖥️  Creating Admin Dashboard Monitors..."
create_monitor "TaxBridge Admin Dashboard" "https://admin.taxbridge.ng" 1 600

echo ""
echo "=================================================="
echo "Monitor setup complete!"
echo ""
echo "Dashboard: https://uptimerobot.com/dashboard"
echo "Free tier: 50 monitors, 5-min intervals, 3-month retention"
echo "==================================================" 
