# UC-008 — Add Migration, Effect, and Content Infrastructure

**Status:** READY FOR DESIGN APPROVAL  
**Primary Actor:** GM / System Maintainer  
**Goal:** Establish the smallest safe foundation for future compendium content and automatic item effects without mutating Character source totals.  
**Linked Requirements:** FR-009, FR-010, FR-015, NFR-001, NFR-002, NFR-005, C-004, C-006, C-009  
**Relevant Entities:** Character, embedded Items, Effect Rule, Content Record, Document Schema Version

## 1. Title, goal, non-goals

Implement infrastructure only.

Non-goals: shipping the full published species/background/feat/flaw catalogs; inventing effect mappings; character generation; automatic granting/removal of Items; arbitrary expressions; HTML content; NPC types.

## 2. User-facing behavior

Player:

- existing sheet continues to work;
- an embedded Item with approved `effects` contributes to derived values automatically;
- derived values update when the Item is added/removed or its effects change;
- manual source fields remain visible/editable as today unless a later UX spec changes them.

GM/maintainer:

- can import/drop generated compendium Items through normal Foundry workflows;
- invalid content records are rejected at build/generation time, not repaired silently at runtime;
- opening a world runs named document migrations when required and reports failure without partially pretending success.

## 3. Data model changes

Add to all six Item DataModels, or to their shared schema construction if one exists:

```ts
effects: ArrayField<EffectRule>; // default []
schemaVersion: integer; // default current schema version
```

Add `schemaVersion` to Character DataModel as migration metadata.

EffectRule v1 is a discriminated union:

```ts
type EffectRule =
  | { type: "abilityScoreBonus"; ability: AbilityKey; amount: number }
  | { type: "skillBonus"; skill: CanonicalSkillId; amount: number }
  | { type: "armourProficiency"; category: "light" | "medium" | "heavy" | "shield" }
  | { type: "weaponProficiency"; category: WeaponCategory }
  | { type: "acBonus"; amount: number }
  | { type: "initiativeBonus"; amount: number }
  | { type: "speedBonus"; amount: number }
  | { type: "poolMaxBonus"; amount: number }
  | { type: "mpMaxBonus"; amount: number };
```

Rules are source on Item. Effective totals/proficiencies are derived.

No arbitrary `path`, no formula string, no script, no predicate language in v1.

Migration impact: **named migration framework M001** establishes metadata/current-version semantics. Existing Actors/Items with absent version are treated as legacy version 0 and migrated idempotently to current version. Migration must not rewrite derived totals.

## 4. Pure rules API

```ts
export interface CharacterEffectInput {
  effects: readonly EffectRule[];
}

export function aggregateCharacterEffects(effects: readonly EffectRule[]): CharacterEffectSummary;

export function validateEffectRule(value: unknown): EffectRule;
```

`CharacterEffectSummary` contains typed contributions, not document paths.

Existing `calculateCharacterDerived` is extended to accept effect contributions as an additional input alongside manual source. It remains deterministic.

Content validation:

```ts
export function validateContentRecord(value: unknown): ContentRecord;
```

No content converter evaluates formulas/HTML.

Rules source: effect values later map to `Character Generation`, `Backgrounds`, `Flaws`, `Feats`, `Body Modifications`, `Magic`, or `Gear`. This infrastructure itself is a product architecture decision, not a new Pivot rule.

## 5. Foundry integration

Migration:

- register a small migration runner from `src/pivot.ts` on the appropriate v13-ready lifecycle;
- use public Actor/Item document APIs;
- migration registry is ordered and idempotent;
- run only when stored version < current;
- failure is localized/logged and stops further migration for that document/world path.

Effects:

- sheet context collects `effects` from embedded Items and passes them to pure aggregation/derived rules;
- no hook is required if context recalculates from current embedded Items.

Content:

- canonical JSON under `src/content/`;
- validation/generation script under existing `scripts/`;
- generated Foundry packs under `packs/`;
- `system.json` declares generated packs only after at least one validated pack exists.

## 6. UI and localization

No new Character layout.

Item sheet may add a **read-only initially** "Effects" summary for imported content. Editing raw effect rules through free-form text is not allowed in v1. If maintainers need editing, add typed controls in a later spec.

Localization:

- migration success/failure messages if user-visible;
- effect type labels if shown.

## 7. Tests

Rules:

- each EffectRule type aggregates correctly;
- multiple effects add/grant deterministically;
- unsupported type/unknown skill/category rejected;
- no mutation of source input;
- existing manual bonuses combine with effect contribution while derived totals remain unpersisted.

Migration:

- legacy version 0 -> current;
- current -> no-op;
- idempotence;
- malformed doc reports failure;
- no derived fields persisted.

Content validation:

- valid record accepted;
- unknown keys/types/effects rejected;
- duplicate `contentId` rejected;
- generator deterministic for identical input.

Manual Foundry v13 smoke:

- open legacy sample world/document;
- migration completes;
- drop one generated Item onto Character;
- derived value changes and reverts on delete;
- Item source manual fields remain intact;
- `npm run verify` and `npm run package:system`.

## 8. Files likely to change

- `src/data/character-data.ts`
- `src/data/item-data.ts`
- `src/rules/effects.ts`
- `src/rules/character-derived.ts`
- `src/pivot.ts`
- `src/sheets/character-sheet.ts`
- `src/sheets/item-sheet.ts`
- `lang/en.json`
- `tests/rules/effects.test.ts`
- migration/content tests
- `scripts/` generation utility
- `src/content/` source records
- `system.json` and `packs/` only when a real generated pack is added

## 9. Risks, security, open rules questions

Security: effect schemas and compendium conversion are a high-risk boundary. Whitelist all operations and properties; reject unknown input; no eval, arbitrary paths, HTML, URLs, or formulas.

Risk: Foundry pack generation format/version coupling. Generator must target Foundry v13 and be tested in the v13 sandbox.

Open design decision: approve JSON-as-canonical + generated packs. If rejected, do not implement content generation until an alternative source-of-truth approach is selected.

## SDD Readiness

**Status: READY FOR DESIGN APPROVAL**

### Unresolved Decisions

Approve canonical JSON/generated-pack approach and the exact v1 effect operation list.

### Traceability

FR-009, FR-010, FR-015; Effect Rule, Content Record, Document Schema Version.

### Testability

Schema validation, aggregation, migration idempotence, and pack smoke are testable.

### Assumptions

The initial effect operation list is infrastructure capability, not evidence that any particular published option uses that effect.
