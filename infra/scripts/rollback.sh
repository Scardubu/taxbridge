#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version-tag>" >&2
  exit 1
fi

target=$1
REGISTRY=${REGISTRY:-taxbridge}

printf "\n⏪ Rolling back to %s\n" "$target"

VERSION=$target docker compose -f infra/docker-compose.prod.yml pull || true
VERSION=$target docker compose -f infra/docker-compose.prod.yml up -d --remove-orphans

sleep 10
curl -fsS https://api.taxbridge.ng/health

printf "Rollback finished. Verify background workers and Redis queues before closing the incident.\n"
