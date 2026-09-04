# UC-012 — Enforce Gear Rules and Ship Inventory Content

**Status:** NOT READY  
**Primary Actors:** Player, GM  
**Goal:** Add verified gear restrictions/weight rules and equipment compendia using existing embedded Item types.  
**Linked Requirements:** FR-009, FR-014, NFR-001, NFR-005, C-003, C-004, C-006, C-007  
**Relevant Entities:** Weapon, Armour, Equipment, Character, Content Record

## 1. Title, goal, non-goals

Non-goals: first-class crafting/magic-item/rune-stone/potion types unless a concrete UX/mechanical requirement justifies them; currency rewrite; inventory-grid redesign.

## 2. User-facing behavior

After rules verification:

- equipping/using gear reports unmet Strength/proficiency requirements and applies only confirmed penalties;
- armour rest penalties are applied by the rest workflow, not by permanently altering derived stats;
- currency weight contributes to total carried weight if the rules specify it;
- compendium gear imports as existing Weapon/Armour/Equipment Items;
- unsupported special items remain Equipment/Feature with data-backed notes/effects until a dedicated type is justified.

## 3. Data model changes

Potential Item source additions depend on rules, for example explicit `strengthRequirement`. Do not infer.

Currency weight is derived from existing currency source if denomination weights are fixed rules; do not persist currency-weight total.

Migration: additive defaults or named migration when semantics require.

## 4. Pure rules API

Reserved:

```ts
validateGearRequirements(...): GearRequirementResult;
calculateArmourPenalty(...): ...;
calculateCurrencyWeight(currency: CurrencySource): number;
calculateRestPenaltyFromArmour(...): ...;
```

Rule sources: `Pivot_Fantasy_Beta.docx — Gear`; `Combat`; crafting/magic-item sections as applicable.

## 5. Foundry integration

Extend existing Equipment/Combat displays minimally. Content via UC-008 pipeline. Recompute total weight in existing derived context with currency contribution only after verified.

## 6. UI and localization

Existing Equipment tab. Show requirement/penalty text adjacent to affected Item; do not use color alone. No new tab.

## 7. Tests

Requirements, proficiency combinations, currency denominations/zero values, carried/equipped distinctions, rest-penalty boundaries.

Manual v13: equip toggle, derived AC/weight, content drag/drop.

## 8. Files likely to change

- `src/data/item-data.ts`
- `src/rules/gear.ts`
- `src/rules/character-derived.ts`
- `src/sheets/character-sheet.ts`
- item/actor templates
- `lang/en.json`
- `tests/rules/gear.test.ts`
- `src/content/**`, `packs/**`, `system.json`

## 9. Risks, security, open rules questions

Blocking: exact Strength requirements; failure penalties; armour proficiency effects; armour rest penalties; denomination weights; crafting/magic item modeling requirements.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

All exact gear rules and first content batch.

### Traceability

FR-009, FR-014.

### Testability

Awaiting canonical values.

### Assumptions

No new Item type is justified yet.
