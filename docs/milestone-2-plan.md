# Milestone 2 — Attacks, Damage, and Survival

Approved implementation scope: core survival loop in Foundry v13. Explicit Critical Damage and Enhanced Exploding controls; no automatic content eligibility. Implement in sequential, tested slices: damage rolls, HP transactions, death saves. No production deployment or publication.

## Verified Rules (Combat)

The relevant passages match in Pivot_Fantasy_Beta.docx and both local Beta Final manuscripts (checked 15 September 2026).

- Damage/healing dice explode recursively on their maximum. Enhanced Exploding also triggers on 1. Critical damage doubles initial dice, not flat modifiers; modifiers apply once, final amount minimum zero. No silent explosion cap. Reject d1 and enhanced d2; interrupted rolls are incomplete and cannot be applied.
- Support additive standard dice and integer modifiers. Preserve unsupported formulas with explicit ordinary-roll fallback; never silently transform them.
- Temp HP absorbs damage before HP, never stacks, and replacement requires Keep Existing/Replace choice. Healing restores actual HP only, capped at max. Temp HP at zero never revives/stabilizes.
- Massive damage: after temp absorption, damage reducing HP to zero kills if remainder >= HP max. Damage taken while already at zero causes one failure (two if critical), ends stability, and kills if damage >= max. Follow the source's any-damage wording even when temp HP absorbs the amount.
- Death saves use a kept d20 without ability modifier: 10+ success, otherwise failure; natural 1 two failures; natural 20 regains 1 HP. Three successes stabilize/reset counters; three failures kill. Actual HP recovery resets counters. Stable/dead cannot roll. Healing never resurrects.
- Persist stable/dead state; show conscious, dying, stable/unconscious, dead, and legacy state needing confirmation. GM correction/stabilization control. Exhaustion consequences, broader conditions, resistance/vulnerability, Medicine checks and timed recovery are manual with clear reminders. Existing Pool-only rest control must not be presented as a full rest; provide explicit temp-HP clearing for manual long-rest handling.

## Integration and Safety

Pure rules under src/rules; thin runtime adapters, existing sheet. Generic damage/healing dialog and weapon damage action; preserve visible roll chains. Explicit preview of amount and Character targets. Revalidate permissions, current state and amount before one combined update per actor. Deduplicate linked Actor targets, retain distinct unlinked tokens. Per-target failures, same-client duplicate guard; no automatic retry on uncertain write. Revalidate chat data from message flags, not arbitrary DOM IDs/amounts. GM adjusted amount for already resolved damage reductions. Chat failure after a successful update must not prompt a second application.

Named additive migrations preserve HP/counters/items, flag ambiguous legacy zero HP for GM confirmation, run idempotently on fresh/current worlds. No competing actor model/network API. Leave canonical checkout dirty Docker edits alone.

## Acceptance Gates

- [x] UC-004 through UC-006 rules updated before code
- [x] Exploding damage and healing tests and UI
- [x] HP transactions, permissions and partial failures
- [x] Death saves and survival transitions
- [x] Named migrations and reload persistence
- [x] npm run verify and npm run package:system
- [x] Independent spec and code/security reviews
- [x] CI on branch/PR passes
- [x] Foundry v13 GM/player demonstration, fresh and upgrade worlds
- [x] Documentation accurately records manual scope and evidence

Milestone is complete only with both automated checks and Foundry acceptance. Track limitations honestly. Do not mark roadmap step 1 complete.

Completed development acceptance is recorded in [Milestone 2 acceptance](milestone-2-acceptance.md). Final branch CI is tracked on PR #21.
