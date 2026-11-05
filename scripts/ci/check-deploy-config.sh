#!/usr/bin/env bash
# Fail fast with the names (never values) of missing GitHub Environment secrets and variables.
#
# Usage: check-deploy-config.sh <environment-name>
#
# The workflow passes HAVE_<NAME>="true" for each secret or variable that is non-empty.
set -euo pipefail

environment=${1:?usage: check-deploy-config.sh <environment-name>}

missing=""
for name in FOUNDRY_DEPLOY_SSH_HOST FOUNDRY_DEPLOY_SSH_USER FOUNDRY_DEPLOY_SSH_KEY \
  FOUNDRY_DEPLOY_TARGET_DIR FOUNDRY_DEPLOY_BACKUP_DIR FOUNDRY_DEPLOY_SERVICE; do
  var="HAVE_${name}"
  if [ "${!var:-}" != "true" ]; then missing="${missing} ${name}"; fi
done

if [ -n "$missing" ]; then
  echo "::error::Missing secrets/variables on GitHub Environment '${environment}':${missing}. See docs/deployment.md."
  exit 3
fi
echo "All required ${environment} secrets are configured."
