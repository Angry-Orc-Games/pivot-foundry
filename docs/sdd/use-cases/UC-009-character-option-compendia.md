# UC-009 — Ship Character-Option Compendia and Apply Verified Effects

**Status:** NOT READY  
**Primary Actors:** Player, GM  
**Goal:** Provide species, backgrounds, feats, flaws, body modifications, magic streams, and related character options as data-backed compendium Items whose verified mechanical effects apply through UC-008.  
**Linked Requirements:** FR-009, FR-010, NFR-005, C-006, C-009  
**Relevant Entities:** Feature, Magic Stream, Magic Ability, Content Record, Effect Rule, Character

## 1. Title, goal, non-goals

Populate content after infrastructure exists.

Non-goals: copying large book prose; inventing effects from names; character build automation; new Item types when existing `feature`, `magicStream`, or `magicAbility` are sufficient.

## 2. User-facing behavior

- Player browses categorized Pivot compendia and drags/drops/imports an Item to the Character.
- Imported Item uses the existing Item sheet and becomes an ordinary embedded Item.
- If its source record contains verified Effect Rules, derived Character values update automatically.
- Removing the Item removes only its derived contributions; manual Character source is not rewritten.
- Content with no verified mechanical effect remains descriptive/manual.

GM sees the same content catalogs and may create/edit world copies according to Foundry permissions.

## 3. Data model changes

No new Actor arrays.

Prefer existing Item types:

- species/background/feat/flaw/body modification -> `feature` with existing category;
- magic stream -> `magicStream`;
- spells/magic abilities -> `magicAbility`;
- equipment/armour/weapons -> their existing types in UC-012.

Additive Item fields only if UC-008 schema or verified content cannot express necessary source data.

Migration: content records use `contentSchemaVersion`; document migrations only when schema semantics change.

## 4. Pure rules API

Use UC-008 validators/aggregator.

Add content-level validators for cross-record references only as needed:

```ts
validateContentCatalog(records: readonly ContentRecord[]): CatalogValidationResult;
```

Checks stable IDs, unique names only where required, stream references, category compatibility, and effect operation compatibility.

Rule sources by record: `Character Generation`, `Flaws`, `Backgrounds`, `Skills`, `Feats`, `Body Modifications`, `Magic`. Cite section title in each source record metadata; do not copy long prose.

## 5. Foundry integration

- deterministic build/generation creates packs;
- `system.json` declares pack metadata;
- verify drag/drop/import onto current ActorSheetV2; if default drop-to-embed is incomplete, add the smallest v13 sheet drop handler that accepts only Pivot Item documents;
- no automatic replacement of `identity.speciesText` / `backgroundText` in this slice unless separately specified. These existing text fallbacks may coexist until character-build UX is approved.

## 6. UI and localization

No sheet redesign. Existing Features/Magic tabs display imported Items.

Compendium names/labels localized where system-owned. Licensed item names remain content data.

Accessibility follows existing item controls; drag/drop must have an alternate create/import path if keyboard-only use cannot perform drag.

## 7. Tests

- content schema/catalog validation;
- representative record for each category;
- effect application/remove round trip;
- invalid cross-reference rejected;
- no duplicated Actor array/source mutation.

Manual Foundry v13:

- packs load;
- browse/open;
- drag/drop representative Item;
- sheet derived value updates;
- delete reverts;
- packaging includes packs.

## 8. Files likely to change

- `src/content/**`
- `scripts/**`
- `src/rules/effects.ts`
- `src/sheets/character-sheet.ts` only if drop handling needed
- `system.json`
- `packs/**`
- `lang/en.json`
- `tests/content/**`
- `tests/rules/effects.test.ts`

## 9. Risks, security, open rules questions

Blocking: licensed content extraction and approval; mapping each mechanical benefit to a whitelisted effect; source decision UC-008.

Security: reject malformed compendium imports and unknown effect payloads. Do not trust imported HTML/formulas.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

Complete content inventory; effect mapping approval; exact compendium grouping/names; drag/drop gap verification.

### Traceability

FR-009, FR-010; existing Item entities + Content Record/Effect Rule.

### Testability

Infrastructure test plan is clear; canonical expected content is not yet supplied.

### Assumptions

Existing Item types are preferred until a concrete content record proves they are insufficient.
