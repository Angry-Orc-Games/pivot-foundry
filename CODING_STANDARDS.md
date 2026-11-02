# Coding Standards

Conventions for code in this repository that the tooling does not enforce. ESLint (`typescript-eslint` strict), Prettier (`printWidth: 100`, trailing commas), and `tsc` (`strict`, `noUncheckedIndexedAccess`) own formatting and type rules; run `npm run verify` instead of formatting by hand. Read [AGENTS.md](AGENTS.md) for commands, boundaries, and the verification bar.

Match the file you are editing. Where older code differs from these standards, follow the standards in new code and leave unrelated code alone.

## Layers

Each layer may import only from the layers above it.

| Layer      | Path              | Owns                                                                                                                             |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Rules      | `src/rules/`      | Deterministic game math and state transitions. Plain inputs, plain outputs, no Foundry globals, no `globalThis`, no I/O.         |
| Data       | `src/data/`       | TypeDataModel schema factories. Persisted source fields only.                                                                    |
| Migrations | `src/migrations/` | Pure `plan*` functions over stored source that return a `MigrationPlan`, plus the world runner.                                  |
| Runtime    | `src/runtime/`    | Adapters around rules: dialogs, chat messages, permission checks, guarded Actor updates.                                         |
| Sheets     | `src/sheets/`     | Sheet classes built by `create*SheetClass(foundry)` factories, plus exported context and submit helpers that are testable alone. |
| Entry      | `src/pivot.ts`    | Hook and registration wiring only. Logic called here lives in a lower layer.                                                     |

Put a new behaviour in the lowest layer that can hold it. A calculation a sheet or dialog needs belongs in `src/rules/` and the caller passes values in.

## Foundry boundary

- Reach Foundry through the injected `FoundryRuntime` (`src/foundry-runtime.ts`) or `runtime()` (`src/runtime/ui.ts`). Type each global locally as a minimal structural interface covering only the members the slice uses, with optional members (`game?.i18n?.localize?.(...)`) so tests can pass partial doubles.
- Treat document data as `unknown`. Narrow it with small readers (`readSurvival` in `src/runtime/health.ts`, `asRecord` in `src/runtime/actor-guards.ts`) that default missing fields, then hand typed values to rules.
- Read persisted state from source (`document.toObject()`, falling back to `_source`), never from prepared TypeDataModel defaults, whenever the answer decides a migration or write.
- Write with flat dotted keys (`"system.attributes.hp.value"`) built by a helper such as `survivalUpdate`, so the full write for one action is visible in one place.
- Use public, documented Foundry v14 APIs. See [docs/foundry-vtt-source.md](docs/foundry-vtt-source.md) for namespacing and handoff fields.

## Rules code

- Export functions that take one input object and return a result object (`applyLongRestPoolRecovery(input): LongRestPoolRecoveryResult`). Name the pair `Thing` / `ThingResult`.
- Return new objects; copy with spread before changing a field.
- Validate inputs at the top of the function and throw `RangeError` with a message naming the field and value (`` `poolMax must be a positive integer (got ${value})` ``). Use `validAmount` from `src/rules/survival.ts` for non-negative safe integers.
- Model closed sets as `as const` arrays with a derived union type (`SURVIVAL_STATUSES` / `SurvivalStatus`), so runtime checks and types share one source.
- Name things with the terms in [GLOSSARY.md](GLOSSARY.md), and use each term's listed form rather than its _Avoid_ aliases. Add a glossary entry when you introduce a new game concept.

## Persisted data and migrations

- Store player-entered source values; derive totals in `src/rules/character-derived.ts` at read time.
- Every persisted shape change ships a named migration (`src/migrations/mNNN.ts`) with an `M00N` id, a version constant, and a pure `plan*` function returning `{ ok: false, error: "M00N: ..." }` for malformed input. A malformed document fails on its own and is logged; leave it unrepaired.
- Keep schema defaults legacy-safe: a default must never read as "already migrated". Initialise new documents explicitly (see `initializeSurvival`).

## Survival transactions

All HP, Temporary HP, and death-save changes go through one Survival transaction: read the Survival state, apply the rules function, validate, then make a single guarded write. Use the existing helpers in `src/runtime/health.ts` and `src/runtime/actor-guards.ts`. Treat a rejected write as possibly committed and leave it for the user to retry. See [docs/survival.md](docs/survival.md).

## User-facing text and HTML

- Put every user-visible string in `lang/en.json` under the `PIVOT.` prefix, and reach it with `localize` or the `{{localize}}` helper. `npm run verify:l10n` fails on missing keys.
- Pass every interpolated value through `escapeHtml` when building HTML strings for dialogs or chat. Numbers you computed are the only exception.
- Prefix CSS classes, flags, settings, and DOM ids with `pivot-fantasy` / `SYSTEM_ID`.

## Comments

Write a short JSDoc on exported rules functions stating the game rule in plain words, and a comment wherever the reason for a guard is not visible in the code (a Foundry quirk, a race, a legacy-data case). Keep comments to the rule or the reason; the code shows the mechanics.

## Tests

- Mirror `src/` under `tests/` (`src/rules/rest.ts` → `tests/rules/rest.test.ts`). Rules changes need tests; runtime and sheet helpers are tested with plain-object doubles and `vi.fn()`, not a Foundry instance.
- Write each `it` name as the behaviour in plain English ("recovers 0 MP when in danger"). Cover the boundaries and the `RangeError` paths.
- Import from relative `../../src/...` paths and import `lang/en.json` directly when asserting on localized text.
- Scripts under `scripts/` are `.mjs` and tested by `tests/*.test.mjs`.
- Browser behaviour that depends on real Foundry documents, hooks, or packaged assets is covered by `npm run foundry:e2e`. Say so in the handoff when it was not run.

## Commits

Use Conventional Commits with a scope: `fix(survival): ...`, `refactor(rolls): ...`, `test(ci): ...`, `ci(e2e): ...`. The subject states the user-visible effect in the imperative.
