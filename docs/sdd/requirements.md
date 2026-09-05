# Pivot Foundry — Remaining Product Work Requirements

Status: **Draft for stakeholder review**  
Repository baseline inspected: **2026-09-04**, branch `main`  
Product baseline supplied by stakeholder: Pivot Fantasy Beta rules and Pivot Character Sheet Beta1, inspected 2026-08-25.

This catalog records intent and constraints for work that remains after the native character sheet baseline. It deliberately does not restate already-implemented sheet behavior as new requirements.

## Functional Requirements

| ID     | Title                   | Requirement                                                                                                                                                                                    |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 | D20 roll modes          | A player must be able to roll character d20 checks using Normal, Advantage, Disadvantage, and Super-Advantage behavior without changing persisted character totals.                            |
| FR-002 | Attack natural result   | Attack rolls must apply the existing natural-20 auto-hit and natural-1 auto-miss rule in the attack result presented to the user.                                                              |
| FR-003 | Pool spend and recovery | Players must be able to spend Pool without going below zero, and the system must support the confirmed long-rest Pool recovery rule.                                                           |
| FR-004 | Combat initiative       | A character initiative roll must be able to update the corresponding combatant in Foundry's active combat tracker.                                                                             |
| FR-005 | Exploding damage        | Weapon and other eligible damage rolls must support Pivot's exploding-damage rule once its exact rule text has been verified.                                                                  |
| FR-006 | HP transactions         | Authorized users must be able to apply damage, healing, and temporary HP to characters with observable, bounded state changes.                                                                 |
| FR-007 | Death saves             | The system must automate death-save thresholds and consequences only after the exact Pivot rules are verified.                                                                                 |
| FR-008 | Combat state            | The system must support confirmed rules for cover, action economy, movement, conditions, and rest automation without persisting values that are purely derived.                                |
| FR-009 | Content compendia       | The system must provide versioned Foundry compendium content for species, backgrounds, feats, flaws, equipment, spells/magic abilities, and magic streams without embedding large rules prose. |
| FR-010 | Item effects            | Content Items must be able to declare machine-readable, whitelisted effects that contribute to character calculations without duplicating embedded Items as Actor arrays.                      |
| FR-011 | Character generation    | The system must automate confirmed character-generation/build-point rules while preserving source choices and reporting invalid or over-budget builds.                                         |
| FR-012 | Advancement             | The system must automate confirmed XP/level/progression-point advancement rules while preserving an auditable source state.                                                                    |
| FR-013 | Magic automation        | The system must enforce confirmed stream/echelon gates, MGP costs, MP spending/recovery, Control Magic eligibility, and later rune/thaumaturgy mechanics.                                      |
| FR-014 | Gear rules              | The system must enforce confirmed Strength requirements, armour proficiency penalties, armour rest penalties, currency weight, and other gear rules where supported by the rules source.       |
| FR-015 | Data migration          | The system must provide explicit schema versioning and named migrations before any change requires transformation of existing stored documents.                                                |
| FR-016 | GM/NPC tooling          | NPC/creature/BBEG sheets, encounter budgets, overlays, bestiary tooling, and rewards must be implemented only in dedicated later slices.                                                       |

## Non-Functional Requirements

| ID      | Title                          | Requirement                                                                                                                                                       |
| ------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-001 | Pure deterministic rules       | Deterministic game math must live under `src/rules/`, must not depend on Foundry globals, and must have Vitest coverage under `tests/rules/`.                     |
| NFR-002 | Verification                   | Every shippable slice must pass `npm run verify`; Foundry v13 smoke acceptance is reported separately from repository CI.                                         |
| NFR-003 | Foundry v13                    | Runtime integration must use public Foundry VTT v13 APIs only and must not assume v14 behavior.                                                                   |
| NFR-004 | Localization and accessibility | All user-visible strings must be localized in `lang/en.json`; controls must have textual/accessible labels and state must not be conveyed by color alone.         |
| NFR-005 | Security                       | User formulas, HTML, file paths, URLs, imports, compendium conversion, and any future rich text must be explicitly validated/sanitized and reviewed for security. |
| NFR-006 | Small synchronization diffs    | Work must extend the current repository and preserve unrelated sheet behavior; a slice must not regenerate or redesign the character sheet.                       |

## Constraints

| ID    | Title             | Constraint                                                                                                                                                                                                                       |
| ----- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-001 | Package identity  | Foundry package id remains `pivot-fantasy` unless a separately approved migration plan changes it.                                                                                                                               |
| C-002 | Build/runtime     | TypeScript strict mode, Vite output `dist/pivot.mjs`, Vitest, ESLint, Prettier, Node `>=20.19.0`.                                                                                                                                |
| C-003 | Source vs derived | Persist player-editable/current-state source and migration metadata only; do not persist derived modifiers, proficiency, saves, skill totals, passive Perception, Pool max, MP max, AC, initiative, carried weight, BTH, or BTD. |
| C-004 | Embedded Items    | Do not create parallel Actor arrays that duplicate embedded Items.                                                                                                                                                               |
| C-005 | Original system   | Do not copy code from other Foundry systems and do not model this as a D&D 5e fork.                                                                                                                                              |
| C-006 | Content license   | Do not place substantial Pivot Fantasy rules prose in code or compendia; store narrow machine-readable data and short player-facing labels/descriptions only as licensed/approved.                                               |
| C-007 | British spelling  | Domain data uses `armour`; feature categories retain `bodyModification`.                                                                                                                                                         |
| C-008 | Character scope   | Do not add NPC/BBEG parity inside character-focused slices.                                                                                                                                                                      |
| C-009 | Effect safety     | Do not automate species/background/feat/flaw/body-modification effects until the effect schema in UC-008 is approved and implemented.                                                                                            |

## Traceability

The numbered implementation slices are represented by `UC-001` through `UC-013`. Later rules-blocked use cases remain **NOT READY** until their unresolved decisions are answered; they are sequencing contracts, not permission to invent canon.
