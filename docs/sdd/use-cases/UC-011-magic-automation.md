# UC-011 — Automate Magic Use

**Status:** NOT READY  
**Primary Actor:** Player  
**Goal:** Enforce verified magic eligibility/cost rules and spend/recover MP while preserving current Magic tab and Item types.  
**Linked Requirements:** FR-013, NFR-001, NFR-005, C-003, C-004  
**Relevant Entities:** Character, Magic Stream, Magic Ability, Roll Outcome

## 1. Title, goal, non-goals

Non-goals: new spell Item type; rune/thaumaturgy automation before Rune Point rules are verified; arbitrary formula execution expansion; redesign of Magic tab.

## 2. User-facing behavior

After verification:

- Magic Ability use control is enabled only when Character is eligible.
- Before use, system shows/uses the verified MP cost and rejects insufficient MP without rolling.
- Successful use spends MP exactly once and performs the ability's approved roll/damage workflow.
- Failed/cancelled use does not spend MP.
- MP recovery applies only through confirmed rest/recovery actions.
- Control Magic roll availability reflects Awakened status and selected magic ability according to verified rules.
- Rune/Thaumaturgy notes remain plain text until their dedicated mechanics are ready.

## 3. Data model changes

Prefer existing fields: `magic.awakened`, `magic.ability`, `magic.mp.value/maxBonus`, Magic Stream `ability/echelon`, Magic Ability `stream/echelon/mpCost/roll/damage`.

New fields only if MGP/stream progression cannot be derived from existing source/embedded Items.

## 4. Pure rules API

Reserved:

```ts
canUseMagicAbility(character: MagicCharacterSource, ability: MagicAbilitySource): MagicEligibility;
spendMp(current: number, cost: number): number | null;
calculateMpRecovery(...): number;
isControlMagicAvailable(...): boolean;
validateStreamEchelon(...): ValidationResult;
calculateMgpCost(...): number;
```

Exact rule logic blocked.

Rule sources: `Pivot_Fantasy_Beta.docx — Magic`; `Core Rules`; `Skills` (Control Magic).

## 5. Foundry integration

Reuse current Magic tab roll action. Gate and spend before/around roll according to approved transactional semantics. Do not use sockets unless permissions require it. Roll/damage formula security must be reviewed before increasing automation.

## 6. UI and localization

Existing Magic tab:

- eligibility reason text;
- MP cost visible;
- disabled controls have accessible explanation;
- recovery action only when rest rule exists.

## 7. Tests

Eligibility combinations, insufficient/exact MP, cancel/failure spend behavior, stream/echelon boundaries, Control Magic gating, recovery values.

Manual v13: Item use, MP update, disabled reason, reload.

## 8. Files likely to change

- `src/rules/magic.ts`
- `src/sheets/character-sheet.ts`
- `templates/actors/character-sheet.hbs`
- `lang/en.json`
- `tests/rules/magic.test.ts`
- possibly `src/data/item-data.ts` if verified source needs fields

## 9. Risks, security, open rules questions

Blocking: echelon level gates; MGP meaning/cost tables; stream requirements; MP rest recovery; Control Magic exact gating; whether use spends MP before or after a successful roll; rune/thaumaturgy mechanics.

Formula strings are untrusted input and need a narrow validation strategy/security review.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

All listed magic rules.

### Traceability

FR-013; Character, Magic Stream, Magic Ability.

### Testability

Test categories defined; canonical expected values unavailable.

### Assumptions

No MGP or magic progression behavior is inferred.
