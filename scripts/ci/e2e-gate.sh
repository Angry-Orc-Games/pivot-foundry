#!/usr/bin/env bash
set -euo pipefail

mode=${1:?usage: e2e-gate.sh license|secrets}

write_output() {
  local key=$1
  local value=$2
  if [[ -n ${GITHUB_OUTPUT:-} ]]; then
    printf '%s=%s\n' "$key" "$value" >>"$GITHUB_OUTPUT"
  fi
}

notice() {
  printf '::notice::%s\n' "$1"
}

read_count() {
  local url=$1
  local body users
  body=$(curl -fsS --max-time 20 "$url") || return 1
  users=$(
    printf '%s' "$body" | jq -r 'if (.users | type) == "number" and (.users | floor) == .users and .users >= 0 then (.users | tostring) else empty end' 2>/dev/null
  ) || return 1
  [[ $users =~ ^[0-9]+$ ]] || return 1
  printf '%s' "$users"
}

license_gate() {
  local hour count host url
  local -a busy=()

  if ! hour=$(TZ=America/New_York date +%H); then
    notice "Skipped: could not read America/New_York hour (shared Foundry license)"
    write_output ok false
    exit 0
  fi

  case $hour in
    02|03|04|05) ;;
    *)
      notice "Skipped: outside 02:00-06:00 ET quiet hours (shared Foundry license)"
      write_output ok false
      exit 0
      ;;
  esac

  for entry in \
    "foundry.angryorcgames.com|https://foundry.angryorcgames.com/api/status" \
    "build.angryorcgames.com|https://build.angryorcgames.com/api/status"; do
    host=${entry%%|*}
    url=${entry#*|}
    if ! count=$(read_count "$url"); then
      notice "Skipped: could not read user count from ${host} (shared Foundry license)"
      write_output ok false
      exit 0
    fi
    if ((count > 0)); then
      busy+=("$host")
    fi
  done

  if ((${#busy[@]} == 2)); then
    notice "Skipped: somebody is signed in on ${busy[0]} and ${busy[1]} (shared Foundry license)"
    write_output ok false
    exit 0
  fi
  if ((${#busy[@]} == 1)); then
    notice "Skipped: somebody is signed in on ${busy[0]} (shared Foundry license)"
    write_output ok false
    exit 0
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
  license) license_gate ;;
  secrets) check_secrets ;;
  *)
    printf '::error::Unknown e2e-gate mode: %s\n' "$mode" >&2
    exit 1
    ;;
esac
