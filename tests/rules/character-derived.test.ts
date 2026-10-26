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
    expect(derived.speed).toBe(0);
  });

  it("combines manual bonuses with effect contributions", () => {
    const derived = calculateCharacterDerived(
      {
        level: 5,
        abilities: {
          str: { score: 10, primary: false },
          dex: { score: 10, primary: false },
          con: { score: 10, primary: false },
          int: { score: 10, primary: false },
          wis: { score: 10, primary: false },
          cha: { score: 10, primary: false },
        },
        skills: {},
        magic: { awakened: false, ability: null },
        equipment: [],
        poolBonus: 2,
        speed: { value: 10, bonus: 0 },
      },
      { poolMaxBonus: 3, speedBonus: 2, acBonus: 1 },
    );

    expect(derived.pool.max).toBe(10);
    expect(derived.speed).toBe(12);
    expect(derived.armourClass.value).toBe(11);
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

  it("adds the full Dexterity modifier for light armour", () => {
    const result = calculateArmourClass({
      dexterityModifier: 4,
      armour: [{ name: "Leather", category: "light", acBonus: 1, equipped: true }],
    });

    expect(result.value).toBe(15);
    expect(result.breakdown).toContain("Dex +4");
  });

  it("adds no Dexterity for heavy armour", () => {
    const result = calculateArmourClass({
      dexterityModifier: 4,
      armour: [{ name: "Plate", category: "heavy", acBonus: 5, equipped: true }],
    });

    expect(result.value).toBe(15);
    expect(result.breakdown).toContain("Dex +0");
  });

  it("adds the full Dexterity modifier for a shield with no body armour", () => {
    const result = calculateArmourClass({
      dexterityModifier: 3,
      armour: [{ name: "Shield", category: "shield", acBonus: 1, equipped: true }],
    });

    expect(result.breakdown).toContain("Dex +3");
  });

  it("adds the full Dexterity modifier for a helmet with no body armour", () => {
    const result = calculateArmourClass({
      dexterityModifier: 3,
      armour: [{ name: "Helm", category: "helmet", acBonus: 1, equipped: true }],
    });

    expect(result.breakdown).toContain("Dex +3");
  });

  it("adds the full Dexterity modifier for other armour", () => {
    const result = calculateArmourClass({
      dexterityModifier: 3,
      armour: [{ name: "Bracers", category: "other", acBonus: 0, equipped: true }],
    });

    expect(result.value).toBe(13);
    expect(result.breakdown).toContain("Dex +3");
  });

  it("keeps full Dexterity for an unknown armour category", () => {
    const result = calculateArmourClass({
      dexterityModifier: 4,
      armour: [{ name: "Platemail", category: "plate-mail", acBonus: 2, equipped: true }],
    });

    expect(result.value).toBe(16);
    expect(result.armourWorn).toBe("Platemail");
    expect(result.breakdown).toContain("Dex +4");
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

  it("does not add Constitution to the attack bonus", () => {
    expect(
      calculateAttackSummary({
        proficiencyBonus: 0,
        abilityModifiers: { str: 1, dex: 0, con: 4, int: 0, wis: 0, cha: 0 },
        weaponProficiencies: {},
        weapon: {
          category: "meleeLight",
          attackAbility: "con",
          damageAbility: "str",
          attackBonus: 0,
          damageBonus: 0,
          damageFormula: "1d4",
          range: { normal: 0, long: 0 },
        },
      }).bth,
    ).toBe(0);
  });

  it("adds no damage bonus when the damage ability is none", () => {
    expect(
      calculateAttackSummary({
        proficiencyBonus: 0,
        abilityModifiers: { str: 3, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        weaponProficiencies: {},
        weapon: {
          category: "meleeLight",
          attackAbility: "str",
          damageAbility: "none",
          attackBonus: 0,
          damageBonus: 0,
          damageFormula: "1d4",
          range: { normal: 0, long: 0 },
        },
      }).btd,
    ).toBe(0);
  });

  it("adds no damage bonus when the damage ability is Constitution", () => {
    expect(
      calculateAttackSummary({
        proficiencyBonus: 0,
        abilityModifiers: { str: 3, dex: 0, con: 4, int: 0, wis: 0, cha: 0 },
        weaponProficiencies: {},
        weapon: {
          category: "meleeLight",
          attackAbility: "str",
          damageAbility: "con",
          attackBonus: 0,
          damageBonus: 0,
          damageFormula: "1d4",
          range: { normal: 0, long: 0 },
        },
      }).btd,
    ).toBe(0);
  });

  it("does not treat thrown training as slings training", () => {
    expect(
      calculateAttackSummary({
        proficiencyBonus: 2,
        abilityModifiers: { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
        weaponProficiencies: { thrown: true, slings: false },
        weapon: {
          category: "slings",
          attackAbility: "dex",
          damageAbility: "str",
          attackBonus: 0,
          damageBonus: 0,
          damageFormula: "1d4",
          range: { normal: 10, long: 30 },
        },
      }),
    ).toMatchObject({
      proficient: false,
      bth: 1,
      btd: 3,
      damageFormula: "1d4",
    });
  });

  it("adds the proficiency bonus for a trained slings attack", () => {
    expect(
      calculateAttackSummary({
        proficiencyBonus: 2,
        abilityModifiers: { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
        weaponProficiencies: { thrown: true, slings: true },
        weapon: {
          category: "slings",
          attackAbility: "dex",
          damageAbility: "str",
          attackBonus: 0,
          damageBonus: 0,
          damageFormula: "1d6",
          range: { normal: 10, long: 30 },
        },
      }),
    ).toMatchObject({
      proficient: true,
      bth: 3,
      btd: 3,
      damageFormula: "1d6",
    });
  });
});
