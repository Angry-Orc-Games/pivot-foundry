#!/usr/bin/env bash
set -euo pipefail

runner=${1:?usage: e2e-overlay.sh <runner> <system>}
system=${2:?usage: e2e-overlay.sh <runner> <system>}

if [[ ! -d $runner || ! -d $system ]]; then
  printf '::error::e2e-overlay needs two directories\n' >&2
  exit 1
fi

runner=$(cd "$runner" && pwd)
system=$(cd "$system" && pwd)
if [[ $runner == "$system" ]]; then
  printf '::error::e2e-overlay refuses to copy a tree onto itself\n' >&2
  exit 1
fi

# /.npmrc, /postcss.config.*, and /.env* match the transfer root, like the
# rules above. .npmrc and .env* are repeated without the slash so a copy
# in a subdirectory is denied too. postcss.config.* stays root-anchored:
# Vite and PostCSS load that file from the project root.
rsync -a --delete \
  --exclude '/scripts/' \
  --exclude '/e2e/' \
  --exclude '/.github/' \
  --exclude '/foundry/' \
  --exclude '/package.json' \
  --exclude '/package-lock.json' \
  --exclude '/node_modules/' \
  --exclude '/.git/' \
  --exclude '/under-test/' \
  --exclude '/vite.config.*' \
  --exclude '/vitest.config.ts' \
  --exclude '/eslint.config.js' \
  --exclude '/tsconfig.json' \
  --exclude '/tsconfig.*.json' \
  --exclude '/.npmrc' \
  --exclude '.npmrc' \
  --exclude '/postcss.config.*' \
  --exclude '/.env*' \
  --exclude '.env*' \
  "$system"/ "$runner"/
