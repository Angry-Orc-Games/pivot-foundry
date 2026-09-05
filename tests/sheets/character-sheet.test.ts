import { describe, expect, it } from "vitest";

import {
  applyInitiativeRollToCombat,
  buildD20ChatFlavor,
  buildRollModeDialogContent,
  createEmbeddedItemData,
  naturalResultsFromRoll,
  nextResourceValue,
  normalizeSheetSubmitData,
  POOL_VALUE_PATH,
  prepareCharacterSheetContext,
  resolveSheetRoll,
  type ActorLike,
} from "../../src/sheets/character-sheet";

function sampleActor(): ActorLike {
  return {
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
      {
        id: "spell-1",
        name: "Spark",
        type: "magicAbility",
        system: { roll: "1d8+2" },
      },
    ],
  };
}

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
    const context = prepareCharacterSheetContext(sampleActor());

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
  it("resolves d20 roll metadata from existing sheet controls", () => {
    const context = prepareCharacterSheetContext(sampleActor());

    expect(
      resolveSheetRoll(
        { dataset: { rollKind: "ability", key: "str", label: "Strength" } },
        context,
      ),
    ).toEqual({
      kind: "d20",
      rollKind: "ability",
      label: "Strength",
      modifier: 3,
      applyAttackCrit: false,
    });
    expect(
      resolveSheetRoll({ dataset: { rollKind: "save", key: "str", label: "STR Save" } }, context),
    ).toMatchObject({ kind: "d20", rollKind: "save", modifier: 6, applyAttackCrit: false });
    expect(
      resolveSheetRoll(
        { dataset: { rollKind: "skill", key: "athletics", label: "Athletics" } },
        context,
      ),
    ).toMatchObject({ kind: "d20", rollKind: "skill", modifier: 6, applyAttackCrit: false });
    expect(
      resolveSheetRoll({ dataset: { rollKind: "initiative", label: "Initiative" } }, context),
    ).toEqual({
      kind: "d20",
      rollKind: "initiative",
      label: "Initiative",
      modifier: 4,
      applyAttackCrit: false,
    });
    expect(
      resolveSheetRoll(
        { dataset: { rollKind: "weaponAttack", key: "weapon-1", label: "Battleaxe" } },
        context,
      ),
    ).toMatchObject({
      kind: "d20",
      rollKind: "weaponAttack",
      modifier: 6,
      applyAttackCrit: true,
    });
  });

  it("keeps damage and magic formula roll paths unchanged", () => {
    const context = prepareCharacterSheetContext(sampleActor());
    expect(
      resolveSheetRoll(
        { dataset: { rollKind: "weaponDamage", key: "weapon-1", label: "Battleaxe" } },
        context,
      ),
    ).toEqual({
      kind: "formula",
      rollKind: "weaponDamage",
      label: "Battleaxe",
      formula: "1d8+3",
    });
    expect(
      resolveSheetRoll(
        { dataset: { rollKind: "magicAbility", key: "spell-1", label: "Spark" } },
        context,
      ),
    ).toEqual({
      kind: "formula",
      rollKind: "magicAbility",
      label: "Spark",
      formula: "1d8+2",
    });
  });

  it("builds a roll-mode dialog with four labeled choices and Normal selected", () => {
    const content = buildRollModeDialogContent((key) => key);
    expect(content).toContain('value="normal" checked');
    expect(content).toContain('value="advantage"');
    expect(content).toContain('value="disadvantage"');
    expect(content).toContain('value="superAdvantage"');
    expect(content).toContain("PIVOT.RollMode.Normal");
  });

  it("builds chat flavor from kept die, modifier, and attack natural results", () => {
    const localize = (key: string) => key;
    expect(
      buildD20ChatFlavor({
        label: "Battleaxe",
        mode: "advantage",
        kept: 20,
        modifier: 6,
        total: 26,
        attackCrit: "hit",
        localize,
      }),
    ).toContain("PIVOT.Chat.AutoHit");
    expect(
      buildD20ChatFlavor({
        label: "Battleaxe",
        mode: "normal",
        kept: 1,
        modifier: 6,
        total: 7,
        attackCrit: "miss",
        localize,
      }),
    ).toContain("PIVOT.Chat.AutoMiss");
    expect(
      buildD20ChatFlavor({
        label: "Athletics",
        mode: "normal",
        kept: 12,
        modifier: 6,
        total: 18,
        attackCrit: null,
        localize,
      }),
    ).not.toContain("PIVOT.Chat.AutoHit");
  });

  it("reads natural d20 faces from a Foundry-shaped roll", () => {
    expect(
      naturalResultsFromRoll({
        dice: [{ faces: 20, results: [{ result: 4 }, { result: 18 }] }],
      }),
    ).toEqual([4, 18]);
  });

  it("clamps Pool adjustments to derived max without changing MP stepper rules", () => {
    expect(nextResourceValue(POOL_VALUE_PATH, 4, 1, 5)).toBe(5);
    expect(nextResourceValue(POOL_VALUE_PATH, 5, 1, 5)).toBe(5);
    expect(nextResourceValue(POOL_VALUE_PATH, 1, -2, 5)).toBe(0);
    expect(nextResourceValue("magic.mp.value", 10, 1, 5)).toBe(11);
    expect(nextResourceValue("magic.mp.value", 0, -1, 5)).toBe(0);
  });

  it("updates exactly one matching combatant and skips none or ambiguous matches", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const unique = {
      id: "c1",
      actorId: "hero",
      update: async (data: Record<string, unknown>) => {
        updates.push(data);
      },
    };
    const warnings: string[] = [];
    const notify = (level: "warn" | "error", message: string) => {
      warnings.push(`${level}:${message}`);
    };
    const localize = (key: string) => key;

    await expect(
      applyInitiativeRollToCombat({
        actorId: "hero",
        total: 17,
        combat: { combatants: [unique] },
        notify,
        localize,
      }),
    ).resolves.toBe("updated");
    expect(updates).toEqual([{ initiative: 17 }]);

    await expect(
      applyInitiativeRollToCombat({
        actorId: "hero",
        total: 17,
        combat: null,
        notify,
        localize,
      }),
    ).resolves.toBe("skipped");
    await expect(
      applyInitiativeRollToCombat({
        actorId: "hero",
        total: 17,
        combat: { combatants: [] },
        notify,
        localize,
      }),
    ).resolves.toBe("skipped");
    await expect(
      applyInitiativeRollToCombat({
        actorId: "hero",
        total: 17,
        combat: {
          combatants: [
            { id: "a", actorId: "hero", update: async () => undefined },
            { id: "b", actorId: "hero", update: async () => undefined },
          ],
        },
        notify,
        localize,
      }),
    ).resolves.toBe("skipped");
    expect(warnings).toEqual([
      "warn:PIVOT.Combat.NoActiveCombat",
      "warn:PIVOT.Combat.NoCombatant",
      "warn:PIVOT.Combat.MultipleCombatants",
    ]);
  });

  it("retains a failed tracker update without throwing", async () => {
    const result = await applyInitiativeRollToCombat({
      actorId: "hero",
      total: 12,
      combat: {
        combatants: [
          {
            id: "c1",
            actorId: "hero",
            update: async () => {
              throw new Error("permission");
            },
          },
        ],
      },
      notify: () => undefined,
      localize: (key) => key,
    });
    expect(result).toBe("skipped");
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

  it("normalizes flattened sheet helper fields into source array update paths", () => {
    expect(
      normalizeSheetSubmitData({
        "system.identity.languagesText": "Common, Giant",
        "system.proficiencies.instrumentsText": "Drums",
      }),
    ).toEqual({
      "system.identity.languages": ["Common", "Giant"],
      "system.proficiencies.instruments": ["Drums"],
    });
  });
});
