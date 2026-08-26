import { describe, expect, it } from "vitest";

import {
  buildRollFormula,
  createEmbeddedItemData,
  normalizeSheetSubmitData,
  prepareCharacterSheetContext,
  type ActorLike,
} from "../../src/sheets/character-sheet";

describe("prepareCharacterSheetContext", () => {
  it("handles an empty new character cleanly", () => {
    const context = prepareCharacterSheetContext({
      name: "New Character",
      type: "character",
      system: {},
      items: [],
    });

    expect(context.actor.name).toBe("New Character");
    expect(context.derived.proficiencyBonus).toBe(2);
    expect(context.derived.abilities.str.mod).toBe(0);
    expect(context.derived.pool.max).toBe(1);
    expect(context.derived.magic.mp.max).toBe(0);
    expect(context.items.weapons).toEqual([]);
  });

  it("displays existing actor data and embedded item calculations", () => {
    const actor: ActorLike = {
      name: "Grawl",
      type: "character",
      system: {
        progression: { level: 5, xp: 6500 },
        abilities: {
          str: { score: 16, primary: true },
          dex: { score: 14, primary: false },
          con: { score: 12, primary: true },
          int: { score: 10, primary: false },
          wis: { score: 13, primary: false },
          cha: { score: 8, primary: false },
        },
        attributes: {
          ac: { bonus: 1 },
          initiative: { bonus: 2 },
          passivePerception: { mode: "normal" },
        },
        resources: { pool: { value: 3, maxBonus: 0 } },
        proficiencies: { weapons: { meleeHeavy: true } },
        skills: {
          athletics: { ability: "str", proficient: true, deepening: 0, expertise: false, bonus: 0 },
          perception: {
            ability: "wis",
            proficient: true,
            deepening: 0,
            expertise: false,
            bonus: 0,
          },
        },
      },
      items: [
        {
          id: "weapon-1",
          name: "Battleaxe",
          type: "weapon",
          system: {
            category: "meleeHeavy",
            attack: { ability: "str", bonus: 0 },
            damage: { formula: "1d8", ability: "str", bonus: 0 },
            range: { normal: 0, long: 0 },
            quantity: 1,
            weight: 2,
            carried: true,
          },
        },
        {
          id: "armour-1",
          name: "Heavy Armour",
          type: "armour",
          system: {
            category: "heavy",
            acBonus: 5,
            equipped: true,
            quantity: 1,
            weight: 25,
            carried: true,
          },
        },
        {
          id: "gear-1",
          name: "Rope",
          type: "equipment",
          system: { quantity: 1, weight: 5, carried: true },
        },
      ],
    };

    const context = prepareCharacterSheetContext(actor);

    expect(context.derived.proficiencyBonus).toBe(3);
    expect(context.derived.armourClass.value).toBe(16);
    expect(context.derived.initiative).toBe(4);
    expect(context.derived.totalWeight).toBe(32);
    expect(context.items.weapons[0]?.summary).toMatchObject({
      bth: 6,
      btd: 3,
      damageFormula: "1d8",
      proficient: true,
    });
  });

  it("keeps non-enumerable Foundry document ids available for item row actions", () => {
    const weapon = {
      name: "Hidden Id Axe",
      type: "weapon",
      system: {
        category: "meleeLight",
        attack: { ability: "str", bonus: 0 },
        damage: { formula: "1d6", ability: "str", bonus: 0 },
        range: { normal: 0, long: 0 },
      },
    };
    Object.defineProperty(weapon, "id", {
      enumerable: false,
      value: "hidden-id-axe",
    });

    const context = prepareCharacterSheetContext({
      name: "Foundry Shape",
      type: "character",
      system: {},
      items: [weapon],
    });

    expect(context.items.weapons[0]?.id).toBe("hidden-id-axe");
  });
});

describe("sheet interaction helpers", () => {
  it("builds readable d20 formulas", () => {
    expect(buildRollFormula("skill", 5)).toBe("1d20+5");
    expect(buildRollFormula("save", -1)).toBe("1d20-1");
  });

  it("creates embedded item documents by requested type", () => {
    expect(createEmbeddedItemData("weapon")).toEqual({ name: "New Weapon", type: "weapon" });
    expect(createEmbeddedItemData("magicAbility")).toEqual({
      name: "New Magic Ability",
      type: "magicAbility",
    });
  });

  it("normalizes comma-separated sheet fields into source arrays", () => {
    expect(
      normalizeSheetSubmitData({
        system: {
          identity: { languagesText: "Common, Elvish,  Dwarven " },
          proficiencies: { instrumentsText: "Strings, Brass" },
          skillSpecializations: {
            academiaText: "History, Theology",
            craftingText: "Smithing",
          },
        },
      }),
    ).toEqual({
      system: {
        identity: { languages: ["Common", "Elvish", "Dwarven"] },
        proficiencies: { instruments: ["Strings", "Brass"] },
        skillSpecializations: {
          academia: [
            {
              ability: "int",
              bonus: 0,
              deepening: 0,
              expertise: false,
              name: "History",
              proficient: true,
            },
            {
              ability: "int",
              bonus: 0,
              deepening: 0,
              expertise: false,
              name: "Theology",
              proficient: true,
            },
          ],
          crafting: [
            {
              ability: "int",
              bonus: 0,
              deepening: 0,
              expertise: false,
              name: "Smithing",
              proficient: true,
            },
          ],
        },
      },
    });
  });
});
