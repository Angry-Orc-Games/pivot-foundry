# Damage, Healing, and Survival

Use the Character sheet’s existing Core tab. Set maximum HP before play. Current HP and death-save counters are managed by the survival controls.

## Roll and Apply

1. Choose **Damage / Healing Roll**, or use a weapon’s damage button.
2. Enter an additive formula such as `2d6+3`; select Damage or Healing. Select **Critical Damage** or **Enhanced Exploding** when the applicable rule allows it. The system does not decide feat eligibility.
3. Roll. Damage and healing dice explode on their maximum; Enhanced also explodes on 1. Critical Damage doubles the initial dice and adds flat modifiers once. Chat shows each chain.
4. Choose **Preview Application** on the chat card. Choose the Character recipients explicitly; the source character is checked initially, while targeted or controlled Characters are available as additional choices.
5. The GM may adjust the amount after resolving resistance, vulnerability, and other reductions. Review the amount and recipients, then confirm.

Unsupported formulas offer an explicit ordinary roll without modifying the original Item. Ordinary rolls do not receive automated application controls. A cancelled or incomplete exploding roll has no applicable total. Chat follows Foundry’s selected public, GM, blind, or self roll mode.

## Temporary HP

Choose **Temporary HP**, enter the amount, and review the recipients. When an existing buffer is present, choose **Keep Existing** or **Replace**; the amounts never add together. Damage uses the buffer first. Healing does not restore it, and gaining it at zero HP does not revive or stabilize a character.

**Clear Temporary HP (Manual Long Rest)** clears only that buffer after confirmation. **Recover Pool (Long Rest)** remains Pool-only. Neither button performs a complete rest.

## Dying, Stable, and Dead

At zero HP, use **Roll Death Save** when the displayed state is Dying. Choose the existing d20 roll mode when relevant; no ability modifier is added. A result of 10 or more succeeds, a natural 1 adds two failures, and a natural 20 restores 1 HP. Three successes stabilize and reset counters; three failures mean death.

Stable and dead characters cannot make further death saves. Damage at zero HP and massive damage apply their survival consequences. Actual healing resets counters; healing never resurrects the dead.

The GM’s **Survival Correction / Stabilize** control handles stabilization after an externally resolved Medicine check and explicit corrections. Legacy zero-HP characters display **GM confirmation required** until the GM chooses the appropriate state. Migration preserves their existing HP and counters.

Unconsciousness, injury exhaustion after survival, Medicine checks, timed recovery, other condition effects, and full rest recovery remain manual. The sheet/chat reminders identify these responsibilities.

## Failed Applications and Concurrent Play

Application results are reported per Character. A successful update is not repeated if its chat report fails. If an update fails or its outcome is uncertain, inspect the character before making a new application; the system does not automatically retry it. The same chat application is protected against repeat clicks in the current client.

Coordinate HP edits across clients. Local duplicate/busy guards are not a cross-client transaction service. The implementation rechecks permissions, source chat, and current state, but it does not introduce GM sockets or distributed locks.
