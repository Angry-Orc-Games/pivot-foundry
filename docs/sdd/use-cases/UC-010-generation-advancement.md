# UC-010 — Automate Character Generation and Advancement

**Status:** NOT READY  
**Primary Actor:** Player  
**Goal:** Validate and apply confirmed build-point character-generation choices and advancement changes without replacing the current sheet.  
**Linked Requirements:** FR-011, FR-012, NFR-001, C-003, C-004  
**Relevant Entities:** Character, Feature, Content Record

## 1. Title, goal, non-goals

Add workflow controls around existing Character source (`buildPoints`, level, XP, progressionPoints, ability scores/primary flags, embedded option Items).

Non-goals: a separate character-builder application; deleting manual editing in the early-playable sheet; inventing point costs; enforcing two-primary cap until canon is confirmed.

## 2. User-facing behavior

Generation, after rules verification:

- Player can open a build-validation summary from the existing sheet.
- System reports spent/remaining build points and each invalid choice with an observable reason.
- System does not auto-correct or silently delete choices.
- An invalid build can remain editable but is visibly not valid for completion.

Advancement:

- when XP/level/progression rules are verified, player can preview an advancement;
- system shows resulting source changes before confirmation;
- confirmation applies only approved source fields/embedded Items;
- cancel leaves Actor unchanged.

## 3. Data model changes

Prefer existing fields. New source fields only if the rule requires a durable choice that cannot be reconstructed from current Actor source and embedded Items.

Do not persist derived "points spent" totals.

Migration impact depends on any new durable choices.

## 4. Pure rules API

Reserved boundaries:

```ts
validateCharacterBuild(input: CharacterBuildSource): BuildValidation;
calculateBuildPointSpend(input: CharacterBuildSource): number;
validatePrimaryAbilities(input: ...): ValidationResult;
calculateAdvancement(input: AdvancementSource): AdvancementPlan;
```

Exact types/rules require extraction.

Rule sources: `Pivot_Fantasy_Beta.docx — Character Generation`; `Skills`; `Feats`; `Flaws`; `Backgrounds`; advancement material in `Core Rules`/appendices as applicable.

## 5. Foundry integration

Add a small sheet action/dialog using current source and embedded Items. No new Actor type and no parallel builder state. Apply confirmed advancement as one or minimal grouped document updates.

## 6. UI and localization

Existing Core/Features tabs. Prefer a summary/dialog rather than new tab. Validation messages identify field/choice textually.

## 7. Tests

Pure tests for budget boundaries, invalid choices, primary ability cap if confirmed, advancement thresholds/point grants, and idempotent validation.

Manual v13: preview/cancel/confirm, embedded item changes, reload.

## 8. Files likely to change

- `src/rules/character-build.ts`
- `src/rules/advancement.ts`
- `src/sheets/character-sheet.ts`
- templates
- `lang/en.json`
- `tests/rules/character-build.test.ts`
- `tests/rules/advancement.test.ts`

## 9. Risks, security, open rules questions

Blocking: all build-point costs and sequencing; whether flaws refund points; default/up-to-two primary rule and exceptions; XP-to-level thresholds; progression-point grants/spend rules; respec behavior.

## SDD Readiness

**Status: NOT READY**

### Unresolved Decisions

Rules above must be verified from `Character Generation` and advancement source sections.

### Traceability

FR-011, FR-012.

### Testability

Cannot derive acceptance values until rules are extracted.

### Assumptions

No canonical cap or cost is inferred from the current sheet.
