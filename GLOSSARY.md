# Pivot Fantasy

Game-system language for Pivot Fantasy on Foundry VTT: the rules a Character lives by and the play actions that change them.

## Survival

**Survival state**:
A Character's current HP, maximum HP, Temporary HP, death-save successes and failures, and Survival status, taken together.
_Avoid_: health data, HP block

**Survival status**:
Where a Character stands between life and death: Conscious, Dying, Stable, Dead, or Unconfirmed.
_Avoid_: death state, condition

**Conscious**:
The Survival status of a Character who is up and acting. Stored as "alive".
_Avoid_: Alive (in player-facing text), healthy

**Unconfirmed**:
The Survival status of a legacy Character whose state the GM has not yet confirmed; no survival action applies until a Survival correction resolves it.
_Avoid_: unknown, legacy status

**Effective survival state**:
The Survival state after a stale HP / status pairing is aligned, for example a Character recorded Conscious at 0 HP is effectively Dying. Every display, status icon, and Survival transaction works from it.
_Avoid_: display state, reconciled state, normalized state

**Survival transaction**:
One play action that changes a Character's Survival state (damage, healing, Temporary HP, a death save, a Survival correction, clearing Temporary HP, or a rest), taken as a whole from the moment it starts until its single write.
_Avoid_: health transaction, HP update, health application

**Survival correction**:
A GM's explicit override of a Character's Survival state, such as stabilizing after an externally resolved Medicine check.
_Avoid_: GM fix, manual edit
