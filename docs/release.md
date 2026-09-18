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
- `compatibility.verified`: `14.368`
- `esmodules`: `dist/pivot.mjs`
- `manifest` / `download`: GitHub release URLs

## Tagging

```sh
git tag v0.1.0
git push origin v0.1.0
```

## Workflow

[`release.yml`](../.github/workflows/release.yml):

1. `npm run verify`
2. `npm run prepare:release` (rewrites version/download on the release copy of `system.json`)
3. Builds that exact `system.zip` and `artifact-identity.json`
4. Runs Foundry E2E against those bytes (`--skip-package`)
5. Publishes `system.json`, `system.zip`, and `artifact-identity.json` only if E2E succeeded

If step 2 changes artifact bytes, step 4 is what makes the new zip eligible. Skipped E2E cannot publish.

Foundry installs use:

```text
https://github.com/angry-orc-games/pivot-foundry/releases/latest/download/system.json
```

To put the same zip on https://build.angryorcgames.com or https://foundry.angryorcgames.com, use [deployment.md](deployment.md).
