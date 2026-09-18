# Deployment

Local or Cloud development → pull-request verification → merge to `main` → build-server deploy and external tests → approved production promotion.

Application endpoints (not SSH destinations):

- Build/staging: https://build.angryorcgames.com
- Production: https://foundry.angryorcgames.com

This file describes **implemented repository workflows** and **account-level setup that still has to be done in GitHub**. It is not authorization to deploy. This change does not perform a live external deployment.

## Artifact flow

```text
system.zip + artifact-identity.json
  commit SHA + package version + SHA-256
        │
        ├─ CI package (no Foundry secrets)
        ├─ trusted Foundry E2E (same bytes, or rebuilt then checksum-compared)
        ├─ staging deploy + non-destructive smoke
        └─ production promotion of the exact staging-accepted zip
```

If release preparation changes `system.json`, the new zip must pass E2E (and staging, before production) again. Publication of a GitHub Release is separate from deploying to Angry Orc Games hosts.

## Implemented GitHub workflows

| Workflow                                                                | Trigger                               | Secrets                              | Purpose                                                                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ci.yml`](../.github/workflows/ci.yml)                                 | Every PR and `main`                   | None                                 | Lint, format, types, Vitest, build, audit, package                                                                                                                |
| [`e2e.yml`](../.github/workflows/e2e.yml)                               | Same-repo PRs and `workflow_dispatch` | `foundry-e2e`                        | Isolated Foundry E2E. If those secrets are missing, the job is visibly not run and does not fail the PR. Release publication still requires a successful E2E job. |
| [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml)         | Successful CI on `main`               | `staging`                            | Deploy tested zip, smoke https://build.angryorcgames.com                                                                                                          |
| [`promote-production.yml`](../.github/workflows/promote-production.yml) | Manual, environment approval          | `production`                         | Promote the exact staging-accepted zip                                                                                                                            |
| [`release.yml`](../.github/workflows/release.yml)                       | `v*` tags                             | `foundry-e2e` then `contents: write` | Test the prepared zip, then publish                                                                                                                               |

Actions are pinned by commit SHA. Jobs have timeouts and concurrency groups. Staging uses `concurrency: foundry-staging` with `cancel-in-progress: false` so one run cannot deploy while another is testing.

Untrusted fork PRs run `CI` only. They do **not** receive Foundry secrets. There is no `pull_request_target` workflow. To test a fork commit: review the exact SHA, then run **Foundry E2E** with `workflow_dispatch` and that ref.

Skipped E2E is visible as a skipped check and cannot satisfy release publication (`needs.e2e.result == success`).

## GitHub settings that cannot be set from files

Create these Environments in the repository settings:

| Environment   | Required reviewers | Secrets                                                                                           |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `foundry-e2e` | Optional           | `FOUNDRY_ADMIN_KEY`, `FOUNDRY_LICENSE_KEY`, `FOUNDRY_RELEASE_CACHE_URL`, `FOUNDRY_RELEASE_SHA256` |
| `staging`     | Recommended        | Foundry cache/license secrets **plus** deploy and staging user secrets below                      |
| `production`  | **Required**       | Separate deploy secrets, no Foundry website account password                                      |

Staging / production deploy secrets (placeholders only):

```text
FOUNDRY_DEPLOY_SSH_HOST=
FOUNDRY_DEPLOY_SSH_USER=
FOUNDRY_DEPLOY_SSH_KEY=
FOUNDRY_DEPLOY_TARGET_DIR=
FOUNDRY_DEPLOY_BACKUP_DIR=
FOUNDRY_DEPLOY_SERVICE=
```

Staging smoke:

```text
PIVOT_STAGING_GM_USER=
PIVOT_STAGING_GM_PASSWORD=
PIVOT_STAGING_PLAYER_USER=
PIVOT_STAGING_PLAYER_PASSWORD=
```

The public hostnames are **not** assumed to be SSH destinations. Do not invent users, paths, or unit names. A previous operator runbook mentioned systemd units and `/opt/foundryvtt[-dev]/data` on a Hetzner host; confirm the current layout by filling the secrets above.

Suggested branch-protection checks on `main`:

- `Verify / Node 20`
- `Verify / Node 22`
- `Package Foundry System`
- `Foundry E2E` (same-repo PRs only; forks stay CI-only)

## Staging

After CI succeeds on `main`, `deploy-staging.yml` downloads that `system.zip`, runs isolated E2E against those bytes, deploys them, then runs `npm run test:e2e:staging` against https://build.angryorcgames.com.

Reset only a designated local/E2E world. The staging job does not wipe other server data. Production promotion reads `artifact-identity.json.staging.sha256`, not “the latest successful staging run” by itself.

Keep the staging Foundry **runtime** on 14.368 (or the same verified build as production). Upgrading Foundry on the server is a separate operation from deploying this game system.

## Production

Run **Promote production** and pass the staging workflow run id. The `production` environment must require a human approval. The job:

1. Downloads `pivot-foundry-staging-accepted`
2. Verifies commit, version, SHA-256, and staging acceptance
3. Refuses packages that require a newer Foundry major than 14
4. Backs up the configured target directory
5. Replaces the package and restarts only the configured service
6. Runs non-destructive production health checks

It never runs fixture reset/seed tests against https://foundry.angryorcgames.com.

### Rollback

1. Redeploy the previous `system.zip` (same identity file) with the production workflow or the documented backup directory.
2. If a world migration made package-only rollback insufficient, restore the matching world backup from `FOUNDRY_DEPLOY_BACKUP_DIR` / the server’s Foundry backup location.
3. Do not roll Foundry itself backward as part of a package rollback unless that runtime pair was tested.

## Licensing

Official sources: [EULA](https://foundryvtt.com/article/license/) (2 March 2023, Version 11.293) and [FAQ](https://foundryvtt.com/article/faq/).

- A purchased license is required to install and activate Foundry, including Docker and Node hosts.
- You may install the software on more than one computer, but **only one hosted instance may be accessible to users other than the license owner at a time** unless you own matching additional licenses.
- Private owner-only test servers are allowed; local-only loopback plus a player-accessible staging or production host still needs a concurrency plan.
- Timed download URLs expire in about five minutes and do not activate the license.
- Do not distribute Foundry archives, bake them into Cloud snapshots, or upload them as public workflow artifacts.

This repository does not assume one license covers local + Cloud + https://build.angryorcgames.com + https://foundry.angryorcgames.com if those instances are simultaneously player-accessible.
