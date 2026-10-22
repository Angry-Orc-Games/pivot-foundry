#!/usr/bin/env bash
set -euo pipefail

mode=${1:?usage: e2e-gate.sh license|require|secrets}

write_output() {
  local key=$1
  local value=$2
  if [[ -n ${GITHUB_OUTPUT:-} ]]; then
    printf '%s=%s\n' "$key" "$value" >>"$GITHUB_OUTPUT"
  fi
}

close_gate() {
  local reason=$1
  write_output ok false
  if [[ ${E2E_GATE_MODE:-} == dispatch ]]; then
    printf '::error::Foundry was not started. %s\n' "$reason"
  elif [[ $mode == require ]]; then
    printf '::error::Re-run inside the 02:00-05:30 ET window. Foundry was not started. %s\n' "$reason"
  else
    printf '::error::Foundry was not started. %s\n' "$reason"
  fi
  exit 1
}

read_count() {
  local host=$1
  local url=$2
  local body decision curl_status
  body=$(curl -fsS --max-time 20 "$url") && curl_status=0 || curl_status=$?
  if ((curl_status != 0)); then
    if ((curl_status == 22)); then
      status_refusal="status request to ${host} was not HTTP success (shared Foundry license)"
    else
      status_refusal="could not reach ${host} (shared Foundry license)"
    fi
    return 1
  fi
  decision=$(
    printf '%s' "$body" | jq -r 'if type != "object" then "bad-users" elif (.users | type) == "number" and (.users | floor) == .users and .users >= 0 then "count:\(.users)" elif .active == false and (has("users") | not) then "count:0" else "bad-users" end' 2>/dev/null
  ) || true
  if [[ $decision == count:* && ${decision#count:} =~ ^[0-9]+$ ]]; then
    count=${decision#count:}
    return 0
  fi
  if [[ -z $decision ]]; then
    status_refusal="could not parse status JSON from ${host} (shared Foundry license)"
  else
    status_refusal="could not read user count from ${host} (shared Foundry license)"
  fi
  return 1
}

license_gate() {
  local clock hour minute count host url reason status_refusal
  local -a busy=()
  local skip_window=0

  if [[ ${E2E_GATE_MODE:-} == dispatch ]]; then
    skip_window=1
    write_output on_demand true
  fi

  if ((skip_window == 0)); then
    if ! clock=$(TZ=America/New_York date +%H%M); then
      close_gate "could not read America/New_York clock (shared Foundry license)"
    fi
    if [[ ! $clock =~ ^[0-9]{4}$ ]]; then
      close_gate "could not read America/New_York clock (shared Foundry license)"
    fi

    hour=${clock:0:2}
    minute=${clock:2:2}
    case $hour in
      02|03|04) ;;
      05)
        if ((10#$minute >= 30)); then
          close_gate "outside 02:00-05:30 ET quiet hours (shared Foundry license)"
        fi
        ;;
      *)
        close_gate "outside 02:00-05:30 ET quiet hours (shared Foundry license)"
        ;;
    esac
  fi

  for entry in \
    "foundry.angryorcgames.com|https://foundry.angryorcgames.com/api/status" \
    "build.angryorcgames.com|https://build.angryorcgames.com/api/status"; do
    host=${entry%%|*}
    url=${entry#*|}
    if ! read_count "$host" "$url"; then
      close_gate "$status_refusal"
    fi
    if ((count > 0)); then
      busy+=("$host")
    fi
  done

  if ((${#busy[@]} == 2)); then
    reason="somebody is signed in on ${busy[0]} and ${busy[1]} (shared Foundry license)"
  elif ((${#busy[@]} == 1)); then
    reason="somebody is signed in on ${busy[0]} (shared Foundry license)"
  fi
  if [[ -n ${reason:-} ]]; then
    if [[ ${E2E_GATE_MODE:-} == dispatch && ${E2E_GATE_SOFT_SKIP:-} == true ]]; then
      write_output ok false
      write_output skipped true
      write_output skip_reason "$reason"
      printf 'Foundry was not started. %s\n' "$reason"
      exit 0
    fi
    if [[ ${E2E_GATE_MODE:-} == dispatch ]]; then
      write_output skipped true
    fi
    close_gate "$reason"
  fi

  write_output ok true
}

check_secrets() {
  local -a missing=()
  [[ ${HAVE_ADMIN:-} == true ]] || missing+=("FOUNDRY_ADMIN_KEY")
  [[ ${HAVE_LICENSE:-} == true ]] || missing+=("FOUNDRY_LICENSE_KEY")
  [[ ${HAVE_CACHE:-} == true ]] || missing+=("FOUNDRY_RELEASE_CACHE_URL")
  [[ ${HAVE_SHA:-} == true ]] || missing+=("FOUNDRY_RELEASE_SHA256")

  if ((${#missing[@]} > 0)); then
    printf "::error::Foundry E2E cannot run. Missing required secrets in GitHub Environment 'foundry-e2e': %s\n" "${missing[*]}" >&2
    exit 1
  fi

  write_output available true
}

case $mode in
  license|require) license_gate ;;
  secrets) check_secrets ;;
  *)
    printf '::error::Unknown e2e-gate mode: %s\n' "$mode" >&2
    exit 1
    ;;
esac
