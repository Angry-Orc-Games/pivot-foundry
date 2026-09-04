# UC-005 — Apply Damage, Healing, and Temporary HP

**Status:** NOT READY  
**Primary Actors:** Player, GM  
**Goal:** Apply authorized HP transactions to a Character and targets without bypassing Pivot damage/temporary-HP rules.  
**Linked Requirements:** FR-006, FR-015, NFR-001, NFR-003, NFR-005, C-003  
**Relevant Entities:** Character, Temporary Hit Points, Roll Outcome

## 1. Title, goal, non-goals

Introduce one bounded HP transaction model and target application. Non-goals: resistance/vulnerability unless Pivot rules require them; death-save consequences; conditions; mass damage; NPC parity.

## 2. User-facing behavior

Proposed observable behavior pending rule confirmation:

- authorized user selects one or more valid Character targets and chooses Apply Damage or Apply Healing from a roll/chat action;
- system previews amount and affected targets;
- confirmation applies one update per target;
- damage/healing never creates negative HP and healing never exceeds HP max;
- temporary HP is displayed separately and handled according to verified Pivot ordering;
- failed permission/update on one target is reported per target and does not fabricate success.

GM may apply to owned/authorized targets according to Foundry permissions. Player can apply only where Foundry permits.

## 3. Data model changes

Proposed additive Character source:

```text
system.attributes.hp.temp: number >= 0, default 0
```

Temporary HP is mutable current state, not derived.

Migration impact: additive default only if DataModel default is sufficient. If legacy documents need semantic transformation, defer to UC-008 named migration infrastructure.

## 4. Pure rules API

Boundary only; exact behavior blocked:

```ts
export interface HpState { value: number; max: number; temp: number; }

export function applyDamage(state: HpState, amount: number): HpState;
export function applyHealing(state: HpState, amount: number): HpState;
export function grantTemporaryHp(state: HpState, amount: number): HpState;
```

Rules source: `Pivot_Fantasy_Beta.docx — Combat`.

Must define from source before implementation: temp HP consumption order, replacement/stacking, overflow damage, healing interaction, zero-HP state.

## 5. Foundry integration

Smallest surface after rules approval:

- chat action buttons on damage rolls for owned/targeted tokens;
- use public Foundry v13 target/token/Actor update APIs;
- no sockets until a concrete permission case requires GM mediation;
- no automatic condition/death-save side effects in this slice.

## 6. UI and localization

Combat tab: add Temp HP field only if source rule exists and approved.

Chat/localization:

- apply damage/healing labels;
- confirmation target list;
- partial failure/permission messages;
- Temp HP accessible label.

State changes must be textual/numeric, not color-only.

## 7. Tests

After rules verification:

- pure HP state transitions at boundaries;
- temp HP cases;
- zero/max clamps;
- invalid amounts;
- multi-target Foundry seam tests for permission/update failure.

Manual Foundry v13: target selection, ownership, updates, chat controls.

## 8. Files likely to change

- `src/data/character-data.ts`
- `src/rules/hp.ts`
- `src/sheets/character-sheet.ts`
- `templates/actors/character-sheet.hbs`
- `lang/en.json`
- `tests/rules/hp.test.ts`
- sheet tests

## 9. Risks, security, open rules questions

Blocking: temporary-HP semantics and zero-HP consequences. Multi-target updates require permission review. Chat action payloads must not trust arbitrary Actor IDs/amounts from DOM; revalidate at action time.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

Temp HP ordering/stacking/replacement; zero-HP side effects; whether players may self-apply chat damage by default.

### Traceability

FR-006, FR-015; Character, Temporary Hit Points.

### Testability

Test shape is defined but expected state transitions are not.

### Assumptions

None converted to requirements.
