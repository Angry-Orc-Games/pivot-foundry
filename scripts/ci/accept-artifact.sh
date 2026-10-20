#!/usr/bin/env bash
set -euo pipefail

src=${1:?usage: accept-artifact.sh <artifact-dir> <dest-dir> <file> [file...]}
dest=${2:?usage: accept-artifact.sh <artifact-dir> <dest-dir> <file> [file...]}
shift 2

if (($# < 1)); then
  printf '::error::No artifact files were expected\n' >&2
  exit 1
fi
if [[ ! -d $src || -L $src ]]; then
  printf '::error::Artifact directory is missing\n' >&2
  exit 1
fi

for name in "$@"; do
  if [[ ! $name =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf '::error::Refusing artifact name %s\n' "$name" >&2
    exit 1
  fi
done

expected=$(printf '%s\n' "$@" | LC_ALL=C sort)
actual=$(find "$src" -mindepth 1 -printf '%P\n' | LC_ALL=C sort)
if [[ $actual != "$expected" ]]; then
  printf '::error::Artifact file set does not match the expected list\n' >&2
  exit 1
fi

while IFS= read -r entry; do
  [[ -n $entry ]] || continue
  if [[ ! $entry =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf '::error::Artifact path is not a single file name\n' >&2
    exit 1
  fi
done <<<"$actual"

mkdir -p "$dest"
for name in "$@"; do
  path="$src/$name"
  if [[ -L $path || ! -f $path ]]; then
    printf '::error::%s is not a regular file\n' "$name" >&2
    exit 1
  fi
  cp -- "$path" "$dest/$name"
done
