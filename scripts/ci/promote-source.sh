#!/usr/bin/env bash
set -euo pipefail

mode=${1:?usage: promote-source.sh run|bytes [dir]}
run_id=${STAGING_RUN_ID:?}
repo=${GITHUB_REPOSITORY:?}
api=${GITHUB_API_URL:?}
server=${GITHUB_SERVER_URL:?}
token=${GITHUB_TOKEN:?}

if [[ ! $run_id =~ ^[0-9]+$ ]]; then
  printf '::error::staging run id is not numeric\n' >&2
  exit 1
fi

auth=(
  -H "Authorization: Bearer ${token}"
  -H "Accept: application/vnd.github+json"
  -H "X-GitHub-Api-Version: 2022-11-28"
)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fetch() {
  local url=$1 dest=$2
  if ! curl -fsS "${auth[@]}" -o "$dest" "$url"; then
    printf '::error::GitHub API read failed\n' >&2
    exit 1
  fi
}

fetch "$api/repos/$repo/actions/runs/$run_id" "$work/run.json"

if ! jq -e --arg repo "$repo" '
  .name == "Deploy staging"
  and .path == ".github/workflows/deploy-staging.yml"
  and .head_branch == "main"
  and .conclusion == "success"
  and .status == "completed"
  and (.event == "workflow_run" or .event == "workflow_dispatch")
  and (.head_sha | type == "string" and test("^[0-9a-f]{40}$"))
  and (.repository.full_name | type == "string" and . == $repo)
' "$work/run.json" >/dev/null; then
  printf '::error::refusing staging run\n' >&2
  exit 1
fi

if [[ $mode == run ]]; then
  exit 0
fi
if [[ $mode != bytes ]]; then
  printf '::error::usage: promote-source.sh run|bytes [dir]\n' >&2
  exit 1
fi

dir=${2:?}
head=$(jq -er '.head_sha' "$work/run.json")
commit=$(jq -er '.commit // empty' "$dir/artifact-identity.json")
if [[ $commit != "$head" ]]; then
  printf '::error::artifact commit does not match the staging run\n' >&2
  exit 1
fi

fetch "$api/repos/$repo/commits/$head/statuses?per_page=100" "$work/statuses.json"
zip_sha=$(sha256sum -- "$dir/system.zip" | awk 'NR==1 { print $1 }')
expected="${server}/${repo}/actions/runs/${run_id}"

if ! jq -e --arg sha "$zip_sha" --arg url "$expected" '
  type == "array"
  and (
    [ .[] | select(.context == "pivot-staging-artifact") ][0]
    | .state == "success"
      and .description == ("sha256:" + $sha)
      and .target_url == $url
      and .creator.login == "github-actions[bot]"
  )
' "$work/statuses.json" >/dev/null; then
  printf '::error::staging sha256 was not recorded for this run\n' >&2
  exit 1
fi

printf '%s\n' "$zip_sha"
