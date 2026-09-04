# UC-013 — Add GM/NPC Tooling

**Status:** NOT READY  
**Primary Actor:** GM  
**Goal:** Introduce creature/NPC/BBEG documents and GM encounter tools as a dedicated product phase after character rules/content stabilize.  
**Linked Requirements:** FR-016, NFR-001, NFR-003, C-008  
**Relevant Entities:** To be defined from verified Bestiary/GM rules

## 1. Title, goal, non-goals

This is an explicit scope boundary, not permission to add NPC parity opportunistically.

Potential future sub-slices: NPC/creature data model, NPC sheet, tiers/overlays, encounter budgets, bestiary compendium, rewards.

Non-goals: modifying Character schema to impersonate NPCs; reusing character sheet by default; implementing all GM features in one release.

## 2. User-facing behavior

No behavior is approved yet. Each GM capability needs its own actor goal and use case.

## 3. Data model changes

Unknown. New Actor types require explicit `system.json` declarations and TypeDataModels. Entity vocabulary must be extracted first from Pivot `GM advice`, `Gonks/Bosses/Bad Guys`, and `Bestiary`.

## 4. Pure rules API

No signatures approved. Encounter-budget and creature-construction math must be extracted into pure rules before any sheet/runtime work.

Rule sources: `Pivot_Fantasy_Beta.docx — GM advice`; `Gonks/Bosses/Bad Guys`; `Bestiary`.

## 5. Foundry integration

Later: register dedicated Actor type(s)/sheet(s) with Foundry v13 public APIs. Do not route through deprecated v1 sheets.

## 6. UI and localization

Dedicated GM-facing sheet/tooling only after entity model. Do not alter Character tab structure to make room preemptively.

## 7. Tests

Pure construction/budget tests first, sheet-context tests second, Foundry v13 smoke third.

## 8. Files likely to change

Eventually:
- `src/data/**`
- `src/rules/**`
- `src/sheets/**`
- `templates/**`
- `lang/en.json`
- `tests/**`
- `system.json`
- content packs

## 9. Risks, security, open rules questions

All entity/rule definitions, actor taxonomy, sheet fields, encounter budget formulas, overlays, rewards, and bestiary licensing/content scope are open.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

Requires a dedicated discovery/specification pass.

### Traceability

FR-016.

### Testability

Not yet decomposed.

### Assumptions

None.
