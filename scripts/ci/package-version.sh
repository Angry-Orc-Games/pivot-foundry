#!/usr/bin/env bash
set -euo pipefail

file=${1:?usage: package-version.sh system.json}
version=$(jq -er '.version // empty' "$file")
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  printf '::error::system.json version is empty or not semver-ish\n' >&2
  exit 1
fi
printf '%s\n' "$version"
