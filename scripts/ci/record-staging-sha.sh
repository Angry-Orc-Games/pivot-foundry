#!/usr/bin/env bash
set -euo pipefail

dir=${1:?usage: record-staging-sha.sh DIR}
repo=${GITHUB_REPOSITORY:?}
api=${GITHUB_API_URL:?}
server=${GITHUB_SERVER_URL:?}
token=${GITHUB_TOKEN:?}
run_id=${GITHUB_RUN_ID:?}

if [[ ! $run_id =~ ^[0-9]+$ ]]; then
  printf '::error::run id is not numeric\n' >&2
  exit 1
fi

commit=$(jq -er '.commit // empty' "$dir/artifact-identity.json")
if [[ ! $commit =~ ^[0-9a-f]{40}$ ]]; then
  printf '::error::artifact commit is not 40 hex characters\n' >&2
  exit 1
fi

sha=$(sha256sum -- "$dir/system.zip" | awk 'NR==1 { print $1 }')
if [[ ! $sha =~ ^[0-9a-f]{64}$ ]]; then
  printf '::error::system.zip sha256 is missing\n' >&2
  exit 1
fi

body=$(
  jq -nc \
    --arg description "sha256:${sha}" \
    --arg target "${server}/${repo}/actions/runs/${run_id}" \
    '{state:"success",context:"pivot-staging-artifact",description:$description,target_url:$target}'
)

if ! curl -fsS -X POST \
  -H "Authorization: Bearer ${token}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  --data-binary "$body" \
  -o /dev/null \
  "$api/repos/$repo/statuses/$commit"; then
  printf '::error::GitHub API write failed\n' >&2
  exit 1
fi
