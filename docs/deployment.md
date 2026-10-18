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

| Workflow                                                                | Trigger                                           | Secrets                              | Purpose                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ci.yml`](../.github/workflows/ci.yml)                                 | Every PR and `main`                               | None                                 | Lint, format, types, Vitest, build, audit, package                                                                                                                                                                                                       |
| [`e2e.yml`](../.github/workflows/e2e.yml)                               | 07:00 UTC schedule and `workflow_dispatch`        | `foundry-e2e`                        | Real Foundry only from 02:00 to 05:30 America/New_York when prod and build show zero users. The nightly run tests main and open same-repo pull requests labeled `e2e-nightly`, one at a time. A closed gate fails the run. Missing secrets fail the job. |
| [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml)         | Push to `main` in this repo, or a `main` dispatch | `staging`                            | Isolated Foundry E2E, then deploy. A pull request or a fork does not start the job. The license gate runs first and fails the job outside the quiet window.                                                                                              |
| [`promote-production.yml`](../.github/workflows/promote-production.yml) | Manual, environment approval                      | `production`                         | Promote the exact staging-accepted zip. Does not start a Foundry process.                                                                                                                                                                                |
| [`release.yml`](../.github/workflows/release.yml)                       | `v*` tags                                         | `foundry-e2e` then `contents: write` | License gate, then Foundry E2E, then publish. A closed gate fails the release and does not publish.                                                                                                                                                      |

Actions are pinned by commit SHA. Jobs have timeouts and concurrency groups. Nightly E2E, the release E2E job, and staging deploy share `concurrency: foundry-e2e` with `cancel-in-progress: false`, so a second run waits instead of starting another Foundry.

Untrusted fork PRs run `CI` only. They do **not** receive Foundry secrets. There is no `pull_request_target` workflow. The nightly queue skips fork heads. `workflow_dispatch` `ref` accepts a 40-character SHA only when that commit is reachable from a branch in this repository. A commit that exists only as a fork pull-request head is refused. The runner scripts still come from `main`. `secrets_check_only` verifies the `foundry-e2e` secrets at any hour and does not start Foundry.

When the first license gate does not pass, the nightly workflow fails. The gate job prints the reason, and a summary job repeats that Foundry was not started. Before each SHA the gate runs again. If it closes, the package job does not check out the system and the secret job does not start Foundry. A report job then posts `Foundry E2E (nightly)` with conclusion `failure` on that SHA. The same failure check is posted when the SHA's job fails, is cancelled, or times out with no valid result. The workflow does not post a neutral check for a closed gate. The next SHA rechecks before it can start Foundry. `scripts/foundry-e2e.mjs` runs the gate again after the zip is installed and before the container starts, and it aborts at 05:30 ET. Schedule and dispatch share the `foundry-e2e` concurrency group and do not cancel an in-progress run, so a second dispatch waits instead of starting another Foundry. `secrets_check_only` uses a separate group. Missing secrets after a passing gate fail that SHA. A failed system test does not cancel the other SHAs.

The license gate checks out `github.sha`, the commit that contains the workflow file. It does not check out the pull-request head, the dispatch `ref`, or the tag. The package job checks out the system under test only after the gate is ok, builds `system.zip`, and uploads that zip. Its build runs in a container that already has `zip` and `unzip`, with no network, a writable `HOME`, and only the workspace mounted, so the code under test cannot upload an artifact or replace the upload action. The job that holds the Foundry secrets has `actions: read`, downloads that zip for this run, and copies only `system.zip` and `system.json` into the harness. The trusted launcher writes `artifact-identity.json` after that. It runs `foundry-cli.mjs` from a sparse checkout of `github.sha` at `trusted-gate`. It does not check out the system under test and it does not run that tree's install or build. The zip install rejects path entries that leave the system directory. `release.yml` builds that tag from `refs/tags/${{ github.ref_name }}`. The release test job copies only the candidate files into a sparse checkout of `github.sha` and runs Foundry from there. A closed gate exits 1. `require` mode tells the caller to re-run inside the 02:00-05:30 ET window. The release publish job runs only when the E2E job succeeds, so a refused release is not published. `promote-production.yml` smokes the existing production server and does not start Foundry.

The nightly workflow grants `contents: read` at the workflow level. The job that lists labeled pull requests is the only one with `issues: write`. The job that posts `Foundry E2E (nightly)` is the only one with `checks: write`, and it checks out only the workflow commit. It downloads the result artifact for this run by name and rejects a file whose `sha` or `run_id` does not match. The secret job has `contents: read`. It passes `FOUNDRY_ADMIN_KEY`, `FOUNDRY_LICENSE_KEY`, `FOUNDRY_RELEASE_CACHE_URL`, and `FOUNDRY_RELEASE_SHA256` only to the step that runs `node scripts/foundry-cli.mjs e2e --skip-package` inside `trusted-gate`. The package job has no secrets. Every `actions/checkout` in that workflow sets `persist-credentials: false`.

Staging deploy runs only when CI completed because of a push to `main` in this repository, or when someone dispatches the workflow on `refs/heads/main`. The job does not start for a pull request or a fork. It downloads the CI package into its own directory, checks that the files are exactly `system.json`, `system.zip`, and `artifact-identity.json` and that each is a regular file, then copies only those files into a sparse checkout of `github.sha`. Deploy and Foundry run from that checkout. They do not run code from the artifact directory. Production promotion uses the same check on the staging-accepted artifact before it uses the deploy key.

## GitHub settings that cannot be set from files

Create these Environments in the repository settings:

| Environment   | Required reviewers | Secrets                                                                                           |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `foundry-e2e` | Optional           | `FOUNDRY_ADMIN_KEY`, `FOUNDRY_LICENSE_KEY`, `FOUNDRY_RELEASE_CACHE_URL`, `FOUNDRY_RELEASE_SHA256` |
| `staging`     | Recommended        | Foundry cache/license secrets **plus** deploy and staging user secrets below                      |
| `production`  | **Required**       | Separate deploy secrets, no Foundry website account password                                      |

### Secrets for `foundry-e2e` Environment

These are required for isolated E2E tests that run in Docker containers:

- `FOUNDRY_ADMIN_KEY` — Admin password for the temporary Foundry instance
- `FOUNDRY_LICENSE_KEY` — Foundry VTT license key for activation
- `FOUNDRY_RELEASE_CACHE_URL` — Timed download URL for the Foundry v14 Node.js zip (expires ~5 minutes)
- `FOUNDRY_RELEASE_SHA256` — SHA-256 checksum of the Foundry release archive for verification

### Secrets for `staging` Environment

The staging environment requires **all** of the following secrets. The workflow will fail fast with the names of missing secrets:

**Foundry cache and license** (same as `foundry-e2e`):

- `FOUNDRY_ADMIN_KEY` — Admin password for the temporary E2E Foundry instance
- `FOUNDRY_LICENSE_KEY` — Foundry VTT license key
- `FOUNDRY_RELEASE_CACHE_URL` — Timed download URL for Foundry v14 Node.js zip
- `FOUNDRY_RELEASE_SHA256` — SHA-256 checksum of the Foundry release archive

**Deploy SSH credentials and paths:**

- `FOUNDRY_DEPLOY_SSH_HOST` — SSH hostname of the staging server (e.g., `build-server.example.com`)
- `FOUNDRY_DEPLOY_SSH_USER` — SSH username for deployment
- `FOUNDRY_DEPLOY_SSH_KEY` — Private SSH key (include the full key with `-----BEGIN` and `-----END` lines)
- `FOUNDRY_DEPLOY_TARGET_DIR` — Target directory path on the server where the system will be deployed (e.g., `/opt/foundryvtt-dev/data/Data/systems/pivot-fantasy`)
- `FOUNDRY_DEPLOY_BACKUP_DIR` — Directory path where backups are stored before deployment (e.g., `/opt/foundryvtt-dev/backups`)
- `FOUNDRY_DEPLOY_SERVICE` — systemd service name to restart after deployment (e.g., `foundryvtt-dev`)

**Staging smoke test user credentials:**

- `PIVOT_STAGING_GM_USER` — Game Master username for smoke tests
- `PIVOT_STAGING_GM_PASSWORD` — Game Master password
- `PIVOT_STAGING_PLAYER_USER` — Player username for smoke tests
- `PIVOT_STAGING_PLAYER_PASSWORD` — Player password
- `PIVOT_PACKAGE_VERSION` — (Optional) Expected package version for verification

### Secrets for `production` Environment

Production requires similar deploy secrets as staging, but with production-specific values. The production environment **must** require human approval. Do not use Foundry website account passwords in production secrets.

The public hostnames are **not** assumed to be SSH destinations. Do not invent users, paths, or unit names. A previous operator runbook mentioned systemd units and `/opt/foundryvtt[-dev]/data` on a Hetzner host; confirm the current layout by filling the secrets above.

Suggested branch-protection checks on `main`:

- `Verify / Node 20`
- `Verify / Node 22`
- `Package Foundry System`

`Foundry E2E (nightly)` is posted on each tested SHA. It is not a required pull-request check unless you add it. The workflow runs at 07:00 UTC and on `workflow_dispatch`.

## Staging

After CI succeeds for a push to `main` in this repository, `deploy-staging.yml` runs the license gate, downloads that `system.zip`, runs isolated E2E against those bytes, deploys them, then runs `npm run test:e2e:staging` against https://build.angryorcgames.com. A pull-request CI run does not start this job. A closed gate fails the job before Foundry starts and before the deploy. Re-run it inside the 02:00-05:30 ET window.

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
