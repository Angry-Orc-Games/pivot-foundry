# Manual Testing Guide: Token Status Effects

This document describes the manual testing procedure for Milestone 3 token status effects in Foundry v14.

## Prerequisites

1. Install the built `system.zip` into a Foundry v14 world
2. Create a test Character Actor with:
   - HP: 10/10
   - Level 1
   - Constitution 14 (+2 mod)

## Test Cases

### TC-1: M2 Regression - Death State System Still Works

**Purpose**: Verify Milestone 2 functionality is not broken

1. Apply 10 damage to reduce Character to 0 HP
2. **Expected**: Character becomes Dying, death save counters reset
3. Roll death saves (or use GM correction)
4. **Expected**: Natural 20 recovers to 1 HP, 3 failures → Dead, 3 successes → Stable
5. Apply healing to a Stable Character
6. **Expected**: Returns to Conscious (HP > 0)

**Success**: All M2 death state transitions work unchanged

---

### TC-2: Unconscious Effect at 0 HP (Dying)

**Purpose**: Verify Unconscious token effect appears when Dying

1. Apply enough damage to reduce Character to 0 HP
2. **Expected**:
   - Character sheet shows Dying status
   - Token displays Unconscious overlay/effect
   - Effect icon appears on token

**Evidence**: Screenshot showing token with Unconscious effect at 0 HP Dying

---

### TC-3: Unconscious Effect at 0 HP (Stable)

**Purpose**: Verify Unconscious persists when stabilized

1. From TC-2 Dying state, use GM Correction to set status to Stable
2. **Expected**:
   - Character sheet shows Stable status
   - Token still displays Unconscious overlay
   - HP remains 0

**Evidence**: Screenshot showing token with Unconscious effect at 0 HP Stable

---

### TC-4: Player Cannot Remove Unconscious as Cheat

**Purpose**: Verify system-managed effects cannot be manually cleared

1. As a **player** (not GM), select the Dying/Stable Character token
2. Attempt to remove the Unconscious effect using Foundry's effect controls
3. **Expected**:
   - Either the effect cannot be removed, OR
   - If removed, it immediately reappears on next state check

**Evidence**: Screenshot or description of player inability to clear effect

---

### TC-5: Unconscious Removed on Recovery (HP > 0)

**Purpose**: Verify Unconscious is auto-removed when healing to conscious

1. From TC-3 Stable state (0 HP with Unconscious)
2. Apply 5 healing (or any amount > 0)
3. **Expected**:
   - Character HP increases to 5
   - Character sheet shows Conscious/Alive status
   - Unconscious effect automatically removed from token
   - Token no longer shows overlay

**Evidence**: Screenshot showing token without Unconscious effect at HP > 0

---

### TC-6: Dead Effect Replaces Unconscious (Not Both)

**Purpose**: Verify Dead replaces Unconscious when Character dies

**Method A - Death Saves:**

1. From Dying state, roll death saves until 3 failures
2. **Expected**:
   - Character sheet shows Dead status
   - Token shows Dead overlay/skull icon
   - Unconscious effect is gone (not both effects)

**Method B - Massive Damage:**

1. From full HP (10), apply 20+ damage (>= max HP)
2. **Expected**: Character dies instantly, Dead effect shown (not Unconscious)

**Evidence**: Screenshot showing token with Dead effect (no Unconscious) when Dead

---

### TC-7: Dead Effect Persists, Cannot be Cleared

**Purpose**: Verify Dead is permanent until GM intervention

1. From TC-6 Dead state
2. As player, attempt to remove Dead effect
3. **Expected**: Cannot remove Dead effect manually
4. Try healing while Dead
5. **Expected**: Healing blocked (M2 rule: healing cannot resurrect)
6. Only GM Correction can change Dead status

**Evidence**: Confirm Dead effect remains until GM explicitly changes state

---

## Acceptance Criteria

All test cases must pass:

- ✅ M2 death state system still works (TC-1)
- ✅ Unconscious shown at 0 HP Dying (TC-2)
- ✅ Unconscious shown at 0 HP Stable (TC-3)
- ✅ Players cannot cheat by clearing Unconscious (TC-4)
- ✅ Unconscious auto-removed when HP > 0 (TC-5)
- ✅ Dead replaces Unconscious, not both (TC-6)
- ✅ Dead persists until GM correction (TC-7)

## Evidence Collection

For each test case, capture:

1. Screenshot of token showing effect overlay
2. Screenshot of character sheet showing survival status
3. Console log excerpt (if applicable)

## Notes

- Effects use Foundry core status IDs: `unconscious` and `dead`
- Token overlays should match Foundry's default appearance
- System automatically syncs effects on every HP or death status change
- No console errors should appear during normal operation
