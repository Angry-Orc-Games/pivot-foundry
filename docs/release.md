# Release Checklist

GitHub Release publication and Angry Orc Games deployment are separate. A tag publishes install artifacts. Staging/production promotion uses the tested zip and an approval environment.

## Before tagging

```sh
npm ci
npm run verify
npm run package:system
npm run foundry:e2e
```

Check `system.json`:

- `id`: `pivot-fantasy`
- `title`: `Pivot Fantasy`
- `compatibility.minimum`: `14`
- `compatibility.verified`: `14.368` (published manifest; leave this value)
- Installed runtime pin in `foundry/versions.json`: `14.361` (at or below `compatibility.verified`)
- `esmodules`: `dist/pivot.mjs`
- `manifest` / `download`: GitHub release URLs

## Tagging

```sh
git tag v0.1.0
git push origin v0.1.0
```

## Workflow

[`release.yml`](../.github/workflows/release.yml) does not start Foundry and does not use the `foundry-e2e` environment:

1. `nightly` checks out `github.sha` and runs `scripts/ci/require-nightly.sh` with the workflow token (`checks: read`, `actions: read`). The tagged commit passes only when its latest `Foundry E2E (nightly)` check is `success` from `github-actions`, and the Actions run named by that check's details link or summary is `.github/workflows/e2e.yml` with event `schedule` or `workflow_dispatch` and `head_branch` `main`. A missing, red, neutral, or unverifiable check fails the release at any hour.
2. `package` checks out `github.sha`, fails if the tag no longer points at that commit, then runs `npm run verify`.
3. `npm run prepare:release` (rewrites version/download on the release copy of `system.json`).
4. Builds that exact `system.zip` and `artifact-identity.json`.
5. Publishes `system.json`, `system.zip`, and `artifact-identity.json` only when both the package job and the nightly check succeeded.

`scripts/ci/e2e-report.sh` posts `Foundry E2E (nightly)` from the nightly workflow and records that Actions run on the check. A tag whose commit has no green nightly fails closed. Run Foundry E2E on `main` inside the 02:00-05:30 ET window, then tag that commit after the check is green. `prepare:release` can change manifest bytes after that nightly run; release does not start Foundry again to retest them.

Foundry installs use:

```text
https://github.com/angry-orc-games/pivot-foundry/releases/latest/download/system.json
```

To put the same zip on https://build.angryorcgames.com or https://foundry.angryorcgames.com, use [deployment.md](deployment.md).
