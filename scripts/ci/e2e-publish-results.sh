#!/usr/bin/env bash
set -euo pipefail

targets=${E2E_TARGETS:?}
run_id=${E2E_RUN_ID:?}
repo=${E2E_REPOSITORY:?}
matrix=${E2E_MATRIX_RESULT:-failure}
api=${GITHUB_API_URL:-https://api.github.com}
token=${GITHUB_TOKEN:?}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [[ ! $run_id =~ ^[0-9]+$ ]]; then
  printf '::error::E2E run id is not numeric\n' >&2
  exit 1
fi
if [[ $(jq -r 'type' <<<"$targets") != "array" ]]; then
  printf '::error::E2E target list is not a JSON array\n' >&2
  exit 1
fi

skipped=${E2E_SKIPPED:-}
gate_ok=${E2E_GATE_OK:-}
count=$(jq 'length' <<<"$targets")
if ((count == 0)); then
  printf '::error::No E2E targets to report\n' >&2
  exit 1
fi

auth=(-H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

list_artifacts() {
  curl -fsS "${auth[@]}" "$api/repos/$repo/actions/runs/$run_id/artifacts?per_page=100&page=1"
}

valid_result() {
  local file=$1
  local sha=$2
  jq -e --arg sha "$sha" --arg run "$run_id" '
    type == "object"
    and (keys | sort) == ["conclusion", "run_id", "sha", "started", "summary"]
    and (.started | type == "boolean")
    and (.sha | type == "string")
    and .sha == $sha
    and (.sha | test("^[0-9a-f]{40}$"))
    and (.run_id | type == "string")
    and .run_id == $run
    and (.run_id | test("^[0-9]+$"))
    and (.conclusion | type == "string")
    and (.conclusion == "success" or .conclusion == "failure" or .conclusion == "neutral")
    and (.summary | type == "string" and length > 0 and length <= 2000)
  ' "$file" >/dev/null
}

unpack_artifact() {
  local archive=$1
  local dest=$2
  python3 - "$archive" "$dest" <<'PY' || return $?
import sys
import zipfile

archive, dest = sys.argv[1], sys.argv[2]
try:
    bundle = zipfile.ZipFile(archive)
except zipfile.BadZipFile:
    sys.exit(1)
with bundle:
    for info in bundle.infolist():
        parts = info.filename.split("/")
        if info.filename.startswith("/") or info.filename.startswith("\\") or ".." in parts:
            sys.exit(2)
    bundle.extractall(dest)
PY
}

post_result() {
  local sha=$1
  local conclusion=$2
  local summary=$3
  local started=${4:-}
  if ! E2E_SHA="$sha" E2E_SUMMARY="$summary" E2E_STARTED="$started" bash "$script_dir/e2e-report.sh" "$conclusion"; then
    return 1
  fi
}

kept_summary() {
  local file=$1
  local sha=$2
  jq -r --arg sha "$sha" --arg run "$run_id" '
    if type == "object"
      and (.sha == $sha)
      and (.run_id == $run)
      and (.summary | type == "string")
      and (.summary | length > 0 and length <= 2000)
    then .summary
    else empty
    end
  ' "$file" 2>/dev/null || true
}

failed=0
catalog=""
if ! catalog=$(list_artifacts); then
  catalog=""
fi
if [[ -n $catalog ]]; then
  total=$(jq '.total_count // 0' <<<"$catalog")
  if ((total > 100)); then
    printf '::error::Too many artifacts to validate Foundry E2E results\n' >&2
    catalog=""
    failed=1
  fi
fi

while IFS= read -r row; do
  name=$(jq -r '.name' <<<"$row")
  sha=$(jq -r '.sha' <<<"$row")
  conclusion=failure
  started_value=""
  summary="Foundry E2E produced no result for this SHA. Foundry was not reported as started."
  if [[ ! $name =~ ^[A-Za-z0-9._-]+$ || ! $sha =~ ^[0-9a-f]{40}$ ]]; then
    summary="Foundry E2E target failed validation. Foundry was not reported as started."
    failed=1
  elif [[ $skipped == true ]]; then
    conclusion=neutral
    if [[ -n ${E2E_SKIP_REASON:-} ]]; then
      summary="Skipped. ${E2E_SKIP_REASON} Foundry was not started."
    else
      summary="Skipped because somebody is signed in on foundry.angryorcgames.com or build.angryorcgames.com. Foundry was not started."
    fi
  elif [[ -n $gate_ok && $gate_ok != true ]]; then
    summary="License gate closed. Foundry was not started."
    failed=1
  elif [[ -z $catalog ]]; then
    if [[ $matrix == cancelled ]]; then
      summary="Foundry E2E was cancelled or timed out. Foundry was not left running by this job."
    else
      summary="Foundry E2E result could not be read for this run. Foundry was not reported as started."
    fi
    failed=1
  else
    artifact_name="e2e-result-${name}"
    matches=$(jq -c --arg name "$artifact_name" --arg run "$run_id" '
      [.artifacts[]
        | select(.name == $name and ((.workflow_run.id | tostring) == $run) and .expired == false)]
    ' <<<"$catalog")
    match_count=$(jq 'length' <<<"$matches")
    if ((match_count != 1)); then
      if [[ $matrix == cancelled ]]; then
        summary="Foundry E2E was cancelled or timed out. Foundry was not left running by this job."
      else
        summary="Foundry E2E result for this run was missing or duplicated. Foundry was not reported as started."
      fi
      failed=1
    else
      work=$(mktemp -d)
      url=$(jq -r '.[0].archive_download_url' <<<"$matches")
      json_count=0
      jsons=()
      attempt=0
      while ((attempt < 3)); do
        attempt=$((attempt + 1))
        rm -rf "$work/unpack" "$work/artifact.zip"
        downloaded=false
        if [[ $url == https://* ]]; then
          http_code=$(curl -fsS -L "${auth[@]}" -o "$work/artifact.zip" -w "%{http_code}" "$url" || true)
          size=0
          if [[ -f $work/artifact.zip ]]; then
            size=$(wc -c <"$work/artifact.zip" | tr -d ' ')
          fi
          if [[ -s $work/artifact.zip ]] && unpack_artifact "$work/artifact.zip" "$work/unpack"; then
            downloaded=true
          else
            printf '::warning::Foundry E2E artifact download was empty or not a zip. HTTP %s, %s bytes\n' "${http_code:-000}" "$size" >&2
          fi
        fi
        if [[ $downloaded == true ]]; then
          mapfile -t jsons < <(find "$work/unpack" -type f -name '*.json' | sort)
          json_count=${#jsons[@]}
          if ((json_count == 1)); then
            break
          fi
        fi
        json_count=0
        if ((attempt < 3)); then
          sleep 1
        fi
      done
      if ((json_count == 1)) && valid_result "${jsons[0]}" "$sha"; then
        conclusion=$(jq -r '.conclusion' "${jsons[0]}")
        summary=$(jq -r '.summary' "${jsons[0]}")
        started_value=$(jq -r '.started' "${jsons[0]}")
        if [[ $conclusion != success && $conclusion != neutral ]]; then
          failed=1
        fi
      else
        validation_error="Foundry E2E result failed validation for this run."
        kept=""
        if ((json_count == 1)); then
          kept=$(kept_summary "${jsons[0]}" "$sha")
        fi
        if [[ -n $kept ]]; then
          summary="${kept}"$'\n\n'"${validation_error}"
        else
          summary="${validation_error} Foundry was not reported as started."
        fi
        failed=1
      fi
      rm -rf "$work"
    fi
  fi
  if ! post_result "$sha" "$conclusion" "$summary" "${started_value:-}"; then
    failed=1
  fi
done < <(jq -c '.[]' <<<"$targets")

exit "$failed"
