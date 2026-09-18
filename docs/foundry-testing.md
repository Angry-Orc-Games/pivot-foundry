# Foundry testing

There are two layers:

1. **Repository checks** — lint, format, types, Vitest, build, audit. No Foundry license.
2. **Browser acceptance** — Playwright/Chromium against a real Foundry v14 server that installed the packaged `system.zip`.

## Repository checks

From the repository root, on Node 20 or 22:

```sh
npm ci
npm run verify
npm run package:system
```

`npm run verify` does not start Foundry and does not prove browser behavior.

## Packaged E2E

`npm run foundry:e2e` is the complete lifecycle used locally, on Cloud Agents, and in trusted GitHub Actions:

1. Validate credentials and pins
2. Provision the checksummed Foundry archive and pinned image
3. Build `system.zip` (unless `--skip-package`)
4. Install the extracted zip into a disposable instance
5. Start the owned Compose instance on loopback
6. Wait for the Foundry shell, then `game.ready`
7. Run Playwright (one worker)
8. Write sanitized diagnostics on failure
9. Stop and remove the disposable instance even if the run is interrupted

```sh
cp .env.foundry.local.example .env.foundry.local
# set FOUNDRY_ADMIN_KEY, FOUNDRY_LICENSE_KEY, and a cache source
npx playwright install chromium
npm run foundry:e2e
```

Missing credentials, a wrong Foundry version, a missing browser, or a world that is not this package fail with a non-zero exit code. The suite never attaches to an unrelated running server.

Destructive fixture tests require `PIVOT_FOUNDRY_TARGET=e2e` (set by the command). They refuse `https://foundry.angryorcgames.com` and `PIVOT_FOUNDRY_TARGET=production`.

Current coverage (first vertical slice):

- Fresh-world startup and `pivot-fantasy` activation
- Packaged system version
- Actor creation and character-sheet rendering
- Edit + persistence after reload
- GM vs player permissions
- d20 roll chat
- Cross-client actor sync
- Scene activation and canvas readiness

`system.json` `packs` is still `[]`, so there is no LevelDB compendium import test yet. Add previous-version world fixtures before claiming migration E2E; unit tests already cover M001/M002.

## External smoke tests

These are non-destructive and use different credentials.

```sh
PIVOT_FOUNDRY_TARGET=staging PIVOT_FOUNDRY_BASE_URL=https://build.angryorcgames.com npm run test:e2e:staging
PIVOT_FOUNDRY_TARGET=production PIVOT_FOUNDRY_BASE_URL=https://foundry.angryorcgames.com npm run test:e2e:production
```

Staging checks HTTPS, WebSocket, package version, and GM/player login against the designated test world. Production only checks HTTPS health and the public manifest. Neither command resets a world.

## Debugging

- HTML report: `playwright-report/` (gitignored)
- Traces and screenshots: `test-results/` on failure
- Server logs: `.foundry/instances/<id>/diagnostics/foundry.log` (license keys redacted)

Do not commit traces that include session cookies. Do not upload Foundry binaries or `foundry-dist/` as CI artifacts.
