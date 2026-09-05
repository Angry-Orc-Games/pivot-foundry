# UC-001 — Roll a d20 Test with Pivot Roll Modes

**Status:** READY  
**Primary Actor:** Player  
**Goal:** Roll an existing Character d20 check using Pivot Normal/Advantage/Disadvantage/Super-Advantage behavior and receive one traceable chat result.  
**Linked Requirements:** FR-001, FR-002 (attack natural result only where applicable), NFR-001, NFR-002, NFR-003, NFR-004, C-003  
**Relevant Entities:** Character, Roll Mode, Roll Outcome

## 1. Title, goal, non-goals

Goal is the smallest wiring slice over the existing sheet: reuse current derived modifiers and `resolveDicePool`, remove the hard-coded `1d20+bonus` behavior for d20 checks, and produce a chat roll whose kept die and mode are observable.

Non-goals: combat-tracker initiative updates; automated advantage-source discovery; target AC comparison; exploding damage; damage application; MP/Pool spending; sheet redesign; persisting roll mode.

## 2. User-facing behavior

Player behavior:

1. Player activates an existing d20 roll control for ability, save, skill, initiative, or weapon attack.
2. System opens a localized roll-mode prompt with four choices: Normal, Advantage, Disadvantage, Super-Advantage. Normal is initially selected.
3. Player confirms or cancels.
4. On cancel, no roll/chat message/state change occurs.
5. On confirm, system resolves the selected mode to a dice pool, rolls the required d20s, keeps the correct die, adds the existing derived modifier, and posts one chat message.
6. Chat visibly states roll label, selected mode, kept natural d20, modifier, and total.
7. For weapon attacks only, the chat result additionally reports automatic hit on kept natural 20 or automatic miss on kept natural 1. It does not otherwise claim hit/miss because target AC resolution is not in this slice.

GM observes the same chat result. GM receives no extra control in this slice.

## 3. Data model changes

None.

Roll mode and Roll Outcome are ephemeral. No Actor/Item migration.

## 4. Pure rules API

Existing API remains authoritative:

```ts
resolveDicePool(
  advantageSources: number,
  disadvantageSources: number,
): { dieCount: number; pick: "highest" | "lowest" | "single" }

applyAttackCrit(naturalD20Result: number): "hit" | "miss" | null
```

Add pure helpers:

```ts
export type RollMode = "normal" | "advantage" | "disadvantage" | "superAdvantage";

export function dicePoolForRollMode(mode: RollMode): DicePoolResolution;

export function selectKeptD20(
  naturalResults: readonly number[],
  resolution: DicePoolResolution,
): number;
```

Mapping is explicit and contains no user preference:

- normal -> `resolveDicePool(0, 0)`
- advantage -> `resolveDicePool(1, 0)`
- disadvantage -> `resolveDicePool(0, 1)`
- superAdvantage -> `resolveDicePool(2, 0)`

`selectKeptD20` validates result count and values 1..20. For `single`, exactly one result is required. For `highest`/`lowest`, result count must equal `dieCount`.

Rule source: `Pivot_Fantasy_Beta.docx — Core Rules` and existing `src/rules/d20-roll.ts` rule reference. Attack natural 20/1: `Pivot_Fantasy_Beta.docx — Combat`.

## 5. Foundry integration

Keep integration in/near `src/sheets/character-sheet.ts`.

- Replace the direct one-formula d20 path for ability/save/skill/initiative/weapon attack with one d20-roll action that asks for Roll Mode.
- The Foundry layer may construct the v13 `Roll` expression required to obtain all natural d20 results, but kept-die selection semantics must remain in `src/rules/`.
- Do not introduce hooks or settings.
- Damage and magic-ability formula rolls retain current behavior in this slice.
- Chat flavor/content must be constructed from localized text and numeric rule outputs. Do not inject user HTML.
- Weapon attacks call `applyAttackCrit` using the **kept natural d20**, never the modified total.

## 6. UI and localization

Existing controls change behavior only; tab layout stays unchanged.

Add localization keys at minimum:

- `PIVOT.RollDialog.Title`
- `PIVOT.RollMode.Normal`
- `PIVOT.RollMode.Advantage`
- `PIVOT.RollMode.Disadvantage`
- `PIVOT.RollMode.SuperAdvantage`
- `PIVOT.RollDialog.Roll`
- `PIVOT.RollDialog.Cancel`
- `PIVOT.Chat.KeptD20`
- `PIVOT.Chat.Modifier`
- `PIVOT.Chat.Total`
- `PIVOT.Chat.AutoHit`
- `PIVOT.Chat.AutoMiss`

Each mode control has a visible text label and keyboard-operable form control. Do not encode mode solely by color/icon.

## 7. Tests

Vitest pure-rule cases:

- each RollMode maps to the expected pool resolution;
- highest/lowest/single selection;
- super-advantage with two dice selects highest;
- invalid die values, wrong result counts, empty arrays throw;
- attack crit uses kept natural 20/1, not total.

Sheet/context unit tests without Foundry globals:

- action metadata for all existing d20 roll buttons resolves correct modifier and kind;
- damage/magic formula paths are unchanged.

Manual Foundry v13 smoke:

- each d20 button opens the prompt;
- cancel posts nothing;
- all four modes visibly roll/keep correctly;
- chat includes kept die/modifier/total;
- weapon natural 20/1 shows auto hit/miss;
- no Actor source fields change.

Run `npm run verify`.

## 8. Files likely to change

- `src/rules/d20-roll.ts`
- `src/sheets/character-sheet.ts`
- `templates/actors/character-sheet.hbs` only if action metadata/labels need adjustment
- `lang/en.json`
- `tests/rules/d20-roll.test.ts`
- `tests/sheets/character-sheet-context.test.ts` or current equivalent

## 9. Risks, security, open rules questions

Risk: Foundry dice-expression result extraction differs by API shape. Coding agent must confirm v13 public `Roll` result access and must not use v14-only APIs.

Security: no user-supplied HTML; numeric modifiers come from existing model. Magic formula evaluation is deliberately unchanged and remains a separate security concern.

Open rules questions: none blocking this slice. Automated counting/cancellation of multiple situational advantage sources is not part of this UI-only slice.

## SDD Readiness

**Status: READY**

### Unresolved Decisions

None significant. The four-choice prompt is the approved specification behavior for this slice; later automated source discovery may replace or augment it through a new spec.

### Traceability

FR-001, FR-002; Character, Roll Mode, Roll Outcome.

### Testability

Main flow, cancel alternative, attack natural-result branch, no-persistence postcondition, and pure rule edges are testable.

### Assumptions

Existing `resolveDicePool` and `applyAttackCrit` correctly reflect the inspected Pivot rules and remain source-of-truth helpers.
