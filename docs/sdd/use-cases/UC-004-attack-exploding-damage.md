# UC-004 — Resolve Attack Natural Results and Exploding Damage

**Status:** PARTIAL — attack natural result READY; exploding damage NOT READY  
**Primary Actor:** Player  
**Goal:** Complete Pivot attack-result presentation and, once verified, damage explosion behavior.  
**Linked Requirements:** FR-002, FR-005, NFR-001, NFR-002, NFR-003, NFR-005  
**Relevant Entities:** Character, Weapon, Roll Outcome

## 1. Title, goal, non-goals

This slice is intentionally separable:

- **UC-004A**: apply existing `applyAttackCrit` in weapon-attack chat using the kept d20 from UC-001.
- **UC-004B**: implement exploding damage only after exact eligibility, trigger, recursion, and modifier interaction are verified.

Non-goals: target AC comparison, damage application to actors, conditions.

## 2. User-facing behavior

UC-004A:

- weapon attack natural 20 chat explicitly reports automatic hit;
- natural 1 explicitly reports automatic miss;
- other naturals report only the rolled total, not hit/miss.

UC-004B, pending rule verification:

- eligible damage rolls visibly show each explosion die and final total;
- non-eligible formulas remain ordinary rolls;
- system must not silently change a user-entered/legacy damage formula when eligibility is unknown.

## 3. Data model changes

None anticipated for UC-004A.

UC-004B must not add a persisted "exploding total". If eligibility cannot be derived from existing Item source, a new explicit Item source field may be proposed only after the rules source is verified. That would require an additive default, not a parallel attack entity.

## 4. Pure rules API

UC-004A uses:

```ts
applyAttackCrit(naturalD20Result: number): "hit" | "miss" | null;
```

UC-004B boundary, **signature reserved but behavior not approved**:

```ts
export interface DamageDieSpec {
  count: number;
  faces: number;
}

export interface ExplodingDamageResult {
  rolls: readonly number[];
  totalDiceValue: number;
}

export function resolveExplodingDamage(
  initialResults: readonly number[],
  dieFaces: number,
  additionalRolls: readonly number[],
): ExplodingDamageResult;
```

Do not implement this signature until source verification answers trigger/recursion semantics; it may change.

Rule source: `Pivot_Fantasy_Beta.docx — Combat`.

## 5. Foundry integration

UC-004A is chat-only wiring in the current character sheet.

UC-004B should keep explosion decision math pure and use Foundry only to perform/display dice rolls. Avoid dynamic execution of arbitrary formula fragments. If formulas must be parsed, use a narrow validated grammar and security review.

## 6. UI and localization

UC-004A uses UC-001 chat keys.

UC-004B proposed keys after approval:

- `PIVOT.Chat.ExplodingDamage`
- `PIVOT.Chat.ExplosionRoll`
- `PIVOT.Chat.DamageTotal`

No new sheet layout is required unless eligibility needs an explicit Item field.

## 7. Tests

UC-004A:

- kept 20 -> auto hit;
- kept 1 -> auto miss;
- modifier cannot convert natural 1/20 semantics;
- non-attack rolls never call attack crit semantics.

UC-004B: tests cannot be finalized until source verification. Required coverage will include no explosion, one explosion, chained explosion if allowed, maximum/invalid faces, modifier placement, and mixed dice/formula handling.

Manual Foundry v13 smoke: UC-004A attack chat. UC-004B later verifies visible roll chain.

## 8. Files likely to change

- `src/rules/d20-roll.ts`
- `src/rules/damage.ts` (UC-004B)
- `src/sheets/character-sheet.ts`
- `lang/en.json`
- `tests/rules/d20-roll.test.ts`
- `tests/rules/damage.test.ts`

## 9. Risks, security, open rules questions

Blocking UC-004B questions:

1. Which damage dice explode?
2. What face/result triggers an explosion?
3. Can newly rolled dice explode recursively?
4. Are flat modifiers added once or affected?
5. How do multiple dice terms behave?
6. Do magic damage and weapon damage use the same rule?

Formula parsing/evaluation is security-sensitive.

## SDD Readiness

**Status: UC-004A READY; UC-004B NOT READY**

### Unresolved Decisions

All exploding-damage questions above.

### Traceability

FR-002, FR-005; Weapon, Roll Outcome.

### Testability

UC-004A complete. UC-004B test matrix awaits rule confirmation.

### Assumptions

No assumption is made about exploding damage canon.
