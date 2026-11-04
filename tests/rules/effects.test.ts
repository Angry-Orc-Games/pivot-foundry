import { afterEach, describe, expect, it, vi } from "vitest";

import { calculateCharacterDerived } from "../../src/rules/character-derived";
import {
  abilityScoreSources,
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

describe("gear bonuses count only while equipped", () => {
  const strengthBonus = {
    type: "abilityScoreBonus" as const,
    ability: "str" as const,
    amount: 2,
  };

  function embedded(
    type: string,
    equipped: boolean,
    effects: EffectRule[],
    extra: Record<string, unknown> = {},
  ) {
    return { type, system: { equipped, effects, ...extra } };
  }

  function strengthTotal(items: readonly { type?: string; system?: unknown }[]): number {
    return aggregateCharacterEffects(collectEmbeddedItemEffects(items)).abilityScoreBonuses.str;
  }

  it("counts an equipped weapon, armour, shield, and equipment ability bonus", () => {
    expect(strengthTotal([embedded("weapon", true, [strengthBonus])])).toBe(2);
    expect(strengthTotal([embedded("armour", true, [strengthBonus])])).toBe(2);
    expect(strengthTotal([embedded("armour", true, [strengthBonus], { category: "shield" })])).toBe(
      2,
    );
    expect(strengthTotal([embedded("equipment", true, [strengthBonus])])).toBe(2);
  });

  it("ignores the same ability bonus on an unequipped weapon, armour, shield, and equipment item", () => {
    expect(strengthTotal([embedded("weapon", false, [strengthBonus])])).toBe(0);
    expect(strengthTotal([embedded("armour", false, [strengthBonus])])).toBe(0);
    expect(
      strengthTotal([embedded("armour", false, [strengthBonus], { category: "shield" })]),
    ).toBe(0);
    expect(strengthTotal([embedded("equipment", false, [strengthBonus])])).toBe(0);
  });

  it("always counts feature, magic stream, and magic ability items", () => {
    expect(
      strengthTotal([embedded("feature", false, [strengthBonus], { category: "species" })]),
    ).toBe(2);
    expect(strengthTotal([embedded("magicStream", false, [strengthBonus])])).toBe(2);
    expect(strengthTotal([embedded("magicAbility", false, [strengthBonus])])).toBe(2);
  });

  it("keeps the best equipped gear bonus and adds every penalty on that stat", () => {
    expect(
      strengthTotal([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: 1 }]),
        embedded("equipment", true, [{ type: "abilityScoreBonus", ability: "str", amount: -2 }]),
      ]),
    ).toBe(-1);
    expect(
      strengthTotal([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: 3 }]),
        embedded("armour", true, [{ type: "abilityScoreBonus", ability: "str", amount: 1 }]),
        embedded("equipment", true, [{ type: "abilityScoreBonus", ability: "str", amount: -2 }]),
      ]),
    ).toBe(1);
  });

  it("sums equipped gear penalties on one stat", () => {
    expect(
      strengthTotal([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: -1 }]),
        embedded("equipment", true, [{ type: "abilityScoreBonus", ability: "str", amount: -2 }]),
      ]),
    ).toBe(-3);
  });

  it("ignores a penalty on unequipped gear", () => {
    expect(
      strengthTotal([
        embedded("equipment", false, [{ type: "abilityScoreBonus", ability: "str", amount: -2 }]),
      ]),
    ).toBe(0);
    expect(
      strengthTotal([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: 1 }]),
        embedded("equipment", false, [{ type: "abilityScoreBonus", ability: "str", amount: -2 }]),
      ]),
    ).toBe(1);
  });

  it("uses the highest gear bonus for one effect key instead of adding them", () => {
    expect(
      strengthTotal([
        embedded("weapon", true, [strengthBonus]),
        embedded("armour", true, [strengthBonus]),
      ]),
    ).toBe(2);

    expect(
      strengthTotal([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: 1 }]),
        embedded("equipment", true, [{ type: "abilityScoreBonus", ability: "str", amount: 3 }]),
      ]),
    ).toBe(3);
  });

  it("adds the highest gear bonus to the sum of feature bonuses", () => {
    expect(
      strengthTotal([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: 1 }]),
        embedded("equipment", true, [{ type: "abilityScoreBonus", ability: "str", amount: 3 }]),
        embedded("feature", false, [strengthBonus]),
        embedded("magicAbility", false, [{ type: "abilityScoreBonus", ability: "str", amount: 1 }]),
      ]),
    ).toBe(6);
  });

  it("keeps different ability bonuses and sums only the non-gear copies", () => {
    const summary = aggregateCharacterEffects(
      collectEmbeddedItemEffects([
        embedded("weapon", true, [{ type: "abilityScoreBonus", ability: "str", amount: 2 }]),
        embedded("armour", true, [{ type: "abilityScoreBonus", ability: "dex", amount: 1 }]),
        embedded("feature", false, [{ type: "abilityScoreBonus", ability: "dex", amount: 1 }]),
      ]),
    );

    expect(summary.abilityScoreBonuses.str).toBe(2);
    expect(summary.abilityScoreBonuses.dex).toBe(2);
  });

  it("uses the highest gear acBonus and mpMaxBonus, then adds feature bonuses, because damage reduction and damage-die step-ups are not effect types yet", () => {
    const summary = aggregateCharacterEffects(
      collectEmbeddedItemEffects([
        embedded("weapon", true, [{ type: "acBonus", amount: 1 }]),
        embedded("armour", true, [
          { type: "acBonus", amount: 2 },
          { type: "mpMaxBonus", amount: 4 },
        ]),
        embedded("equipment", true, [{ type: "mpMaxBonus", amount: 2 }]),
        embedded("feature", false, [
          { type: "acBonus", amount: 1 },
          { type: "mpMaxBonus", amount: 1 },
        ]),
      ]),
    );

    expect(summary.acBonus).toBe(3);
    expect(summary.mpMaxBonus).toBe(5);
  });

  it("keeps proficiency effects boolean and still drops them when the gear is unequipped", () => {
    const summary = aggregateCharacterEffects(
      collectEmbeddedItemEffects([
        embedded("weapon", false, [{ type: "weaponProficiency", category: "bows" }]),
        embedded("armour", true, [{ type: "armourProficiency", category: "shield" }]),
        embedded("feature", false, [{ type: "armourProficiency", category: "light" }]),
      ]),
    );

    expect(summary.weaponProficiencies.bows).toBe(false);
    expect(summary.shieldProficiency).toBe(true);
    expect(summary.armourProficiencies.light).toBe(true);
  });
});

describe("same-stat effects on one item", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function strengthEffects(amounts: readonly number[]): EffectRule[] {
    return amounts.map((amount) => ({ type: "abilityScoreBonus", ability: "str", amount }));
  }

  function strengthTotal(items: readonly { type?: string; system?: unknown; name?: string }[]) {
    return aggregateCharacterEffects(collectEmbeddedItemEffects(items)).abilityScoreBonuses.str;
  }

  it("keeps the best strength bonus on one gear item and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const item = {
      name: "Belt",
      type: "equipment",
      system: { equipped: true, effects: strengthEffects([1, 2]) },
    };

    expect(strengthTotal([item])).toBe(2);
    expect(abilityScoreSources([item])).toEqual([{ ability: "str", name: "Belt", amount: 2 }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps one strength bonus when a feature lists it twice and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const item = {
      name: "Giant Blood",
      type: "feature",
      system: { effects: strengthEffects([1, 1]) },
    };

    expect(strengthTotal([item])).toBe(1);
    expect(abilityScoreSources([item])).toEqual([
      { ability: "str", name: "Giant Blood", amount: 1 },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps a bonus and every penalty from the same item and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const item = {
      name: "Cursed Belt",
      type: "equipment",
      system: { equipped: true, effects: strengthEffects([2, -1]) },
    };

    expect(strengthTotal([item])).toBe(1);
    expect(abilityScoreSources([item])).toEqual([
      { ability: "str", name: "Cursed Belt", amount: 2 },
      { ability: "str", name: "Cursed Belt", amount: -1 },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns once when one item repeats two different stats", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const item = {
      name: "Odd Feat",
      type: "feature",
      system: {
        effects: [
          { type: "abilityScoreBonus", ability: "str", amount: 1 },
          { type: "abilityScoreBonus", ability: "str", amount: 2 },
          { type: "abilityScoreBonus", ability: "dex", amount: 1 },
          { type: "abilityScoreBonus", ability: "dex", amount: 3 },
        ],
      },
    };
    const summary = aggregateCharacterEffects(collectEmbeddedItemEffects([item]));

    expect(summary.abilityScoreBonuses.str).toBe(2);
    expect(summary.abilityScoreBonuses.dex).toBe(3);
    expect(abilityScoreSources([item])).toEqual([
      { ability: "str", name: "Odd Feat", amount: 2 },
      { ability: "dex", name: "Odd Feat", amount: 3 },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("items with no known type count as gear", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function strengthTotal(items: readonly { name?: string; type?: unknown; system?: unknown }[]) {
    return aggregateCharacterEffects(collectEmbeddedItemEffects(items)).abilityScoreBonuses.str;
  }

  function strengthBonus(amount: number): EffectRule {
    return { type: "abilityScoreBonus", ability: "str", amount };
  }

  it("ignores an untyped item that is not equipped and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const item = { name: "Loose Gem", system: { effects: [strengthBonus(2)] } };

    expect(strengthTotal([item])).toBe(0);
    expect(abilityScoreSources([item])).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the best bonus when two equipped untyped items share a stat", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const low = {
      name: "Loose Gem",
      system: { equipped: true, effects: [strengthBonus(2)] },
    };
    const high = {
      name: "Other Gem",
      system: { equipped: true, effects: [strengthBonus(3)] },
    };

    expect(strengthTotal([low, high])).toBe(3);
    expect(abilityScoreSources([low, high])).toEqual([
      { ability: "str", name: "Other Gem", amount: 3 },
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("treats an unknown type string like a missing type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unequipped = {
      name: "Relic",
      type: "relic",
      system: { effects: [strengthBonus(2)] },
    };

    expect(strengthTotal([unequipped])).toBe(0);
    expect(abilityScoreSources([unequipped])).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);

    const equipped = {
      name: "Relic",
      type: "relic",
      system: { equipped: true, effects: [strengthBonus(2)] },
    };
    expect(strengthTotal([equipped])).toBe(2);
    expect(abilityScoreSources([equipped])).toEqual([
      { ability: "str", name: "Relic", amount: 2 },
    ]);
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
