# Agent Guide

This is a Foundry VTT v14 game system for Pivot Fantasy. Keep changes small, testable, and aligned with the current thin-runtime architecture.

## Commands

Run these from the repository root:

- Install dependencies: `npm ci`
- Full verification: `npm run verify`
- Fast rule tests: `npm run test`
- TypeScript check: `npm run typecheck`
- Lint: `npm run lint`
- Format check: `npm run format:check`
- Build Foundry runtime: `npm run build`
- Validate package: `npm run package:system`
- Foundry env diagnostics: `npm run foundry:doctor`
- Persistent Foundry v14 world: `npm run foundry:up` / `foundry:status` / `foundry:logs` / `foundry:down`
- Packaged browser E2E: `npm run foundry:e2e`

## Architecture Boundaries

- Put deterministic game rules in `src/rules/`.
- Put tests for deterministic rules under `tests/rules/`.
- Keep Foundry lifecycle registration, document model wiring, hooks, sheets, and settings thin and close to `src/pivot.ts` until there is enough surface area to split modules.
- Add Foundry-facing types locally only for the slice being implemented.
- Do not copy code from other Foundry systems.

## Brownfield Workflow

- Read `README.md`, `docs/development.md`, `docs/architecture.md`, `docs/foundry-vtt-source.md`, `docs/rules-source.md`, and `docs/character-sheet-source.md` before feature work. Read `docs/deployment.md` before any deployment-related work. Read `docs/foundry-local-dev.md`, `docs/foundry-testing.md`, and `docs/foundry-cloud.md` before changing the Foundry runtime.
- Preserve unrelated dirty work. If files are already modified, inspect and build on the current state rather than reverting it.
- Prefer one worker for code edits. Use additional agents or reviewers for read-only mapping, testing, security review, and architecture review.
- For runtime behavior, separate local repo success from Foundry acceptance. Report whether validation was local-only, CI-backed, or checked in Foundry / Playwright.

## Verification Bar

Before handoff, run `npm run verify` unless the change is documentation-only and the user explicitly accepts a narrower check. For changes that touch packaging, also run `npm run package:system`. For changes that touch Foundry runtime behavior, run `npm run foundry:e2e` when Docker and Foundry credentials exist; otherwise say that browser E2E was not run.

The Foundry runtime is Docker Compose + Felddy, pinned in `foundry/versions.json` to Foundry **14.368**. Persistent data is `foundry-data-v14/`. Do not commit Foundry binaries, `.env.foundry.local`, or license keys. Do not delete retired `foundry-app/` or `foundry-data/` directories. Repository `npm run verify` stays on Node 20/22.

Do not claim Cloud execution, GitHub CI, staging, production, or release publication unless that surface was actually observed.

## Cursor Cloud specific instructions

`.cursor/environment.json` installs Node, Docker/Compose, and Playwright browsers. `install` and `start` do not boot Foundry. After a snapshot, use this checkout’s package (`npm ci`, `npm run build`) before `npm run foundry:up`.

Runtime Secrets: `FOUNDRY_ADMIN_KEY`, `FOUNDRY_LICENSE_KEY`, and optionally `FOUNDRY_RELEASE_CACHE_URL` + `FOUNDRY_RELEASE_SHA256`. Do not persist a timed `FOUNDRY_RELEASE_URL`. Do not load production deploy credentials onto Cloud Agents. Preview port **30000** through Cursor forwarding and confirm WebSocket connectivity, not just the first HTML page.
