#!/usr/bin/env bash
set -euo pipefail

sha=${GITHUB_SHA:?}
repo=${GITHUB_REPOSITORY:?}
api=${GITHUB_API_URL:-https://api.github.com}
token=${GITHUB_TOKEN:?}

fail() {
  printf '::error::%s\n' "$1" >&2
  exit 1
}

if [[ ! $sha =~ ^[0-9a-f]{40}$ || ! $repo =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
  fail "Foundry E2E (nightly) check is unverifiable"
fi

auth=(
  -H "Authorization: Bearer ${token}"
  -H "Accept: application/vnd.github+json"
  -H "X-GitHub-Api-Version: 2022-11-28"
)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

checks_url="$api/repos/$repo/commits/$sha/check-runs?check_name=Foundry%20E2E%20(nightly)&filter=latest"
if ! curl -fsS --max-time 20 "${auth[@]}" -o "$work/checks.json" "$checks_url"; then
  fail "Foundry E2E (nightly) check is unverifiable"
fi

if ! decision=$(jq -c --arg sha "$sha" '
  def run_ids($text):
    if $text == null then []
    else [$text | tostring | scan("actions/runs/([0-9]+)") | .[0]]
    end;
  def fail($message): {ok: false, error: $message};
  .check_runs as $runs
  | if ($runs | type) != "array" or ($runs | length) == 0 then
      fail("Foundry E2E (nightly) check is missing")
    elif ($runs | length) != 1 or .total_count != 1 then
      fail("Foundry E2E (nightly) check is unverifiable")
    else
      $runs[0] as $c
      | if ($c | type) != "object" then
          fail("Foundry E2E (nightly) check is unverifiable")
        elif $c.app.slug != "github-actions" then
          fail("Foundry E2E (nightly) check was not published by github-actions")
        elif $c.conclusion == "failure" then
          fail("Foundry E2E (nightly) check failed")
        elif $c.conclusion == "neutral" then
          fail("Foundry E2E (nightly) check is neutral")
        elif $c.conclusion != "success" or $c.status != "completed" or $c.head_sha != $sha then
          fail("Foundry E2E (nightly) check is unverifiable")
        else
          (run_ids($c.details_url) + run_ids($c.output.summary)) as $found
          | ($found | unique) as $ids
          | if ($ids | length) != 1 or ($ids[0] | test("^[1-9][0-9]*$") | not) then
              fail("Foundry E2E (nightly) check is unverifiable")
            else
              {ok: true, run_id: $ids[0]}
            end
        end
    end
' "$work/checks.json"); then
  fail "Foundry E2E (nightly) check is unverifiable"
fi

if [[ $(jq -r '.ok' <<<"$decision") != true ]]; then
  fail "$(jq -r '.error' <<<"$decision")"
fi
run_id=$(jq -r '.run_id' <<<"$decision")
if [[ ! $run_id =~ ^[1-9][0-9]*$ ]]; then
  fail "Foundry E2E (nightly) check is unverifiable"
fi

if ! curl -fsS --max-time 20 "${auth[@]}" -o "$work/run.json" \
  "$api/repos/$repo/actions/runs/$run_id"; then
  fail "Foundry E2E (nightly) check is unverifiable"
fi

if ! jq -e '
  .path == ".github/workflows/e2e.yml"
  and (.event == "schedule" or .event == "workflow_dispatch")
  and .head_branch == "main"
' "$work/run.json" >/dev/null; then
  fail "Foundry E2E (nightly) check is unverifiable"
fi
