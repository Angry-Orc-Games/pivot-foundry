# Agent Guide

This is a Foundry VTT v13 game system for Pivot Fantasy. Keep changes small, testable, and aligned with the current thin-runtime architecture.

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

Before handoff, run `npm run verify` unless the change is documentation-only and the user explicitly accepts a narrower check. For changes that touch packaging, also run `npm run package:system`. For changes that touch Foundry runtime behavior, build locally and note whether Foundry v13 was manually checked.
