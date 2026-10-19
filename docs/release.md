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

[`release.yml`](../.github/workflows/release.yml):

1. Runs `scripts/ci/e2e-gate.sh require` from a sparse checkout of the workflow commit (`github.sha`). The tag is not checked out in that job. Outside 02:00-05:30 America/New_York, at or after 05:30, or when prod or build has a signed-in user, the job fails and Foundry does not start.
2. Checks out `github.sha`, fails if the tag no longer points at that commit, then runs `npm run verify`.
3. `npm run prepare:release` (rewrites version/download on the release copy of `system.json`).
4. Builds that exact `system.zip` and `artifact-identity.json`.
5. Checks the gate again from `github.sha`, then runs Foundry E2E against those packaged bytes (`--skip-package`).
6. Publishes `system.json`, `system.zip`, and `artifact-identity.json` only if that E2E job succeeded.

If step 3 changes artifact bytes, step 5 is what makes the new zip eligible. A failed gate or a failed E2E job does not publish. Re-run the tag workflow inside the 02:00-05:30 ET window when nobody is signed in.

Foundry installs use:

```text
https://github.com/angry-orc-games/pivot-foundry/releases/latest/download/system.json
```

To put the same zip on https://build.angryorcgames.com or https://foundry.angryorcgames.com, use [deployment.md](deployment.md).
