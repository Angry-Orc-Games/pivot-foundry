# Milestone 2 Acceptance Record

Verified 15 September 2026. The approved attacks, damage, and survival slice is implemented. This is development acceptance, not customer acceptance or approval of the full release scope.

## Environment

- Foundry VTT 13.351, system `pivot-fantasy`, code through `11ab347`.
- Isolated `codex/milestone-2-survival` worktree; [PR #21](https://github.com/Angry-Orc-Games/pivot-foundry/pull/21).
- Loopback-only port 30001, named container `pivot-foundry-milestone-2-qa`. Existing-world tests used a private copy of stopped sandbox data. Fresh-world tests used a newly created empty world.
- System assets were extracted from `system.zip`, with no development source mount. Served bundle SHA-256 matched the package build: `b64d7744a6128da028ffd43347c9c53d879c3a8fcc001b9046b33e9a4089fb60`.
- Original sandbox data and canonical checkout's uncommitted Docker work were preserved. No production deployment or release tag.

## Automated Gates

- `npm run verify`: 157 tests, lint, formatting, type checking, build and dependency audit pass; zero reported audit vulnerabilities.
- `npm run package:system`: passes.
- Tests cover recursive chains, critical/enhanced options, invalid/unsupported formulas, interruption, HP/temp-HP boundaries, massive damage, death-save results 1/9/10/20 and third success/failure, migration preservation/idempotence, stale permissions/chat data, duplicate/overlapping actions, partial failures, and chat failure after a successful write.
- Independent specification and code/security reviews completed. Findings about privacy, formula validation, migration defaults/token inheritance, stale previews and uncertain writes were addressed with regression coverage.
- GitHub Verify (Node 20/22) and Package Foundry System passed at `11ab347` ([run](https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/34988509118)); consult PR checks for the final documentation/token-label revision.

## Foundry Scenarios

The following passed through the actual v13 sheet/chat UI, with Foundry document APIs used to prepare isolated fixtures. Natural 1 and 20 death-save cases used controlled minimum/maximum dice evaluation; exploding-dice examples used ordinary random rolls. UI scenario evidence was run against the packaged build from `45a8007`; subsequent commit `11ab347` contains documentation updates only.

- [x] Existing-world migration preserves HP, counters and embedded weapon Items; ambiguous zero HP requests confirmation. Unlinked zero-HP tokens retain their own state despite an alive base Actor. Reload leaves migrated state unchanged.
- [x] Fresh character creation initializes version 1 and conscious/dying defaults without a legacy-confirmation warning. Set maximum HP before rolling death saves on a blank character.
- [x] Weapon attack and damage buttons work. Generic critical damage doubled initial dice; enhanced healing and recursive chains appeared in chat.
- [x] Unsupported `1d6+@attributes.hp.max` offered an explicit ordinary roll, resolved Actor data, and had no automated Apply action. Weapon damage rolling preserved the stored Item formula.
- [x] Cancellation during a long exploding roll produced an incomplete card without Apply. Cancelling an HP preview changed nothing.
- [x] Damage/healing preview showed amount and recipients. Editing the source chat amount while a preview was open invalidated the application.
- [x] Temp HP offered keep/replace, absorbed damage before actual HP, and did not revive at zero. Explicit manual clearing changed only temp HP. Healing capped at maximum.
- [x] Natural 1 reached death at three failures; natural 20 restored 1 HP/reset counters. GM stabilization/reset and damage ending stabilization worked. Massive damage caused death; healing did not resurrect.
- [x] GM correction and manual-rule reminders were visible and usable. Stable/dead death-save restrictions are additionally covered by automated rules/runtime tests.
- [x] A separate player session updated its owned Character. Unowned target previews disclosed no HP, and revoked ownership during confirmation prevented the update. Player amount adjustment was unavailable.
- [x] Two linked tokens resolved to one update; two unlinked tokens updated independently. Final previews display distinct token names plus the base Actor name.
- [x] Public, GM, blind and self chat visibility matched the selected roll mode.
- [x] Fresh packaged world: HP 10, temp 3, damage 5 → HP 8/temp 0; damage 8 → dying; healing 4 → conscious. Reload retained HP 4 and cleared counters.

Private local QA artifacts are retained outside the repository under `~/.codex/tmp/pivot-milestone-2-qa/evidence/`: `migration-fixed.json`, `survival-scenarios.json`, `player-permissions.json`, `edge-scenarios.json`, `weapon-and-labels.json`, `fresh-world.json`, `package-proof.json`, and UI screenshots. These are test fixtures, not production records. Automated failure injection covers duplicate clicks, partial Actor failures and chat-report failure; those failure modes are not claimed as naturally occurring server faults.

## Simultaneous Clients and Manual Boundaries

GM/player sessions verified permissions and permission changes across clients. Simultaneous HP writes are **not** certified as atomic: same-client duplicate/busy guards are not cross-client transaction locks. Users must coordinate concurrent edits; the system never automatically retries failed or uncertain writes.

Dice eligibility and critical/enhanced choices are explicit. Resistance/vulnerability, condition effects, injury exhaustion, Medicine checks, timed recovery, and full rest automation remain manual. Pool recovery is Pool-only. These limits are described in the [player/GM guide](survival.md) and contextual sheet/chat reminders. Roadmap step 1, integrated release acceptance, production deployment and publication remain open.
