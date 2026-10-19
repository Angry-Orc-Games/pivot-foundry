#!/usr/bin/env bash
set -euo pipefail

dest=${1:?usage: e2e-record-result.sh <path>}
sha=${E2E_SHA:?}
run_id=${E2E_RUN_ID:?}
ok=${E2E_OK:-}
available=${E2E_AVAILABLE:-}
job=${E2E_JOB_STATUS:-failure}
log=${E2E_LOG:-}

if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  printf '::error::Result SHA must be 40 hex characters\n' >&2
  exit 1
fi
if [[ ! $run_id =~ ^[0-9]+$ ]]; then
  printf '::error::Result run id must be numeric\n' >&2
  exit 1
fi

listening=false
if [[ -n $log && -f $log ]] && grep -F "Server started and listening" "$log" | grep -F -v -q "did not log"; then
  listening=true
fi
timeout_summary=""
if [[ -n $log && -f $log ]]; then
  timeout_summary=$(
    grep -E -o "Foundry did not log Server started and listening within [0-9]+s" "$log" | head -n 1 || true
  )
fi

conclusion=failure
started=false
if [[ $ok != true ]]; then
  if [[ -z $ok ]]; then
    summary="Foundry E2E failed before the license recheck completed. Foundry was not started."
  else
    summary="License gate closed. Foundry was not started."
  fi
elif [[ $job == success && $available == true ]]; then
  conclusion=success
  started=true
  summary="Foundry started for E2E commit ${sha}."
else
  started_line="Foundry started for E2E commit ${sha}."
  setup_failure="Foundry setup failed. The End User License Agreement is on screen. Set FOUNDRY_E2E_ACCEPT_EULA=1 to sign it for this run. Tests were not run."
  if [[ -n $log && -f $log ]] && grep -F -q "$setup_failure" "$log"; then
    summary="$setup_failure"
    if [[ $listening == true ]]; then
      started=true
    fi
  elif [[ $listening == true ]]; then
    started=true
    summary="Server started and listening. ${started_line} The run failed after Foundry started."
  elif [[ -n $log && -f $log ]] && grep -F -q "$started_line" "$log"; then
    summary="${started_line} The run failed after Foundry started."
  elif [[ -n $timeout_summary ]]; then
    summary="$timeout_summary"
  elif [[ -n $log && -f $log ]] && grep -F -q "outside 02:00-05:30" "$log"; then
    summary="License gate closed before Foundry launched. Foundry was not started."
  else
    summary="Foundry did not start for ${sha}."
  fi
fi

started_json=false
if [[ $started == true ]]; then
  started_json=true
fi

mkdir -p "$(dirname "$dest")"
jq -nc \
  --arg sha "$sha" \
  --arg run_id "$run_id" \
  --arg conclusion "$conclusion" \
  --arg summary "$summary" \
  --argjson started "$started_json" \
  '{sha: $sha, run_id: $run_id, conclusion: $conclusion, summary: $summary, started: $started}' >"$dest"
