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

- `src/pivot.ts` registers the `Actor.character` and Pivot Item data models, token resources, and sheet classes.
- `src/data/character-data.ts` owns the character Actor source schema.
- `src/data/item-data.ts` owns the `weapon`, `armour`, `equipment`, `feature`, `magicStream`, and `magicAbility` schemas.
- `src/sheets/character-sheet.ts` owns the native character sheet class and the testable sheet context used by templates and roll/resource actions.
- `src/sheets/item-sheet.ts` owns the native Item sheet class.

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
- `npm run test` for Vitest unit tests
- `npm run build` for the Foundry runtime bundle
- `npm run audit` for dependency vulnerability checks
- `npm run package:system` for release zip validation

Vitest should fail when test files are missing. If a slice temporarily moves or renames tests, keep that behavior intact and update the matching test include patterns instead of allowing empty test runs.

Use fast unit tests for rules behavior first. Add Foundry runtime tests or manual Foundry checks when the change depends on Foundry documents, hooks, sheets, or packaged assets.

For the character sheet, automated tests can validate manifest declarations, registration wiring, schema factories, derived math, sheet context, and helper behavior. Manual Foundry v13 smoke tests are still required for actual browser rendering, drag/drop, permissions, and chat roll behavior.

## Implementation Sequence

Prefer this order for future feature slices:

1. Define the minimum data shape needed for the feature.
2. Write tests for pure rules behavior.
3. Implement the rules module.
4. Add the narrow Foundry integration needed to expose it.
5. Build and test the packaged system in Foundry v13 when the feature touches runtime behavior.

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
