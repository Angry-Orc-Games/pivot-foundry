#!/usr/bin/env bash
set -euo pipefail

ref_name=${GITHUB_REF_NAME:?}
expected=${GITHUB_SHA:?}

read_remote_sha() {
  local ref=$1
  local line sha
  if ! line=$(git ls-remote origin "$ref"); then
    printf '::error::could not resolve %s on origin\n' "$ref" >&2
    return 1
  fi
  line=${line%%$'\n'*}
  sha=${line%%[[:space:]]*}
  printf '%s' "$sha"
}

if ! peeled=$(read_remote_sha "refs/tags/${ref_name}^{}"); then
  exit 1
fi

resolved=$peeled
if [[ -z $resolved ]]; then
  if ! resolved=$(read_remote_sha "refs/tags/${ref_name}"); then
    exit 1
  fi
fi

expected=$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')
resolved=$(printf '%s' "$resolved" | tr '[:upper:]' '[:lower:]')

if [[ -z $resolved || $resolved != "$expected" ]]; then
  printf '::error::tag %s points at %s, not %s\n' "$ref_name" "${resolved:-missing}" "$expected" >&2
  exit 1
fi
