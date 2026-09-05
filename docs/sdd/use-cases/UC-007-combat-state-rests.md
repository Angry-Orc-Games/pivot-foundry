# UC-007 — Enforce Combat State, Cover, Movement, and Rests

**Status:** NOT READY  
**Primary Actors:** Player, GM  
**Goal:** Add the next confirmed combat-state automations after attacks/HP without turning the Character sheet into an encounter engine.  
**Linked Requirements:** FR-008, FR-003, NFR-001, NFR-003, C-003, C-008  
**Relevant Entities:** Character, Combatant Initiative

## 1. Title, goal, non-goals

Scope candidates: cover, action economy, movement, conditions, and remaining rest effects. They are grouped here as a sequencing envelope but should be split into smaller implementation sub-slices once rules are extracted.

Non-goals: encounter budgets, NPC automation, bestiary, speculative status system.

## 2. User-facing behavior

No new behavior is approved yet beyond UC-002 Pool recovery.

For each sub-slice, Player sees only confirmed counters/statuses and GM can observe/manage according to Foundry permissions. No state is persisted merely because it can be computed from Actor/token/combat state.

## 3. Data model changes

Unknown. Prefer Foundry token/combat state for turn/movement/conditions where public v13 APIs provide appropriate durable state. Add Actor source only for Pivot-specific state that must survive independently and cannot be derived.

Migration impact must be assessed per new field.

## 4. Pure rules API

Candidate boundaries, not approved implementations:

```ts
resolveCover(...): ...;
calculateMovementAllowance(...): ...;
resolveActionBudget(...): ...;
resolveRestEffects(...): ...;
```

Exact signatures require rules and state vocabulary first.

Rule sources: `Pivot_Fantasy_Beta.docx — Combat`; `Core Rules`; relevant rest sections.

## 5. Foundry integration

Prefer thin combat/token hooks only after pure rules exist. Do not listen to broad hooks just to mirror Foundry state onto Actor. Public v13 APIs only.

## 6. UI and localization

Modify existing Combat/Core tabs only where an observable player decision exists. Do not add a new tab by default. Every condition/action state needs a textual label.

## 7. Tests

Each extracted rule gets pure cases before Foundry wiring. Foundry v13 smoke covers turn changes, token movement, condition display, and rest actions where applicable.

## 8. Files likely to change

- `src/rules/combat.ts`
- `src/rules/rest.ts`
- `src/sheets/character-sheet.ts`
- `templates/actors/character-sheet.hbs`
- `lang/en.json`
- `tests/rules/...`

## 9. Risks, security, open rules questions

Blocking: exact cover categories/effects; action budget; movement spending/reset; condition vocabulary/lifecycle; HP/MP/full-rest recovery; armour rest penalties; Pool recovery triggers beyond UC-002.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

Rule extraction must split this envelope into implementable use cases.

### Traceability

FR-008, FR-003.

### Testability

Not sufficient until behaviors are decomposed.

### Assumptions

None.
