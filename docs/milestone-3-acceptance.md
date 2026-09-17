# Milestone 3 Acceptance Test Notes

## Manual Testing for Foundry v14

This document describes the acceptance test procedures for Milestone 3 (Initiative and Rest) after installing the `system.zip` package into a Foundry v14 world.

### Prerequisites

1. Install the built `system.zip` into a Foundry v14 world named `pivot-test`
2. Create a Character Actor with:
   - Level 1, Constitution 14 (+2 mod)
   - Pool: 3/4
   - HP: 5/10
   - Hit Die: d8
   - Awakened: true
   - Magic Ability: Intelligence 16 (+3 mod)
   - MP: 2/5

## AC-1: Initiative into Live Combat (UC-003)

### Test Case: One Combatant → Updates Tracker

1. **Setup:**
   - GM creates a combat encounter
   - Add the test Character as a combatant (once)
   - Start combat

2. **Action:**
   - Player opens Character sheet
   - Click Initiative roll button on Core tab

3. **Expected:**
   - DialogV2 prompts for roll mode (Normal/Advantage/Disadvantage/Super-Advantage)
   - After selecting and rolling:
     - Chat posts initiative result with kept d20 and modifier
     - Combat tracker updates the Character's combatant initiative
     - No error console output
   - **Success criteria:** Initiative value visible in tracker matches chat total

### Test Case: No Combat → Chat Warning

1. **Setup:** No active combat

2. **Action:** Click Initiative roll button

3. **Expected:**
   - Chat posts initiative result
   - UI notification warns: "Initiative was not added to the tracker because there is no active combat."
   - No uncaught errors

### Test Case: No Combatant → Chat Warning

1. **Setup:**
   - Combat active
   - Character **not** in combat

2. **Action:** Click Initiative roll button

3. **Expected:**
   - Chat posts initiative result
   - UI notification warns: "Initiative was not added to the tracker because this character is not in the active combat."

### Test Case: Multiple Combatants → Chat Warning (Ambiguous)

1. **Setup:**
   - Combat active
   - Add the **same** Character Actor as a combatant **twice**

2. **Action:** Click Initiative roll button

3. **Expected:**
   - Chat posts initiative result
   - UI notification warns: "Initiative was not added to the tracker because this character has more than one combatant in the active combat."
   - Tracker unchanged (ambiguous target)

## AC-2: Short Rest

### Test Case: Spend Pool Dice with MP Recovery

1. **Setup:**
   - Character: Pool 3, HP 5/10, MP 2/5, awakened, Int 16 (+3), Con 14 (+2), Hit Die d8

2. **Action:**
   - Click "Short Rest" button on Core tab
   - Dialog: set "Pool dice to spend" = 2
   - Confirm

3. **Expected:**
   - System rolls 2× exploding d8 + 2 (Con mod)
   - Progress dialog shows dice rolling
   - Pool reduced to 1 (spent 2)
   - HP increased by sum of dice results (capped at max 10)
   - MP increased to 5 (recovered +3, capped at max)
   - Chat posts:
     - Summary: "Short Rest Complete • Pool spent: 2 • HP healed: [total] • MP recovered: 3"
     - Dice detail: "d8: [rolls] +2 = [subtotal]; d8: [rolls] +2 = [subtotal]"
   - No console errors

**Success criteria:** HP, Pool, MP updated correctly; exploding dice visible in chat; no uncaught errors.

### Test Case: Not Awakened → No MP

1. **Setup:** Character awakened = false, Pool 2, HP 6/10, Con +2, Hit Die d8

2. **Action:** Short Rest, spend 1 Pool

3. **Expected:**
   - System rolls 1× exploding d8 + 2
   - HP increased by roll result (capped)
   - Pool spent
   - MP unchanged (not awakened)
   - Chat summary omits "MP recovered"

### Test Case: Pool < 1 → Blocked

1. **Setup:** Character Pool 0

2. **Action:** Click Short Rest

3. **Expected:**
   - UI notification: "Short rest requires at least 1 Pool."
   - No dialog, no change

## AC-3: Long Rest

### Test Case: Safe/Comfortable → Full Recovery

1. **Setup:**
   - Character: HP 5/10, Pool 1/4, MP 2/5, awakened

2. **Action:**
   - Click "Long Rest" button
   - Dialog: check "Safe and comfortable environment"
   - Confirm

3. **Expected:**
   - HP → 10 (full)
   - Pool → 3 (recovered floor(4/2) = 2, min 1)
   - MP → 5 (full, safe rest)
   - Chat: "Long Rest Complete • HP recovered: 5 • Pool recovered: 2 • MP recovered: 3"

### Test Case: Not Safe, Control Magic DC 15 Success → Full MP

1. **Setup:** HP 8/10, Pool 2/4, MP 1/5, awakened

2. **Action:**
   - Long Rest
   - Dialog: **uncheck** "Safe and comfortable"
   - Control Magic prompt: enter 15 (or higher)
   - Confirm

3. **Expected:**
   - HP → 10
   - Pool → 4 (recovered 2)
   - MP → 5 (full, Control Magic success)
   - Chat shows full MP recovery

### Test Case: Not Safe, Control Magic Fails → Half MP

1. **Setup:** HP 7/10, Pool 1/4, MP 0/5, awakened

2. **Action:**
   - Long Rest
   - Uncheck safe
   - Control Magic prompt: enter 14 (fail)
   - Confirm

3. **Expected:**
   - HP → 10
   - Pool → 3
   - MP → 2 (floor(5/2) = 2)
   - Chat shows partial MP recovery

### Test Case: Not Awakened → No MP

1. **Setup:** awakened = false, MP 0/5

2. **Action:** Long Rest (safe checked)

3. **Expected:**
   - HP and Pool recover normally
   - MP unchanged (not awakened)
   - Chat omits "MP recovered"

## AC-4: Blocking Console Errors (Must-Ship Gate)

**Acceptance criteria:** No uncaught exceptions or failed Actor updates on the primary rest or initiative paths.

### Test Procedure:

1. Open browser DevTools Console (F12)
2. Execute all above test cases
3. Filter console for "error" or "Uncaught"

**Expected:** Only harmless Foundry core noise (if any). No pivot-fantasy errors, no Actor update rejections.

**Failure:** Any pivot-fantasy exception or Actor update failure fails the gate.

## Existing Milestone 2 Regression Check

**Quick smoke:** Damage roll dialog, death saves, HP application, temp HP still work as before.

## Notes for Manual Tester (Modi)

- Initiative combatant selection (AC-1) already implemented in Milestone 2 PR #16, merged to main. This milestone adds rest mechanics (AC-2, AC-3).
- **Short Rest now system-applied:** Hit Dice roll exploding HD + Con mod in-system, HP applied automatically. Dice chains visible in chat.
- Long Rest "Recover Pool" button (old) still exists on the sheet; it recovers half Pool only. New "Long Rest" button does full HP + Pool + MP.
- Control Magic DC 15 is a d20 roll player makes externally, entering the total in the dialog.
- Existing console noise from Foundry core is tolerated; pivot-fantasy errors are not.

## Expected Outcomes

All test cases pass with no blocking errors → **Milestone 3 acceptance gate passed.**
