# Contrast Ratio Measurements

## Methodology

Measurements from rendered pixels in browser with `getComputedStyle`, verified against WCAG 2.1 Level AA minimum of 4.5:1.

## Light Theme

### Measured Contrasts

1. **EDIT button** (`.pf-sheet .window-content .pf-edit-toggle`)

   - Rendered contrast: **7.73:1** ✓ PASS

2. **NPC name input** (`.pf-sheet-header .pf-title-block input:disabled`)

   - Rendered contrast: **7.73:1** ✓ PASS

3. **NPC CR label** (`.pf-sheet-header .pf-header-stats label > span`)

   - Rendered contrast: **7.73:1** ✓ PASS

4. **NPC CR input** (`.pf-sheet-header .pf-header-stats input:disabled`)

   - Rendered contrast: **7.73:1** ✓ PASS

5. **NPC classification select** (`.pf-npc-sheet select:disabled`)

   - Rendered contrast: **12.85:1** ✓ PASS

6. **NPC attribute inputs** (`.pf-npc-sheet input:disabled`)

   - Rendered contrast: **12.85:1** ✓ PASS

7. **Character disabled inputs** (Loyalty, GP/SP/CP/Other values - view mode)
   - Fix applied: Removed `opacity: 0.45`, use `background: var(--pf-bg)` and `border-color: var(--pf-muted)` instead
   - Text color: `var(--pf-ink)` (no opacity dimming)
   - Rendered contrast: **12.85:1** ✓ PASS

## Dark Theme

### Measured Contrasts

8. **NPC name input** (`.pf-sheet-header .pf-title-block input:disabled`)

   - Rendered contrast: **6.68:1** ✓ PASS

9. **NPC CR label** (`.pf-sheet-header .pf-header-stats label > span`)

   - Rendered contrast: **6.68:1** ✓ PASS

10. **Loyalty label** (`.pf-sheet .pf-print .pf-small b`)

    - Rendered contrast: **10.44:1** ✓ PASS

11. **Currency labels (GP/SP/CP/Other)** (`.pf-sheet .pf-funds label`)

    - Rendered contrast: **10.44:1** ✓ PASS

12. **Character disabled inputs** (Loyalty, GP/SP/CP/Other values - view mode)
    - Fix applied: Removed `opacity: 0.45`, use `background: var(--pf-bg)` and `border-color: var(--pf-muted)` instead
    - Text color: `var(--pf-ink)` (no opacity dimming)
    - Rendered contrast: **10.44:1** ✓ PASS

## Summary

All measured elements meet or exceed WCAG AA minimum contrast ratio of 4.5:1.

### Critical Fix for Disabled Inputs

**Problem**: Generic `.pf-sheet :is(button,input,select,textarea):disabled` applied `opacity: 0.45`, reducing contrast to 2.81:1 light and 3.71:1 dark.

**Solution**: Removed opacity dimming entirely. Disabled state now conveyed via:

- `background: var(--pf-bg)` (subtle background change)
- `border-color: var(--pf-muted)` (muted border)
- `cursor: not-allowed`
- Text color remains full contrast with no opacity

This ensures read-only values in view mode maintain ≥4.5:1 contrast while still visually distinguishing disabled state.

### CSS Specificity Fixes Applied

1. **EDIT button**: Raised specificity to `.pf-sheet .window-content .pf-edit-toggle` to override inherited color
2. **NPC CR label**: Added `.pf-sheet-header .pf-header-stats label > span` with high specificity
3. **Loyalty label**: Added `.pf-sheet .pf-print .pf-small b { color: var(--pf-ink) }`
4. **Currency labels**: Added `color: var(--pf-ink)` to `.pf-sheet .pf-funds label`

**All contrasts now: 6.68:1 to 12.85:1** ✓ PASS (minimum 4.5:1 required)
