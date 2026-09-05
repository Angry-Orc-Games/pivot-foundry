import { describe, expect, it } from "vitest";

import { calculateCharacterDerived } from "../../src/rules/character-derived";
import {
  aggregateCharacterEffects,
  collectEmbeddedItemEffects,
  describeEffectRule,
  parseStoredEffect,
  validateEffectRule,
  type EffectRule,
} from "../../src/rules/effects";

const sampleAbilities = {
  str: { score: 16, primary: true },
  dex: { score: 14, primary: false },
  con: { score: 12, primary: true },
  int: { score: 10, primary: false },
  wis: { score: 13, primary: false },
  cha: { score: 8, primary: false },
};

describe("validateEffectRule", () => {
  it("accepts each v1 EffectRule type", () => {
    const rules: EffectRule[] = [
      { type: "abilityScoreBonus", ability: "str", amount: 2 },
      { type: "skillBonus", skill: "perception", amount: 2 },
      { type: "armourProficiency", category: "light" },
      { type: "weaponProficiency", category: "bows" },
      { type: "acBonus", amount: 1 },
      { type: "initiativeBonus", amount: -1 },
      { type: "speedBonus", amount: 2 },
      { type: "poolMaxBonus", amount: 3 },
      { type: "mpMaxBonus", amount: 4 },
    ];

    for (const rule of rules) {
      expect(validateEffectRule(rule)).toEqual(rule);
    }
  });

  it("rejects unknown types, keys, skills, and categories", () => {
    expect(() => validateEffectRule({ type: "eval", code: "1+1" })).toThrow(
      /Unsupported effect type/,
    );
    expect(() =>
      validateEffectRule({ type: "acBonus", amount: 1, path: "system.attributes.ac" }),
    ).toThrow(/Unexpected keys/);
    expect(() =>
      validateEffectRule({ type: "skillBonus", skill: "lockpicking", amount: 1 }),
    ).toThrow(/Unknown skill/);
    expect(() => validateEffectRule({ type: "weaponProficiency", category: "lasers" })).toThrow(
      /Unknown weapon category/,
    );
    expect(() => validateEffectRule({ type: "acBonus", formula: "1d4" })).toThrow();
    expect(() => validateEffectRule({ type: "acBonus", amount: 1.5 })).toThrow(/finite integer/);
  });
});

describe("parseStoredEffect", () => {
  it("accepts Foundry-stored null unused fields and rejects unsupported shapes", () => {
    expect(
      parseStoredEffect({
        type: "skillBonus",
        skill: "perception",
        amount: 2,
        ability: null,
        category: null,
      }),
    ).toEqual({ type: "skillBonus", skill: "perception", amount: 2 });

    expect(parseStoredEffect({ type: "html", html: "<img src=x>" })).toBeNull();
    expect(parseStoredEffect({ type: "abilityScoreBonus", ability: "str" })).toBeNull();
  });
});

describe("aggregateCharacterEffects", () => {
  it("adds bonuses and ORs proficiency grants without mutating input", () => {
    const effects: EffectRule[] = [
      { type: "abilityScoreBonus", ability: "dex", amount: 2 },
      { type: "abilityScoreBonus", ability: "dex", amount: 1 },
      { type: "skillBonus", skill: "perception", amount: 2 },
      { type: "skillBonus", skill: "perception", amount: 1 },
      { type: "armourProficiency", category: "light" },
      { type: "armourProficiency", category: "shield" },
      { type: "weaponProficiency", category: "bows" },
      { type: "weaponProficiency", category: "bows" },
      { type: "acBonus", amount: 1 },
      { type: "initiativeBonus", amount: 2 },
      { type: "speedBonus", amount: 3 },
      { type: "poolMaxBonus", amount: 1 },
      { type: "mpMaxBonus", amount: 5 },
    ];
    const frozen = effects.map((effect) => Object.freeze({ ...effect }));
    Object.freeze(frozen);

    const summary = aggregateCharacterEffects(frozen);

    expect(summary.abilityScoreBonuses.dex).toBe(3);
    expect(summary.skillBonuses.perception).toBe(3);
    expect(summary.armourProficiencies.light).toBe(true);
    expect(summary.shieldProficiency).toBe(true);
    expect(summary.weaponProficiencies.bows).toBe(true);
    expect(summary.acBonus).toBe(1);
    expect(summary.initiativeBonus).toBe(2);
    expect(summary.speedBonus).toBe(3);
    expect(summary.poolMaxBonus).toBe(1);
    expect(summary.mpMaxBonus).toBe(5);
    expect(frozen[0]).toEqual({ type: "abilityScoreBonus", ability: "dex", amount: 2 });
  });
});

describe("collectEmbeddedItemEffects", () => {
  it("parses valid embedded item effects and skips malformed entries", () => {
    expect(
      collectEmbeddedItemEffects([
        {
          system: {
            effects: [
              { type: "skillBonus", skill: "perception", amount: 2, ability: null, category: null },
              { type: "nope" },
            ],
          },
        },
        { system: { notes: "no effects field" } },
      ]),
    ).toEqual([{ type: "skillBonus", skill: "perception", amount: 2 }]);
  });
});

describe("calculateCharacterDerived with effect contributions", () => {
  it("applies effect bonuses to derived totals without rewriting source scores", () => {
    const source = {
      level: 5,
      abilities: sampleAbilities,
      skills: {
        perception: {
          ability: "wis" as const,
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 1,
        },
      },
      magic: { awakened: true, ability: "int" as const },
      equipment: [],
      poolBonus: 1,
      mpBonus: 2,
      initiativeBonus: 1,
      manualArmourBonus: 1,
      speed: { value: 10, bonus: 1 },
      proficiencies: {
        armour: { light: true, medium: false, heavy: false },
        shields: false,
        weapons: { meleeLight: true },
      },
    };
    const frozenAbilities = structuredClone(source.abilities);
    const effects = aggregateCharacterEffects([
      { type: "abilityScoreBonus", ability: "dex", amount: 2 },
      { type: "abilityScoreBonus", ability: "int", amount: 2 },
      { type: "skillBonus", skill: "perception", amount: 2 },
      { type: "armourProficiency", category: "medium" },
      { type: "armourProficiency", category: "shield" },
      { type: "weaponProficiency", category: "bows" },
      { type: "acBonus", amount: 2 },
      { type: "initiativeBonus", amount: 3 },
      { type: "speedBonus", amount: 4 },
      { type: "poolMaxBonus", amount: 2 },
      { type: "mpMaxBonus", amount: 3 },
    ]);

    const derived = calculateCharacterDerived(source, effects);

    expect(source.abilities).toEqual(frozenAbilities);
    expect(derived.abilities.dex.score).toBe(14);
    expect(derived.abilities.dex.mod).toBe(3);
    expect(derived.skills.perception?.total).toBe(7);
    expect(derived.armourClass.value).toBe(16);
    expect(derived.armourClass.breakdown).toContain("Effects +2");
    expect(derived.initiative).toBe(7);
    expect(derived.speed).toBe(15);
    expect(derived.pool.max).toBe(8);
    expect(derived.magic.mp.max).toBe(16);
    expect(derived.proficiencies.armour.light).toBe(true);
    expect(derived.proficiencies.armour.medium).toBe(true);
    expect(derived.proficiencies.shields).toBe(true);
    expect(derived.proficiencies.weapons.meleeLight).toBe(true);
    expect(derived.proficiencies.weapons.bows).toBe(true);
  });
});

describe("describeEffectRule", () => {
  it("builds a read-only summary for item sheets", () => {
    expect(describeEffectRule({ type: "skillBonus", skill: "perception", amount: 2 })).toEqual({
      typeLabelKey: "PIVOT.Effects.SkillBonus",
      detail: "Perception +2",
    });
  });
});
