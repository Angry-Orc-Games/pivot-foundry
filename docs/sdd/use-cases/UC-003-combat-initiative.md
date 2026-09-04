# UC-003 — Roll Initiative into Foundry Combat

**Status:** READY WITH PROPOSED UX DECISION  
**Primary Actor:** Player  
**Goal:** Use the existing derived initiative roll and place its total on the Character's existing Foundry combatant.  
**Linked Requirements:** FR-004, NFR-002, NFR-003, NFR-004, C-003  
**Relevant Entities:** Character, Roll Outcome, Combatant Initiative

## 1. Title, goal, non-goals

Integrate the existing initiative button with Foundry v13 combat state without adding initiative source fields.

Non-goals: automatic combat creation; automatic token/combatant creation; turn-order house rules; tie breaking; reroll restrictions; NPC initiative.

## 2. User-facing behavior

1. Player uses the existing initiative roll control and chooses a Roll Mode using UC-001.
2. System rolls derived initiative.
3. If the Character has exactly one combatant in the active combat, system sets that combatant's initiative to the rolled total and posts/retains the chat roll.
4. If there is no active combat or no matching combatant, system posts the roll normally and shows a localized warning that initiative was not added to the tracker.
5. If more than one matching combatant exists for the Actor in the active combat, system does not guess. It warns the user and does not update any combatant.
6. Rerolling initiative updates that one existing combatant with the new total.

**Proposed product decision:** this slice does not auto-create combatants. This keeps the Foundry surface small and avoids ambiguity when an Actor has multiple tokens.

## 3. Data model changes

None. Initiative remains derived; combat initiative is Foundry combat state.

Migration impact: none.

## 4. Pure rules API

No new game math beyond UC-001 and existing derived initiative.

Optional pure selector helper, using plain data only:

```ts
export function selectInitiativeCombatant(
  actorId: string,
  combatants: readonly { id: string; actorId: string | null }[],
): { kind: "one"; combatantId: string } | { kind: "none" } | { kind: "ambiguous" };
```

This helper contains no Foundry globals.

Rule source for initiative modifier: existing repository derived rules; Pivot sections `Core Rules` / `Combat`.

## 5. Foundry integration

- Initiative action remains in `src/sheets/character-sheet.ts`.
- After UC-001 evaluates the roll, locate the active combat through **Foundry v13 public APIs**.
- Match combatants by Actor document identity exposed by v13 public combatant data.
- Update exactly one matching combatant using its public document update API.
- No hook required.
- No v14 initiative APIs may be assumed; coding agent must inspect v13 runtime/types.
- If chat roll succeeds but tracker update fails, retain the chat result and show a localized error; do not reroll automatically.

## 6. UI and localization

No layout change. Add localized warnings/errors:

- `PIVOT.Combat.NoActiveCombat`
- `PIVOT.Combat.NoCombatant`
- `PIVOT.Combat.MultipleCombatants`
- `PIVOT.Combat.InitiativeUpdateFailed`

Warnings contain text, not color-only state.

## 7. Tests

Vitest:

- combatant selector: none, one, ambiguous;
- Actor IDs null/other ignored.

Sheet/integration seam tests with mocked v13-shaped objects:

- exactly one combatant receives rolled total;
- no combatant -> no update;
- ambiguous -> no update;
- update rejection does not produce second roll.

Manual Foundry v13 smoke:

- actor with one token already in combat gets initiative;
- reroll updates value;
- actor not in combat gets chat + warning;
- actor with multiple combatants gets warning and no tracker mutation;
- `npm run verify`.

## 8. Files likely to change

- `src/rules/combat.ts` or `src/rules/initiative.ts` if selector helper added
- `src/sheets/character-sheet.ts`
- `lang/en.json`
- `tests/rules/...`
- `tests/sheets/...`

## 9. Risks, security, open rules questions

Risk: matching Actor-to-combatant shape differs in Foundry v13. Confirm public v13 API; do not copy another system.

Open product decision: whether a later slice should offer explicit token/combatant selection or auto-create a combatant. That does not block the minimal behavior above if the proposed decision is accepted.

## SDD Readiness

**Status: READY WITH PROPOSED UX DECISION**

### Unresolved Decisions

Approve or reject "update an existing unique combatant only; never auto-create."

### Traceability

FR-004; Character, Combatant Initiative.

### Testability

Unique/no/ambiguous combatant paths and update failure are testable.

### Assumptions

Foundry v13 exposes sufficient public combat/combatant document APIs to find and update a combatant.
