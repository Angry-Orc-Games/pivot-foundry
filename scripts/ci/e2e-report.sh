#!/usr/bin/env bash
set -euo pipefail

conclusion=${1:?usage: e2e-report.sh success|failure|neutral}
sha=${E2E_SHA:?}
summary=${E2E_SUMMARY:?}
repo=${E2E_REPOSITORY:?}
run_id=${E2E_RUN_ID:?}
api=${GITHUB_API_URL:-https://api.github.com}
server=${GITHUB_SERVER_URL:-https://github.com}
token=${GITHUB_TOKEN:?}

case $conclusion in
  success | failure | neutral) ;;
  *)
    printf '::error::Unknown check conclusion\n' >&2
    exit 1
    ;;
esac

if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  printf '::error::Check run SHA must be 40 hex characters\n' >&2
  exit 1
fi
if [[ ! $run_id =~ ^[0-9]+$ ]]; then
  printf '::error::E2E run id is not numeric\n' >&2
  exit 1
fi

server=${server%/}
details="${server}/${repo}/actions/runs/${run_id}"
if [[ $summary != *"$details" ]]; then
  summary="${summary}"$'\n'"${details}"
fi

body=$(
  jq -nc \
    --arg sha "$sha" \
    --arg conclusion "$conclusion" \
    --arg summary "$summary" \
    --arg details "$details" \
    '{
      name: "Foundry E2E (nightly)",
      head_sha: $sha,
      status: "completed",
      conclusion: $conclusion,
      details_url: $details,
      output: { title: "Foundry E2E (nightly)", summary: $summary }
    }'
)

curl -fsS -X POST \
  -H "Authorization: Bearer ${token}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  --data-binary "$body" \
  -o /dev/null \
  "$api/repos/$repo/check-runs"
