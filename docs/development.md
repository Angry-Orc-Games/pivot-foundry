# Development Notes

This project is intentionally small at the current stage. The next work should grow the system in narrow, testable slices rather than moving rules, sheets, and Foundry integration forward all at once.

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

`vitest.config.ts` currently uses `passWithNoTests: true` because the repository began as an empty shell. Once the first real rules or runtime tests are added, keep that setting under review so missing tests do not hide regressions.

Use fast unit tests for rules behavior first. Add Foundry runtime tests or manual Foundry checks when the change depends on Foundry documents, hooks, sheets, or packaged assets.

## Implementation Sequence

Prefer this order for future feature slices:

1. Define the minimum data shape needed for the feature.
2. Write tests for pure rules behavior.
3. Implement the rules module.
4. Add the narrow Foundry integration needed to expose it.
5. Build and test the packaged system in Foundry v13 when the feature touches runtime behavior.

## Documentation Updates

Update documentation in the same change when behavior or workflow changes:

- Update `README.md` for user-facing setup, install, or project capability changes.
- Update this file for development workflow, testing, or architecture changes.
- Update `docs/release.md` for packaging, tag, or manifest changes.
- Keep claims aligned with implemented behavior. Do not describe a playable feature until the code and verification exist.
