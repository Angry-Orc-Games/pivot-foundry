#!/usr/bin/env bash
# Lint .github/workflows with a pinned, checksum-verified actionlint (linux amd64).
#
# Usage: lint-workflows.sh
#
# Shellcheck integration is off so the result does not depend on which shellcheck the host has.
set -euo pipefail

version=1.7.12
sha256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
archive="actionlint_${version}_linux_amd64.tar.gz"

if [ "$(uname -s)-$(uname -m)" != "Linux-x86_64" ]; then
  echo "lint-workflows.sh pins the linux amd64 actionlint build; run it on a Linux x86_64 host or in CI." >&2
  exit 2
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

curl -fsSL -o "$work/$archive" \
  "https://github.com/rhysd/actionlint/releases/download/v${version}/${archive}"
echo "${sha256}  ${work}/${archive}" | sha256sum -c -
tar -xzf "$work/$archive" -C "$work" actionlint

"$work/actionlint" -shellcheck= -color
