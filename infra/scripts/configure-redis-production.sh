#!/bin/bash

# ============================================================================
# Redis Production Configuration Script
# ============================================================================
# 
# This script configures Redis for optimal production performance with TaxBridge.
# It sets the eviction policy to 'noeviction' and configures other production settings.
#
# Usage:
#   ./configure-redis-production.sh [redis-host] [redis-port] [redis-password]
#
# Examples:
#   ./configure-redis-production.sh localhost 6379
#   ./configure-redis-production.sh redis-15968.crce199.us-west-2-2.ec2.cloud.redislabs.com 15968 your-password
#
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REDIS_HOST="${1:-localhost}"
REDIS_PORT="${2:-6379}"
REDIS_PASSWORD="${3:-}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Redis Production Configuration${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Host: $REDIS_HOST"
echo "Port: $REDIS_PORT"
echo "Password: ${REDIS_PASSWORD:+****** (provided)}"
echo ""

# Build redis-cli command
REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
if [ -n "$REDIS_PASSWORD" ]; then
  REDIS_CLI="$REDIS_CLI -a $REDIS_PASSWORD --no-auth-warning"
fi

# Test connection
echo -e "${YELLOW}Testing Redis connection...${NC}"
if ! $REDIS_CLI PING > /dev/null 2>&1; then
  echo -e "${RED}❌ Failed to connect to Redis${NC}"
  echo "Please check your connection details and try again."
  exit 1
fi
echo -e "${GREEN}✅ Connected to Redis successfully${NC}"
echo ""

# Get current configuration
echo -e "${YELLOW}Current Redis Configuration:${NC}"
CURRENT_EVICTION=$($REDIS_CLI CONFIG GET maxmemory-policy | tail -n 1)
CURRENT_MAXMEMORY=$($REDIS_CLI CONFIG GET maxmemory | tail -n 1)
echo "  Eviction Policy: $CURRENT_EVICTION"
echo "  Max Memory: ${CURRENT_MAXMEMORY:-unlimited}"
echo ""

# Configure eviction policy
echo -e "${YELLOW}Configuring eviction policy...${NC}"
if [ "$CURRENT_EVICTION" = "noeviction" ]; then
  echo -e "${GREEN}✅ Eviction policy already set to 'noeviction'${NC}"
else
  echo "  Changing from '$CURRENT_EVICTION' to 'noeviction'"
  $REDIS_CLI CONFIG SET maxmemory-policy noeviction
  echo -e "${GREEN}✅ Eviction policy set to 'noeviction'${NC}"
fi
echo ""

# Configure max memory (if not set)
if [ "$CURRENT_MAXMEMORY" = "0" ]; then
  echo -e "${YELLOW}⚠️  Warning: Max memory is unlimited${NC}"
  echo "  Consider setting a max memory limit for production:"
  echo "  redis-cli CONFIG SET maxmemory 256mb"
  echo ""
fi

# Configure persistence settings
echo -e "${YELLOW}Configuring persistence settings...${NC}"
$REDIS_CLI CONFIG SET save "900 1 300 10 60 10000"
echo -e "${GREEN}✅ RDB persistence configured${NC}"
echo "  - Save after 900 sec if at least 1 key changed"
echo "  - Save after 300 sec if at least 10 keys changed"
echo "  - Save after 60 sec if at least 10000 keys changed"
echo ""

# Configure connection settings
echo -e "${YELLOW}Configuring connection settings...${NC}"
$REDIS_CLI CONFIG SET timeout 300
$REDIS_CLI CONFIG SET tcp-keepalive 300
echo -e "${GREEN}✅ Connection settings configured${NC}"
echo "  - Client timeout: 300 seconds"
echo "  - TCP keepalive: 300 seconds"
echo ""

# Configure slow log
echo -e "${YELLOW}Configuring slow log...${NC}"
$REDIS_CLI CONFIG SET slowlog-log-slower-than 10000
$REDIS_CLI CONFIG SET slowlog-max-len 128
echo -e "${GREEN}✅ Slow log configured${NC}"
echo "  - Log queries slower than 10ms"
echo "  - Keep last 128 slow queries"
echo ""

# Verify final configuration
echo -e "${YELLOW}Final Configuration:${NC}"
FINAL_EVICTION=$($REDIS_CLI CONFIG GET maxmemory-policy | tail -n 1)
FINAL_MAXMEMORY=$($REDIS_CLI CONFIG GET maxmemory | tail -n 1)
echo "  Eviction Policy: $FINAL_EVICTION"
echo "  Max Memory: ${FINAL_MAXMEMORY:-unlimited}"
echo ""

# Save configuration to disk (if supported)
echo -e "${YELLOW}Saving configuration to disk...${NC}"
if $REDIS_CLI CONFIG REWRITE > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Configuration saved to redis.conf${NC}"
else
  echo -e "${YELLOW}⚠️  CONFIG REWRITE not supported or failed${NC}"
  echo "  Configuration changes are in-memory only."
  echo "  Add these settings to your redis.conf file:"
  echo ""
  echo "  maxmemory-policy noeviction"
  echo "  save 900 1"
  echo "  save 300 10"
  echo "  save 60 10000"
  echo "  timeout 300"
  echo "  tcp-keepalive 300"
  echo "  slowlog-log-slower-than 10000"
  echo "  slowlog-max-len 128"
fi
echo ""

# Display cache statistics
echo -e "${YELLOW}Current Cache Statistics:${NC}"
KEYSPACE_HITS=$($REDIS_CLI INFO stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
KEYSPACE_MISSES=$($REDIS_CLI INFO stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
TOTAL_REQUESTS=$((KEYSPACE_HITS + KEYSPACE_MISSES))

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
  HIT_RATE=$(awk "BEGIN {printf \"%.2f\", ($KEYSPACE_HITS / $TOTAL_REQUESTS) * 100}")
  echo "  Total Requests: $TOTAL_REQUESTS"
  echo "  Cache Hits: $KEYSPACE_HITS"
  echo "  Cache Misses: $KEYSPACE_MISSES"
  echo "  Hit Rate: ${HIT_RATE}%"
  
  if (( $(echo "$HIT_RATE < 70" | bc -l) )); then
    echo -e "${YELLOW}  ⚠️  Hit rate below target (70%)${NC}"
  else
    echo -e "${GREEN}  ✅ Hit rate meets target${NC}"
  fi
else
  echo "  No cache requests yet"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Redis configuration complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Monitor cache hit rate: redis-cli INFO stats | grep keyspace_hits"
echo "  2. Check slow queries: redis-cli SLOWLOG GET 10"
echo "  3. Monitor memory usage: redis-cli INFO memory"
echo ""
