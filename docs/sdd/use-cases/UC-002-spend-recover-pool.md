# UC-002 — Spend and Recover Pool

**Status:** READY  
**Primary Actor:** Player  
**Goal:** Change current Pool through bounded spend/recovery operations and apply the confirmed long-rest Pool recovery amount without changing derived Pool max.  
**Linked Requirements:** FR-003, NFR-001, NFR-002, NFR-004, C-003  
**Relevant Entities:** Character, Pool Transaction

## 1. Title, goal, non-goals

This slice turns existing Pool steppers into explicit rule-aware transactions and adds **Recover Pool (Long Rest)**. It does not implement a full rest workflow.

Non-goals: HP recovery, MP recovery, armour rest penalties, feature use costs, automatic Pool costs from abilities, encounter/action recovery, or changing Pool max derivation.

## 2. User-facing behavior

Player:

1. Existing +/- Pool controls remain available.
2. A decrement never reduces Pool below 0.
3. An increment/recovery never raises Pool above derived Pool max.
4. Player may activate `Recover Pool (Long Rest)`.
5. System calculates the recovery amount as half of derived Pool max, rounded down, with a minimum recovery amount of 1.
6. System increases current Pool by that amount but caps at derived Pool max.
7. If already at max, value remains unchanged and a localized informational notification may be shown.
8. The control is labeled specifically as Pool recovery; it must not imply HP/MP or all long-rest effects were processed.

GM with edit permission may use the same controls.

## 3. Data model changes

None. Persist only `system.resources.pool.value`. Derived max remains `max(1, level + maxBonus)`.

Migration impact: none.

## 4. Pure rules API

```ts
export function spendBoundedResource(
  current: number,
  amount: number,
): number;

export function recoverBoundedResource(
  current: number,
  max: number,
  amount: number,
): number;

export function poolRecoveryForLongRest(poolMax: number): number;

export function recoverPoolOnLongRest(
  current: number,
  poolMax: number,
): number;
```

Rules:

- inputs are finite integers >= 0 except Pool max must be >= 1;
- spend amount 0 is a no-op;
- overspend returns 0 only when used as a direct bounded decrement; callers that need "reject if insufficient" must not infer that policy from this helper;
- recovery caps at max;
- `poolRecoveryForLongRest(max) = max(1, floor(max / 2))`;
- final recovery = `min(max, current + recoveryAmount)`.

Rule source: `Pivot_Fantasy_Beta.docx — Core Rules` / rest material referenced in the project brief.

## 5. Foundry integration

- Keep resource update action in the character sheet.
- Before writing Pool value, compute derived Pool max using existing rules and clamp through the pure helper.
- Add one sheet action for long-rest Pool recovery. It performs one Actor update to `system.resources.pool.value`.
- No hooks, sockets, settings, or chat message required.
- Do not implement a generic "long rest" command in this slice.

## 6. UI and localization

Existing Core/resources area:

- preserve Pool current/max display;
- add accessible button `Recover Pool (Long Rest)`;
- +/- buttons must have localized `aria-label`/title if currently icon-only.

Localization keys:

- `PIVOT.Actions.RecoverPoolLongRest`
- `PIVOT.Notifications.PoolAlreadyFull`
- `PIVOT.Accessibility.IncreasePool`
- `PIVOT.Accessibility.DecreasePool`

## 7. Tests

Vitest:

- spend 5 by 2 -> 3;
- overspend clamps to 0;
- recovery caps at max;
- long-rest recovery: max 1 -> 1; 2 -> 1; 3 -> 1; 4 -> 2; 5 -> 2;
- current near max caps correctly;
- invalid negative/non-integer/non-finite input throws.

Sheet tests:

- Pool adjust uses derived max;
- HP/MP existing steppers are not silently changed to Pool rules.

Manual Foundry v13 smoke:

- Pool cannot exceed displayed derived max;
- recovery button changes only Pool;
- full Pool remains full;
- permissions/editability behave as current sheet controls;
- `npm run verify`.

## 8. Files likely to change

- `src/rules/resources.ts` (new) or smallest existing rules file if project prefers
- `src/sheets/character-sheet.ts`
- `templates/actors/character-sheet.hbs`
- `lang/en.json`
- `tests/rules/resources.test.ts`
- relevant sheet tests

## 9. Risks, security, open rules questions

No formula/HTML risk. Race risk is low but two simultaneous user updates could overwrite current value; use the current Actor value at action time and a single update.

Open rules question not blocking this narrow slice: other long-rest effects and other Pool recovery triggers remain unspecified and must be separate use cases.

## SDD Readiness

**Status: READY**

### Unresolved Decisions

None for the narrow Pool-only recovery operation.

### Traceability

FR-003; Character Pool Transaction.

### Testability

Spend, cap, long-rest amount, no-op at max, and no unrelated resource changes are directly testable.

### Assumptions

"Long rest half Pool rounded down min 1" means recovery amount is based on **Pool max**. If the source text instead bases it on current/missing Pool, update this spec before implementation.
