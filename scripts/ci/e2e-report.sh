#!/usr/bin/env bash
set -euo pipefail

conclusion=${1:?usage: e2e-report.sh success|failure|neutral}
sha=${E2E_SHA:?}
summary=${E2E_SUMMARY:?}
repo=${E2E_REPOSITORY:?}
name=${E2E_CHECK_NAME:-Foundry E2E (nightly)}
api=${GITHUB_API_URL:-https://api.github.com}
token=${GITHUB_TOKEN:?}

case $conclusion in
  success | failure | neutral) ;;
  *)
    printf '::error::Unknown check conclusion\n' >&2
    exit 1
    ;;
esac

case $name in
  "Foundry E2E (nightly)" | "Foundry E2E (on-demand)") ;;
  *)
    printf '::error::Unknown Foundry E2E check name\n' >&2
    exit 1
    ;;
esac

if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  printf '::error::Check run SHA must be 40 hex characters\n' >&2
  exit 1
fi

started=${E2E_STARTED:-}
case $started in
  true | false) ;;
  *) started="" ;;
esac

if [[ -n $started ]]; then
  body=$(
    jq -nc \
      --arg sha "$sha" \
      --arg conclusion "$conclusion" \
      --arg summary "$summary" \
      --arg name "$name" \
      --arg text "started=${started}" \
      '{
        name: $name,
        head_sha: $sha,
        status: "completed",
        conclusion: $conclusion,
        output: { title: $name, summary: $summary, text: $text }
      }'
  )
else
  body=$(
    jq -nc \
      --arg sha "$sha" \
      --arg conclusion "$conclusion" \
      --arg summary "$summary" \
      --arg name "$name" \
      '{
        name: $name,
        head_sha: $sha,
        status: "completed",
        conclusion: $conclusion,
        output: { title: $name, summary: $summary }
      }'
  )
fi

curl -fsS -X POST \
  -H "Authorization: Bearer ${token}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  --data-binary "$body" \
  -o /dev/null \
  "$api/repos/$repo/check-runs"
