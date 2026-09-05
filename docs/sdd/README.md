# Pivot Foundry — Remaining Product Work SDD Package

Prepared: **2026-09-04**  
Repository: `Angry-Orc-Games/pivot-foundry` (`main`, inspected 2026-09-04)  
Foundry target: **v13**  
Package id: **pivot-fantasy**

## Current vs target map

The repository is already an early playable native character sheet, not a scaffold. The current source tree has TypeDataModels for one Character Actor and six Item types, `ActorSheetV2` / `ItemSheetV2` with `HandlebarsApplicationMixin`, embedded-item editing, resource steppers, a thin `src/pivot.ts`, and deterministic rules in `src/rules/`. Current roll buttons still construct raw Foundry `Roll` formulas in `src/sheets/character-sheet.ts`; d20 pool resolution and attack natural-20/natural-1 helpers already exist but are not wired into those sheet rolls. The repository README likewise identifies content packs, content-driven automation, combat-tracker integration, exploding damage, and migrations as remaining work.

Target state is reached incrementally: finish core roll/resource/combat primitives on the current sheet first; then add safe effect/content infrastructure; then content, build/advancement, magic/gear automation; and only then add GM/NPC tooling. No slice redesigns the character sheet or introduces a parallel actor model.

## Sequence

| Slice | Use Case                                                      | Status                                       | Dependency / reason                                                             |
| ----- | ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | UC-001 Roll a d20 test with Pivot roll modes                  | **READY**                                    | Next implementable increment; no schema change.                                 |
| 2     | UC-002 Spend and recover Pool                                 | **READY**                                    | Uses existing Pool source/max derivation.                                       |
| 3     | UC-003 Roll initiative into Foundry combat                    | **READY WITH PROPOSED UX DECISION**          | Requires Foundry v13 smoke; no game-rule ambiguity.                             |
| 4     | UC-004 Resolve attack natural results and exploding damage    | **PARTIAL / NOT READY for exploding damage** | Natural 20/1 is ready; exploding algorithm must be verified.                    |
| 5     | UC-005 Apply damage, healing, and temporary HP                | **NOT READY**                                | Damage order/temporary-HP interaction requires rules confirmation.              |
| 6     | UC-006 Resolve death saves                                    | **NOT READY**                                | Exact thresholds/consequences are an explicit open rule question.               |
| 7     | UC-007 Enforce combat state, cover, movement, and rests       | **NOT READY**                                | Exact action/cover/movement/rest rules must be extracted.                       |
| 8     | UC-008 Add migrations, effect schema, and content pipeline    | **READY FOR DESIGN APPROVAL**                | Infrastructure; intentionally precedes automated content effects.               |
| 9     | UC-009 Ship character-option compendia and effect application | **NOT READY**                                | Requires UC-008 and licensed content extraction/approval.                       |
| 10    | UC-010 Automate character generation and advancement          | **NOT READY**                                | Build-point and advancement algorithms must be verified.                        |
| 11    | UC-011 Automate magic use                                     | **NOT READY**                                | Stream/echelon gates, MGP, MP recovery, Control Magic details must be verified. |
| 12    | UC-012 Enforce gear rules and ship inventory content          | **NOT READY**                                | Strength/proficiency/rest/currency-weight rules must be verified.               |
| 13    | UC-013 Add GM/NPC tooling                                     | **NOT READY**                                | Dedicated later scope; must not leak into character slices.                     |

The recommended delivery plan is to implement UC-001 and UC-002 first, then UC-003 after the proposed tracker UX is accepted. UC-004 may ship as a smaller natural-result sub-slice before exploding damage if desired.

## Content approach decision

**Recommendation: version-controlled JSON as canonical content source, generated into Foundry compendium packs.**

Why:

1. Foundry pack database files are distribution-friendly but poor as the only human-reviewable source.
2. TypeScript constants make content diffable but mix authored data with executable code and encourage recompilation-oriented authoring.
3. JSON fixtures can be schema-validated, reviewed, migrated by version, and converted by a deterministic script.
4. Generated packs can be recreated, which reduces migration risk and lets content schema versions evolve independently from document migrations.

Canonical content should live under `src/content/` with validation tests under `tests/content/`; generation may use the existing `scripts/` area and produce `packs/`. `system.json` declares only generated packs. Conversion must reject unknown keys/types/effect operations and must not evaluate formulas or HTML.

## Rule-source citation convention

Rules references inside these SDDs cite **section titles only**, for example `Pivot_Fantasy_Beta.docx — Core Rules` or `— Combat`, and do not reproduce large rule passages. Player-facing grouping/terms may cite `Pivot Character Sheet Beta1.pdf — page 1/2 grouping` without treating its AcroForm field names as semantic identifiers.

## Repository evidence

Inspected from the public repository on 2026-09-04:

- `src/sheets/character-sheet.ts`
- `src/rules/d20-roll.ts`
- `src/rules/character-derived.ts`
- `src/data/character-data.ts`
- `src/data/item-data.ts`
- `src/pivot.ts`
- `lang/en.json`
- `AGENTS.md`
- `system.json`
- repository README

GitHub: https://github.com/Angry-Orc-Games/pivot-foundry

## Package contents

- `requirements.md` — intent, quality requirements, constraints
- `entity-model.md` — shared vocabulary and planned model deltas
- `use-cases.puml` — scope/sequence overview
- `use-cases/UC-001-...md` through `UC-013-...md` — implementation slices
