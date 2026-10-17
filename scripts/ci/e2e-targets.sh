#!/usr/bin/env bash
set -euo pipefail

repo=${E2E_REPOSITORY:?}
event=${E2E_EVENT:?}
ref=${E2E_REF:-}
api=${GITHUB_API_URL:-https://api.github.com}
token=${GITHUB_TOKEN:?}

fail() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

is_sha() {
  [[ $1 =~ ^[0-9a-f]{40}$ ]]
}

api_get() {
  local url=$1
  local dest=$2
  curl -fsS \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -o "$dest" \
    "$url"
}

emit() {
  local json=$1
  printf '%s\n' "$json"
  if [[ -n ${GITHUB_OUTPUT:-} ]]; then
    local delim
    delim=$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')
    {
      printf 'targets<<%s\n' "$delim"
      printf '%s\n' "$json"
      printf '%s\n' "$delim"
    } >>"$GITHUB_OUTPUT"
  fi
}

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

if [[ $event == "workflow_dispatch" && -n $ref ]]; then
  if ! is_sha "$ref"; then
    fail "workflow_dispatch ref must be a 40-character commit SHA in this repository."
  fi
  if ! api_get "$api/repos/$repo/commits/$ref" "$workdir/commit.json"; then
    fail "Refusing ${ref}. It is not a commit in ${repo}, so Foundry secrets stay unused."
  fi
  sha=$(jq -er '.sha // empty' "$workdir/commit.json")
  if ! is_sha "$sha"; then
    fail "Refusing ${ref}. The commit lookup did not return a SHA."
  fi
  emit "$(jq -nc --arg sha "$sha" '[{sha:$sha,name:"dispatch"}]')"
  exit 0
fi

label_code=$(
  curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$api/repos/$repo/labels/e2e-nightly" || true
)
if [[ $label_code == "404" ]]; then
  curl -fsS -X POST \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    -o /dev/null \
    --data-binary '{"name":"e2e-nightly","color":"1D76DB","description":"Include this pull request head in the nightly Foundry E2E window."}' \
    "$api/repos/$repo/labels"
fi

if ! api_get "$api/repos/$repo/commits/main" "$workdir/main.json"; then
  fail "Could not read the main SHA for ${repo}."
fi
main_sha=$(jq -er '.sha // empty' "$workdir/main.json")
if ! is_sha "$main_sha"; then
  fail "The main lookup did not return a SHA."
fi

jq -n '[]' >"$workdir/pulls.json"
page=1
while ((page <= 10)); do
  if ! api_get "$api/repos/$repo/pulls?state=open&base=main&per_page=100&page=$page" "$workdir/page.json"; then
    fail "Could not list open pull requests for ${repo}."
  fi
  count=$(jq 'length' "$workdir/page.json")
  jq -s '.[0] + .[1]' "$workdir/pulls.json" "$workdir/page.json" >"$workdir/next.json"
  mv "$workdir/next.json" "$workdir/pulls.json"
  if ((count < 100)); then
    break
  fi
  page=$((page + 1))
done

jq -c --arg repo "$repo" --arg main "$main_sha" '
  [{sha:$main,name:"main"}] +
  [
    .[]
    | select(any(.labels[]?; .name == "e2e-nightly"))
    | select(.base.ref == "main")
    | select(.head.repo != null and .head.repo.fork != true and .head.repo.full_name == $repo)
    | select(.head.sha | test("^[0-9a-f]{40}$"))
    | select(.head.sha != $main)
    | {sha:.head.sha,name:("pr-" + (.number | tostring))}
  ]
' "$workdir/pulls.json" >"$workdir/targets.json"

emit "$(cat "$workdir/targets.json")"
