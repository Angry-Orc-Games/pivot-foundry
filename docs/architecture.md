# Architecture

Pivot Foundry is currently a small Foundry VTT v13 system scaffold. The architecture goal is to keep Foundry integration thin while deterministic Pivot Fantasy rules grow as plain TypeScript modules with unit coverage.

## Current Shape

- `system.json` declares the Foundry system manifest, language file, stylesheet, module entry point, release URLs, the `character` Actor document type, and Pivot Item document types.
- `src/pivot.ts` is the Foundry runtime entry point. It registers Actor/Item data models, token resource paths, and native sheets during the Foundry `init` hook, then runs named world migrations on `ready`.
- `src/data/` contains TypeDataModel schema factories for `Actor.character` and Pivot Item types, including `schemaVersion` and Item `effects`.
- `src/sheets/` contains the character and item sheet classes plus testable sheet-context helpers.
- `src/rules/` contains deterministic rules code that does not depend on Foundry globals, including d20 roll modes, Pool resource transactions, combatant selection, effect aggregation, and content validation.
- `src/migrations/` contains named document migrations. M001 persists `schemaVersion: 1` from stored source (`document.toObject()` / `_source`), not prepared TypeDataModel defaults.
- `src/content/` is the canonical JSON content source. `scripts/build-content-packs.mjs` writes generated Foundry document JSON to `packs/src/`. `system.json` `packs` stays `[]` until a real Foundry v13 LevelDB pack exists.
- `templates/` and `styles/` contain the native Foundry sheet UI.
- `tests/` contains Vitest coverage for the manifest and rules modules.
- `scripts/` contains release preparation and Foundry package validation.
- `dist/` and `system.zip` are generated outputs.

See [foundry-vtt-source.md](foundry-vtt-source.md) for Foundry-specific development constraints and version-sensitive guidance.

## Design Principles

- Keep pure rules independent from Foundry APIs so they are fast to test and easy to reason about.
- Keep Foundry code focused on lifecycle, document registration, settings, sheets, and migrations.
- Introduce module splits when there is real surface area, not preemptively.
- Keep release packaging deterministic and validated by scripts.
- Keep documentation claims tied to implemented, tested behavior.
- Verify Foundry APIs against the project target version before adopting newer examples or guide material.

## Expected Growth Path

1. Define source data shapes for one game concept.
2. Add or update pure rules tests.
3. Implement the rule behavior in `src/rules/`.
4. Add the smallest Foundry integration needed to expose that behavior.
5. Run local verification and, when runtime behavior changes, manually smoke-test in Foundry v13.

## Character Sheet Data

The current character sheet stores player-editable source data under `Actor.system` and keeps totals derived:

- `identity`, `progression`, `abilities`, `attributes`, `resources`, `skills`, `skillSpecializations`, `proficiencies`, `currency`, `magic`, `notes`, and `schemaVersion` live on `Actor.character`.
- Weapons, armour, equipment, features/flaws/background/species notes, magic streams, and magic abilities are embedded Items. Each Item type stores `schemaVersion` and a whitelisted `effects` array.
- Ability modifiers, proficiency bonus, saves, skill totals, passive perception, Pool maximum, MP maximum, AC, initiative, speed, carried weight, derived proficiencies, and weapon BTH/BTD are calculated in `src/rules/character-derived.ts`. Embedded Item effects are aggregated in `src/rules/effects.ts` and passed into that derived calculation. Source ability scores and manual bonuses are not rewritten.

Named migration M001 treats missing/`0` `schemaVersion` as legacy and persists the current version `1`. It does not persist derived totals. Malformed documents fail individually and are logged; they are not repaired silently. Reading stored `schemaVersion` uses public `document.toObject()` with `_source.system` as a fallback so TypeDataModel `initial: 1` defaults cannot hide legacy documents.

## Review Hotspots

- Manifest compatibility and paths in `system.json`.
- Actor and item document type registration.
- Sheet registration and template paths.
- Data migrations once persisted document schemas exist.
- Any code that accepts user-entered formulas, HTML, file paths, URLs, imports, or compendium content.
