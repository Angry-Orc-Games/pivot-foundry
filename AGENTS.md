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
- Local Foundry v14 host (Node 24): `npm run foundry:up` / `foundry:down` / `foundry:logs`

## Architecture Boundaries

- Put deterministic game rules in `src/rules/`.
- Put tests for deterministic rules under `tests/rules/`.
- Keep Foundry lifecycle registration, document model wiring, hooks, sheets, and settings thin and close to `src/pivot.ts` until there is enough surface area to split modules.
- Add Foundry-facing types locally only for the slice being implemented.
- Do not copy code from other Foundry systems.

## Brownfield Workflow

- Read `README.md`, `docs/development.md`, `docs/architecture.md`, `docs/foundry-vtt-source.md`, `docs/rules-source.md`, and `docs/character-sheet-source.md` before feature work. Read `docs/deployment.md` before any deployment-related work.
- Preserve unrelated dirty work. If files are already modified, inspect and build on the current state rather than reverting it.
- Prefer one worker for code edits. Use additional agents or reviewers for read-only mapping, testing, security review, and architecture review.
- For runtime behavior, separate local repo success from Foundry acceptance. Report whether validation was local-only, CI-backed, or manually checked in Foundry.

## Verification Bar

Before handoff, run `npm run verify` unless the change is documentation-only and the user explicitly accepts a narrower check. For changes that touch packaging, also run `npm run package:system`. For changes that touch Foundry runtime behavior, build locally and note whether Foundry v14 was manually checked.

Hosting Foundry locally uses Node 24 and a licensed Node zip in ignored `foundry-app/`. Do not commit Foundry binaries, `.env.foundry.local`, license keys, or a Foundry zip. Do not bake `foundry-app/` into a snapshot. Repository `npm run verify` stays on Node 20/22.

## Cursor Cloud specific instructions

Daily Foundry is the zip on **odin** (`FOUNDRY_RELEASE_ARCHIVE`). Persist Cursor Secrets `FOUNDRY_ADMIN_KEY` and `FOUNDRY_LICENSE_KEY` only. Do not save a timed `FOUNDRY_RELEASE_URL` on the environment.

Cloud Agents without Foundry: `npm ci`, `npm run verify`, and `npm run package:system` on `main`. Do not boot Foundry unless asked.

Cloud Foundry only when needed: the operator pastes a fresh Foundry **14 Node** timed URL (`FoundryVTT-Node-14.*`, pin **14.368**) from https://foundryvtt.com/me/licenses into **this chat** (~5 minute TTL). Write gitignored `.env.foundry.local` from the persisted secrets plus that paste (`foundry:up` reads the file, not `process.env`). Do not `cat` the file. Install Node 24, run `npm ci`, `npm run build`, `npm run foundry:up`, apply license + admin, and create world **Pivot Fantasy Test**. Forward Agents Window port **30000** → http://127.0.0.1:30000/join (must be this agent).

See [docs/foundry-secrets.md](docs/foundry-secrets.md) and [docs/foundry-local-dev.md](docs/foundry-local-dev.md).
