import { describe, expect, it } from "vitest";

import { abilityModifier, proficiencyBonusForLevel } from "../../src/rules/modifiers";

describe("abilityModifier", () => {
  // Table verified at rulebook line 761-770.
  it.each([
    [1, -5],
    [2, -4],
    [3, -4],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [13, 1],
    [15, 2],
    [18, 4],
    [19, 4],
    [20, 5],
    [30, 10],
  ])("score %i -> modifier %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

describe("proficiencyBonusForLevel", () => {
  // Table verified at rulebook line 12429-12450 (Appendix B).
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [16, 5],
    [17, 6],
    [20, 6],
  ])("level %i -> proficiency bonus +%i", (level, expected) => {
    expect(proficiencyBonusForLevel(level)).toBe(expected);
  });
});
