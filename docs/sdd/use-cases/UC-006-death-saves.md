# UC-006 — Resolve Death Saves

**Status:** NOT READY  
**Primary Actor:** Player  
**Goal:** Automate death-save rolls, thresholds, counters, and consequences only from verified Pivot rules.  
**Linked Requirements:** FR-007, NFR-001, NFR-003, NFR-004, C-003  
**Relevant Entities:** Character, Roll Outcome

## 1. Title, goal, non-goals

Use existing `attributes.deathSaves.successes/failures` as source. Do not redesign the Combat tab. Non-goals: NPC death handling, house rules, stabilization effects not present in source.

## 2. User-facing behavior

Current checkbox/counter editing remains until this use case becomes READY.

After verification, the intended surface is one `Roll Death Save` action that:

- rolls according to the exact Pivot rule;
- updates counters/consequences atomically;
- posts an explanatory localized chat result;
- stops/changes availability when the verified terminal condition is reached.

GM can observe and, where currently permitted, manually correct counters.

## 3. Data model changes

No new fields unless verified rules require a durable state not representable by existing HP and 0..3 counters.

Any new durable state must be specified before code and assessed for migration.

## 4. Pure rules API

Reserved boundary:

```ts
export interface DeathSaveState {
  successes: number;
  failures: number;
}

export interface DeathSaveResolution {
  next: DeathSaveState;
  outcome: "continue" | "stabilized" | "dead" | string;
}

export function resolveDeathSave(
  state: DeathSaveState,
  naturalD20: number,
): DeathSaveResolution;
```

The `outcome` union must be narrowed to verified canonical states before implementation.

Rule source: `Pivot_Fantasy_Beta.docx — Combat`.

## 5. Foundry integration

After rules approval, use UC-001 roll infrastructure; update only verified source fields; post chat. Do not add hooks/sockets unless consequences require broader document coordination.

## 6. UI and localization

Combat tab: add a labeled roll button adjacent to existing death-save counters. Terminal state must have text and accessible state, not only color.

Keys are defined only after canonical outcome terms are confirmed.

## 7. Tests

Must cover every threshold and natural-result special case in the source, counter caps, terminal behavior, and no extra update after terminal state.

Manual Foundry v13: counter updates, chat, permissions, reload persistence.

## 8. Files likely to change

- `src/rules/death-saves.ts`
- `src/sheets/character-sheet.ts`
- `templates/actors/character-sheet.hbs`
- `lang/en.json`
- `tests/rules/death-saves.test.ts`

## 9. Risks, security, open rules questions

Blocking: exact thresholds, natural 1/20 effects if any, stabilization/death consequences, counter reset timing, interaction with healing/rest.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

All exact death-save rules.

### Traceability

FR-007; Character, Roll Outcome.

### Testability

Cannot finalize expected outcomes until rule extraction.

### Assumptions

None.
