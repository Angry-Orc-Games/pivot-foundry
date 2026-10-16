# Development Notes

This project is intentionally small at the current stage. The next work should grow the system in narrow, testable slices rather than moving rules, sheets, and Foundry integration forward all at once.

Before starting a brownfield slice, read the current architecture map in [architecture.md](architecture.md), the Foundry reference note in [foundry-vtt-source.md](foundry-vtt-source.md), the rules source note in [rules-source.md](rules-source.md), and the root [AGENTS.md](../AGENTS.md). Treat those files as the durable project setup guide for agent-assisted work. For deploys, read [deployment.md](deployment.md) first.

## Architecture Boundaries

Use these boundaries when adding code:

- Keep deterministic Pivot Fantasy rules in `src/rules/`.
- Cover rules modules with Vitest tests under `tests/`.
- Keep Foundry lifecycle registration, document wiring, and sheet registration in thin runtime modules.
- Avoid copying code from other Foundry systems. This is an original Pivot Fantasy system, not a fork.
- Add Foundry-facing types locally only when they are needed by the slice being implemented.

Good candidates for pure rules modules:

- Dice notation parsing and rolling inputs
- Pool calculations
- Character resource math
- Advancement rules
- Validation for actor and item source data

Good candidates for Foundry integration modules:

- Actor and item document registration
- Sheet class registration
- System settings
- Hook registration
- Data migration entry points

Current Foundry integration modules:

- `src/pivot.ts` registers the `Actor.character` and Pivot Item data models, token resources, sheet classes, and the `ready` migration runner.
- `src/data/character-data.ts` owns the character Actor source schema.
- `src/data/item-data.ts` owns the `weapon`, `armour`, `equipment`, `feature`, `magicStream`, and `magicAbility` schemas.
- `src/sheets/character-sheet.ts` owns the native character sheet class and the testable sheet context used by templates and roll/resource actions.
- `src/sheets/item-sheet.ts` owns the native Item sheet class and the read-only effects summary.
- `src/rules/d20-roll.ts` owns dice-pool resolution, roll-mode mapping, kept-die selection, and attack natural 20/1 classification.
- `src/rules/resources.ts` owns bounded resource spend/recovery and long-rest Pool recovery amounts.
- `src/rules/combat.ts` owns unique-combatant selection for initiative tracker updates.
- `src/rules/effects.ts` owns EffectRule validation, stored-effect parsing, and derived contribution aggregation.
- `src/rules/content.ts` owns content-record validation and deterministic pack-document generation.
- `src/migrations/m001.ts` owns the schemaVersion 0 → 1 migration plan.
- `src/migrations/world-migrations.ts` owns the Foundry world Actor/Item migration runner.

Keep sheet context preparation and deterministic calculations testable outside Foundry. Do not move Foundry globals into rules modules.

## Testing Expectations

Run these before handing off changes:

```sh
npm run verify
```

For faster inner-loop checks, run the narrower script that matches the change:

- `npm run lint` for TypeScript and JavaScript linting
- `npm run format:check` for Prettier formatting
- `npm run typecheck` for TypeScript compiler validation
- `npm run test` for the fast Vitest unit suite
- `npm run test:agent -- --json` for a machine-readable summary, optionally limited to files (`npm run test:agent -- src/rules/rest.ts`)
- `npm run test:changed` for unit tests affected by the current git diff
- `npm run test:coverage` for the full suite plus v8 coverage thresholds
- `npm run build` for the Foundry runtime bundle
- `npm run audit` for dependency vulnerability checks
- `npm run package:system` for release zip validation
- `npm run build:content` for JSON content validation and `packs/src` generation

Vitest fails when test files are missing (`passWithNoTests: false`) and when a test is focused with `.only`. If a slice temporarily moves or renames tests, keep that behavior intact and update the matching test include patterns instead of allowing empty test runs.

`npm run test:agent` is the programmatic loop for agents. It always exits non-zero on failure and writes `test-results/unit-summary.json`. `--json` prints that same object on stdout. Pass source, test, language, pack, or `system.json` paths to run the tests that import them. `npm run test:changed` does that for the working tree and commits since `origin/main`. Documentation-only diffs pass without running tests. `npm run test:coverage` and `npm run verify` run the full suite and enforce v8 thresholds: about 68% statements globally, and 90% statements / 100% functions under `src/rules/`.

Use fast unit tests for rules behavior first. Add Playwright Foundry E2E when the change depends on Foundry documents, hooks, sheets, packaged assets, or browser behavior.

For the character sheet, Vitest covers manifest declarations, registration wiring, schema factories, derived math, sheet context, and helper behavior. `npm run foundry:e2e` covers packaged-asset loading, sheet rendering, persistence, permissions, rolls, and sync when credentials are available.

The local Foundry sandbox is Docker Compose + Felddy (`npm run foundry:up`). Foundry 14.368 runs on Node 24 inside the pinned container. Repository verify stays on Node 20 or 22. Browser acceptance is `npm run foundry:e2e` against `system.zip`. See [foundry-local-dev.md](foundry-local-dev.md) and [foundry-testing.md](foundry-testing.md).

## Implementation Sequence

Prefer this order for future feature slices:

1. Define the minimum data shape needed for the feature.
2. Write tests for pure rules behavior.
3. Implement the rules module.
4. Add the narrow Foundry integration needed to expose it.
5. Build and test the packaged system in Foundry v14 when the feature touches runtime behavior.

## Agent Review Loop

Use Codex as the primary implementation environment for normal development. For medium, risky, or cross-boundary changes, use separate read-only review passes for architecture, tests, and security before merge.

Do not run multiple coding agents as writers in the same checkout. If parallel implementation is needed, use separate worktrees and narrow ownership boundaries.

Keep local verification, CI status, and manual Foundry acceptance separate in handoffs. Passing `npm run verify` proves repository checks, not that a Foundry workflow has been manually accepted.

## Documentation Updates

Update documentation in the same change when behavior or workflow changes:

- Update `README.md` for user-facing setup, install, or project capability changes.
- Update this file for development workflow, testing, or architecture changes.
- Update `docs/release.md` for packaging, tag, or manifest changes.
- Keep claims aligned with implemented behavior. Do not describe a playable feature until the code and verification exist.
- Update `docs/foundry-local-dev.md` when the local Foundry host, env keys, or smoke-test loop changes.
