import { describe, expect, it } from "vitest";

import {
  calculateArmourClass,
  calculateAttackSummary,
  calculateCharacterDerived,
  calculateManaMaximum,
  calculatePassivePerception,
  calculateSkillTotal,
  calculateTotalWeight,
} from "../../src/rules/character-derived";

describe("calculateCharacterDerived", () => {
  it("derives ability modifiers, proficiency, resources, and passive perception", () => {
    const derived = calculateCharacterDerived({
      level: 7,
      abilities: {
        str: { score: 12, primary: true },
        dex: { score: 16, primary: false },
        con: { score: 14, primary: true },
        int: { score: 10, primary: false },
        wis: { score: 15, primary: false },
        cha: { score: 8, primary: false },
      },
      skills: {
        perception: { ability: "wis", proficient: true, deepening: 1, expertise: false, bonus: 0 },
      },
      magic: { awakened: false, ability: null },
      equipment: [],
    });

    expect(derived.abilities.dex.mod).toBe(3);
    expect(derived.proficiencyBonus).toBe(3);
    expect(derived.saves.str).toBe(4);
    expect(derived.saves.dex).toBe(3);
    expect(derived.skills.perception?.total).toBe(6);
    expect(derived.passivePerception).toBe(16);
    expect(derived.pool.max).toBe(7);
    expect(derived.magic.mp.max).toBe(0);
  });
});

describe("calculateSkillTotal", () => {
  it("adds ability, proficiency, deepening, expertise, and manual bonuses", () => {
    expect(
      calculateSkillTotal({
        abilityModifier: 4,
        proficiencyBonus: 3,
        proficient: true,
        deepening: 2,
        expertise: true,
        bonus: 1,
      }),
    ).toBe(13);
  });

  it("caps skill deepening at the proficiency bonus and excludes Control Magic", () => {
    expect(
      calculateSkillTotal({
        abilityModifier: 2,
        proficiencyBonus: 3,
        proficient: true,
        deepening: 8,
        expertise: false,
        bonus: 0,
      }),
    ).toBe(8);

    expect(
      calculateSkillTotal({
        abilityModifier: 2,
        proficiencyBonus: 3,
        proficient: true,
        deepening: 8,
        expertise: false,
        bonus: 0,
        excludesDeepening: true,
      }),
    ).toBe(5);
  });
});

describe("calculatePassivePerception", () => {
  it("starts from 10 plus Perception total and applies advantage state adjustments", () => {
    expect(calculatePassivePerception({ perceptionTotal: 4 })).toBe(14);
    expect(calculatePassivePerception({ perceptionTotal: 4, mode: "advantage" })).toBe(19);
    expect(calculatePassivePerception({ perceptionTotal: 4, mode: "disadvantage" })).toBe(9);
  });
});

describe("calculateManaMaximum", () => {
  it("uses the Awakened MP formula only when a magic ability is selected", () => {
    expect(calculateManaMaximum({ awakened: false, level: 7, abilityScore: 17 })).toBe(0);
    expect(calculateManaMaximum({ awakened: true, level: 7, abilityScore: 17 })).toBe(29);
  });
});

describe("calculateArmourClass", () => {
  it("uses equipped armour, shield, helmet, dex caps, and manual bonuses", () => {
    expect(
      calculateArmourClass({
        dexterityModifier: 4,
        manualBonus: 1,
        armour: [
          { name: "Chainmail", category: "medium", acBonus: 3, equipped: true },
          { name: "Large Shield", category: "shield", acBonus: 2, equipped: true },
          { name: "Full Helmet", category: "helmet", acBonus: 1, equipped: true },
        ],
      }),
    ).toEqual({
      value: 19,
      armourWorn: "Chainmail, Large Shield, Full Helmet",
      breakdown: [
        "Base 10",
        "Dex +2",
        "Chainmail +3",
        "Large Shield +2",
        "Full Helmet +1",
        "Manual +1",
      ],
    });
  });
});

describe("calculateTotalWeight", () => {
  it("sums carried item weights by quantity", () => {
    expect(
      calculateTotalWeight([
        { weight: 2, quantity: 1, carried: true },
        { weight: 0.5, quantity: 10, carried: true },
        { weight: 50, quantity: 1, carried: false },
      ]),
    ).toBe(7);
  });
});

describe("calculateAttackSummary", () => {
  it("derives BTH and BTD from actor proficiency and weapon category", () => {
    expect(
      calculateAttackSummary({
        proficiencyBonus: 3,
        abilityModifiers: { str: 2, dex: 4, con: 1, int: 0, wis: 0, cha: -1 },
        weaponProficiencies: { bows: true },
        weapon: {
          category: "bows",
          attackAbility: "dex",
          damageAbility: null,
          attackBonus: 1,
          damageBonus: 0,
          damageFormula: "1d8",
          range: { normal: 40, long: 160 },
        },
      }),
    ).toEqual({
      bth: 8,
      btd: 0,
      damageFormula: "1d8",
      range: { normal: 40, long: 160 },
      proficient: true,
    });
  });
});
