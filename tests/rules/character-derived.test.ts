import { describe, expect, it, vi } from "vitest";

import { bonusStackMode, stackIdenticalBonuses } from "../../src/rules/ac-stacking";
import {
  calculateArmourClass,
  calculateAttackSummary,
  calculateCharacterDerived,
  calculateManaMaximum,
  calculatePassivePerception,
  calculateSkillTotal,
  calculateTotalWeight,
} from "../../src/rules/character-derived";

function speedActor(species: string, stored: number) {
  return {
    level: 1,
    abilities: {
      str: { score: 10, primary: false },
      dex: { score: 14, primary: false },
      con: { score: 10, primary: false },
      int: { score: 10, primary: false },
      wis: { score: 10, primary: false },
      cha: { score: 10, primary: false },
    },
    skills: {},
    magic: { awakened: false, ability: null },
    equipment: [],
    species,
    speed: { value: stored, bonus: 2 },
  };
}

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

  it("derives base speed from species size and adds bonuses", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const halfling = calculateCharacterDerived(speedActor("Halfling", 10), { speedBonus: 1 });
    const dwarf = calculateCharacterDerived(speedActor("Dwarf", 10));
    const human = calculateCharacterDerived(speedActor("Human", 10));
    const smallHumanoid = calculateCharacterDerived(speedActor("Small Humanoid", 10));
    const largeBeast = calculateCharacterDerived(speedActor("Large Beast", 10));
    const unknown = calculateCharacterDerived(speedActor("Dragon", 10));
    const custom = calculateCharacterDerived(speedActor("Halfling", 4));
    const zero = calculateCharacterDerived(speedActor("Halfling", 0));

    expect(halfling.speed).toBe(10);
    expect(dwarf.speed).toBe(10);
    expect(human.speed).toBe(12);
    expect(smallHumanoid.speed).toBe(9);
    expect(largeBeast.speed).toBe(14);
    expect(unknown.speed).toBe(12);
    expect(custom.speed).toBe(6);
    expect(zero.speed).toBe(2);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Dragon"));
    info.mockRestore();
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

  it("pins mana to floor of the score over 2 plus the modifier times level", () => {
    expect(calculateManaMaximum({ awakened: true, level: 7, abilityScore: 17 })).toBe(29);
    expect(calculateManaMaximum({ awakened: true, level: 1, abilityScore: 10 })).toBe(5);
    expect(calculateManaMaximum({ awakened: true, level: 4, abilityScore: 8 })).toBe(0);
    expect(calculateManaMaximum({ awakened: false, level: 7, abilityScore: 17 })).toBe(0);
  });
});

function breakdownTotal(lines: string[]): number {
  return lines.reduce((sum, line) => {
    const match = line.match(/[+-]?\d+$/);
    return sum + (match ? Number(match[0]) : 0);
  }, 0);
}

describe("calculateArmourClass", () => {
  it("takes the higher of natural AC and one worn armour", () => {
    const wornWins = calculateArmourClass({
      dexterityModifier: 4,
      manualBonus: 1,
      effectBonus: 1,
      armour: [
        { name: "Leather", category: "light", acBonus: 1, equipped: true },
        { name: "Plate", category: "heavy", acBonus: 6, equipped: true },
        { name: "Fortress", category: "heavy", acBonus: 20, equipped: false },
        { name: "Carapace", category: "natural", acBonus: 14, equipped: true },
        { name: "Small Shield", category: "shield", acBonus: 1, equipped: true },
        { name: "Large Shield", category: "shield", acBonus: 2, equipped: true },
        { name: "Helm", category: "helmet", acBonus: 1, equipped: true },
        {
          name: "Magic Armour",
          category: "other",
          acBonus: 1,
          equipped: true,
          stackKey: "magicArmour",
        },
        {
          name: "Ring of Protection",
          category: "other",
          acBonus: 2,
          equipped: true,
          stackKey: "ringOfProtection",
        },
      ],
    });

    expect(wornWins).toEqual({
      value: 23,
      armourWorn: "Plate, Large Shield, Helm, Ring of Protection",
      breakdown: [
        "Base 10",
        "Plate +6",
        "Large Shield +2",
        "Helm +1",
        "Ring of Protection +2",
        "Manual +1",
        "Effects +1",
      ],
    });
    expect(breakdownTotal(wornWins.breakdown)).toBe(wornWins.value);

    const naturalWins = calculateArmourClass({
      dexterityModifier: 4,
      armour: [
        { name: "Plate", category: "heavy", acBonus: 6, equipped: true },
        { name: "Carapace", category: "natural", acBonus: 18, equipped: true },
        { name: "Small Shield", category: "shield", acBonus: 1, equipped: true },
      ],
    });
    expect(naturalWins).toEqual({
      value: 19,
      armourWorn: "Carapace, Small Shield",
      breakdown: ["Carapace 18", "Small Shield +1"],
    });
    expect(breakdownTotal(naturalWins.breakdown)).toBe(naturalWins.value);

    const medium = calculateArmourClass({
      dexterityModifier: 4,
      armour: [
        { name: "Hide", category: "heavy", acBonus: 1, equipped: true },
        { name: "Chain", category: "medium", acBonus: 5, equipped: true },
      ],
    });
    expect(medium).toEqual({
      value: 17,
      armourWorn: "Chain",
      breakdown: ["Base 10", "Dex +2", "Chain +5"],
    });
    expect(breakdownTotal(medium.breakdown)).toBe(medium.value);
    expect(stackIdenticalBonuses(bonusStackMode.ac, [1, 3])).toBe(3);
    expect(stackIdenticalBonuses(bonusStackMode.dr, [1, 2])).toBe(3);
    expect(stackIdenticalBonuses(bonusStackMode.dieStep, [1, 1])).toBe(2);
  });

  it("adds an other armour bonus that has no exclusion key", () => {
    const result = calculateArmourClass({
      dexterityModifier: 0,
      armour: [
        { name: "Cloak", category: "other", acBonus: 1, equipped: true },
        { name: "Amulet", category: "other", acBonus: 2, equipped: true },
      ],
    });

    expect(result.value).toBe(13);
    expect(result.breakdown).toEqual(["Base 10", "Cloak +1", "Amulet +2"]);
    expect(breakdownTotal(result.breakdown)).toBe(result.value);
  });

  it("picks the worn suit by its bonus plus the category Dex cap", () => {
    const lightWins = calculateArmourClass({
      dexterityModifier: 4,
      armour: [
        { name: "Hide", category: "heavy", acBonus: 6, equipped: true },
        { name: "Leather", category: "light", acBonus: 3, equipped: true },
      ],
    });
    expect(lightWins).toEqual({
      value: 17,
      armourWorn: "Leather",
      breakdown: ["Base 10", "Dex +4", "Leather +3"],
    });

    const naturalWins = calculateArmourClass({
      dexterityModifier: 4,
      armour: [
        { name: "Hide", category: "heavy", acBonus: 6, equipped: true },
        { name: "Leather", category: "light", acBonus: 3, equipped: true },
        { name: "Carapace", category: "natural", acBonus: 18, equipped: true },
      ],
    });
    expect(naturalWins.value).toBe(18);
    expect(naturalWins.breakdown[0]).toBe("Carapace 18");
  });

  it("adds Dexterity to a natural armour base", () => {
    const carapace = calculateArmourClass({
      dexterityModifier: 3,
      armour: [{ name: "Chitinous Carapace", category: "natural", acBonus: 12, equipped: true }],
    });
    const furry = calculateArmourClass({
      dexterityModifier: 3,
      armour: [{ name: "Furry", category: "natural", acBonus: 11, equipped: true }],
    });
    const thickHide = calculateArmourClass({
      dexterityModifier: 3,
      armour: [{ name: "Thick Hide", category: "natural", acBonus: 12, equipped: true }],
    });

    expect(carapace).toEqual({
      value: 15,
      armourWorn: "Chitinous Carapace",
      breakdown: ["Chitinous Carapace 12", "Dex +3"],
    });
    expect(furry.value).toBe(14);
    expect(furry.breakdown).toEqual(["Furry 11", "Dex +3"]);
    expect(thickHide.value).toBe(15);
    expect(thickHide.breakdown).toEqual(["Thick Hide 12", "Dex +3"]);
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
