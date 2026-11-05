#!/usr/bin/env bash
# Wait for a Foundry host to answer /api/status, and optionally to serve a given system version.
#
# Usage: wait-for-foundry.sh <label> [<manifest-url> <expected-version>]
#
# Reads PIVOT_FOUNDRY_BASE_URL. PIVOT_WAIT_ATTEMPTS (default 36) and PIVOT_WAIT_INTERVAL
# (default 5 seconds) bound the wait. /api/status answers once the server is up. Its "active"
# flag only says a world is launched, which says nothing about a deploy, so it is not required.
set -euo pipefail

label=${1:?usage: wait-for-foundry.sh <label> [<manifest-url> <expected-version>]}
manifest_url=${2:-}
want=${3:-}
base=${PIVOT_FOUNDRY_BASE_URL:?PIVOT_FOUNDRY_BASE_URL is required}
attempts=${PIVOT_WAIT_ATTEMPTS:-36}
interval=${PIVOT_WAIT_INTERVAL:-5}

command -v jq >/dev/null || {
  echo "::error::jq is required." >&2
  exit 2
}

if [ -n "$manifest_url" ] && [ -z "$want" ]; then
  echo "::error::An expected version is required with a manifest URL." >&2
  exit 2
fi

for ((i = 0; i < attempts; i++)); do
  if curl -fsS --max-time 10 "$base/api/status" | jq -e '(.version | type) == "string"' >/dev/null 2>&1; then
    if [ -z "$manifest_url" ]; then
      echo "$label is up."
      exit 0
    fi
    if curl -fsS --max-time 10 "$manifest_url" | jq -e --arg want "$want" '.version == $want' >/dev/null 2>&1; then
      echo "$label is serving $want."
      exit 0
    fi
  fi
  sleep "$interval"
done

if [ -n "$manifest_url" ]; then
  echo "::error::$label did not serve $want within $((attempts * interval))s."
else
  echo "::error::$label did not answer /api/status within $((attempts * interval))s."
fi
exit 1
