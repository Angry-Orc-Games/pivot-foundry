# Architecture

Pivot Foundry is currently a small Foundry VTT v13 system scaffold. The architecture goal is to keep Foundry integration thin while deterministic Pivot Fantasy rules grow as plain TypeScript modules with unit coverage.

## Current Shape

- `system.json` declares the Foundry system manifest, language file, stylesheet, module entry point, release URLs, the `character` Actor document type, and Pivot Item document types.
- `src/pivot.ts` is the Foundry runtime entry point. It registers Actor/Item data models, token resource paths, and native sheets during the Foundry `init` hook.
- `src/data/` contains TypeDataModel schema factories for `Actor.character` and Pivot Item types.
- `src/sheets/` contains the character and item sheet classes plus testable sheet-context helpers.
- `src/rules/` contains deterministic rules code that does not depend on Foundry globals, including d20 roll modes, Pool resource transactions, and combatant selection for initiative.
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

- `identity`, `progression`, `abilities`, `attributes`, `resources`, `skills`, `skillSpecializations`, `proficiencies`, `currency`, `magic`, and `notes` live on `Actor.character`.
- Weapons, armour, equipment, features/flaws/background/species notes, magic streams, and magic abilities are embedded Items.
- Ability modifiers, proficiency bonus, saves, skill totals, passive perception, Pool maximum, MP maximum, AC, initiative, carried weight, and weapon BTH/BTD are calculated in `src/rules/character-derived.ts`.

Existing pre-sheet Actors had empty system data. The TypeDataModel defaults initialize the new schema without repurposing previous fields; no destructive migration is currently required.

## Review Hotspots

- Manifest compatibility and paths in `system.json`.
- Actor and item document type registration.
- Sheet registration and template paths.
- Data migrations once persisted document schemas exist.
- Any code that accepts user-entered formulas, HTML, file paths, URLs, imports, or compendium content.
