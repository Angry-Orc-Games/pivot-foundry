#!/usr/bin/env bash
set -euo pipefail

targets=${E2E_TARGETS:?}
results=${E2E_RESULTS_DIR:?}
matrix=${E2E_MATRIX_RESULT:-failure}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [[ $(jq -r 'type' <<<"$targets") != "array" ]]; then
  printf '::error::E2E target list is not a JSON array\n' >&2
  exit 1
fi

count=$(jq 'length' <<<"$targets")
if ((count == 0)); then
  printf '::error::No E2E targets to report\n' >&2
  exit 1
fi

failed=0
while IFS= read -r row; do
  name=$(jq -r '.name' <<<"$row")
  sha=$(jq -r '.sha' <<<"$row")
  file="${results}/${name}.json"
  if [[ -f $file ]]; then
    conclusion=$(jq -r '.conclusion // "failure"' "$file")
    summary=$(jq -r '.summary // "Foundry E2E produced no result."' "$file")
    if [[ $conclusion != success && $conclusion != failure ]]; then
      conclusion=failure
      summary="Foundry E2E produced an unusable result. Foundry was not reported as started."
    fi
  elif [[ $matrix == cancelled ]]; then
    conclusion=failure
    summary="Foundry E2E was cancelled or timed out. Foundry was not left running by this job."
  else
    conclusion=failure
    summary="Foundry E2E produced no result for this SHA. Foundry was not reported as started."
  fi
  if [[ $conclusion != success ]]; then
    failed=1
  fi
  if ! E2E_SHA="$sha" E2E_SUMMARY="$summary" bash "$script_dir/e2e-report.sh" "$conclusion"; then
    failed=1
  fi
done < <(jq -c '.[]' <<<"$targets")

exit "$failed"
