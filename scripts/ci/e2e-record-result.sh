#!/usr/bin/env bash
set -euo pipefail

dest=${1:?usage: e2e-record-result.sh <path>}
sha=${E2E_SHA:?}
ok=${E2E_OK:-}
available=${E2E_AVAILABLE:-}
job=${E2E_JOB_STATUS:-failure}
log=${E2E_LOG:-}

if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  printf '::error::Result SHA must be 40 hex characters\n' >&2
  exit 1
fi

conclusion=failure
if [[ $ok != true ]]; then
  if [[ -z $ok ]]; then
    summary="Foundry E2E failed before the license recheck completed. Foundry was not started."
  else
    summary="License gate closed. Foundry was not started."
  fi
elif [[ $job == success && $available == true ]]; then
  conclusion=success
  summary="Foundry started for E2E commit ${sha}."
else
  started="Foundry started for E2E commit ${sha}."
  if [[ -n $log && -f $log ]] && grep -F -q "$started" "$log"; then
    summary="${started} The run failed after Foundry started."
  else
    summary="Foundry did not start for ${sha}."
  fi
fi

mkdir -p "$(dirname "$dest")"
jq -nc \
  --arg sha "$sha" \
  --arg conclusion "$conclusion" \
  --arg summary "$summary" \
  '{sha: $sha, conclusion: $conclusion, summary: $summary}' >"$dest"
