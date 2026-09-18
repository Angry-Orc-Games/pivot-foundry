#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  sudo service docker start
  for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon did not become ready. Foundry commands will fail until Docker starts." >&2
  exit 1
fi

if [[ ! -f .env.foundry.local ]]; then
  umask 077
  {
    echo "# Generated from Cursor Runtime Secrets. Do not commit."
    echo "FOUNDRY_ADMIN_KEY=${FOUNDRY_ADMIN_KEY:-}"
    echo "FOUNDRY_LICENSE_KEY=${FOUNDRY_LICENSE_KEY:-}"
    if [[ -n "${FOUNDRY_RELEASE_ARCHIVE:-}" ]]; then
      echo "FOUNDRY_RELEASE_ARCHIVE=${FOUNDRY_RELEASE_ARCHIVE}"
    fi
    if [[ -n "${FOUNDRY_RELEASE_CACHE_URL:-}" ]]; then
      echo "FOUNDRY_RELEASE_CACHE_URL=${FOUNDRY_RELEASE_CACHE_URL}"
    fi
    if [[ -n "${FOUNDRY_RELEASE_SHA256:-}" ]]; then
      echo "FOUNDRY_RELEASE_SHA256=${FOUNDRY_RELEASE_SHA256}"
    fi
  } > .env.foundry.local
  chmod 600 .env.foundry.local
fi

echo "Cloud agent runtime is ready. Start Foundry with npm run foundry:up using this checkout."
