import { describe, expect, it } from "vitest";

import type { FoundryRuntime } from "../../src/foundry-runtime";
import {
  applyInitiativeRollToCombat,
  buildD20ChatFlavor,
  buildRollModeDialogContent,
  createEmbeddedItemData,
  createPivotCharacterSheetClass,
  naturalResultsFromRoll,
  nextResourceValue,
  normalizeSheetSubmitData,
  POOL_VALUE_PATH,
  prepareCharacterSheetContext,
  resolveSheetRoll,
  type ActorLike,
  type CharacterSheetContext,
  type ItemLike,
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

  it("applies embedded item effects to derived values and reverts when the item is removed", () => {
    const actor = sampleActor();
    const withFeature = {
      ...actor,
      items: [
        ...(Array.isArray(actor.items) ? actor.items : []),
        {
          id: "feature-1",
          name: "Example Keen Senses",
          type: "feature",
          system: {
            effects: [{ type: "skillBonus", skill: "perception", amount: 2 }],
          },
        },
        {
          id: "feature-2",
          name: "Bow Training",
          type: "feature",
          system: {
            effects: [
              { type: "weaponProficiency", category: "bows" },
              { type: "abilityScoreBonus", ability: "dex", amount: 2 },
            ],
          },
        },
      ],
    };

    const boosted = prepareCharacterSheetContext(withFeature);
    const baseline = prepareCharacterSheetContext(actor);

    expect(baseline.abilityRows.find((row) => row.key === "dex")?.score).toBe(14);
    expect(boosted.abilityRows.find((row) => row.key === "dex")?.score).toBe(14);
    expect(baseline.abilityRows.find((row) => row.key === "dex")?.mod).toBe(2);
    expect(boosted.abilityRows.find((row) => row.key === "dex")?.mod).toBe(3);
    expect(baseline.skillRows.find((row) => row.id === "perception")?.total).toBe(4);
    expect(boosted.skillRows.find((row) => row.id === "perception")?.total).toBe(6);
    expect(boosted.derived.proficiencies.weapons.bows).toBe(true);
    expect(baseline.derived.initiative).toBe(4);
    expect(boosted.derived.initiative).toBe(5);
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

  it("exposes resource meters and death-save pips for the resources panel", () => {
    const actor = sampleActor();
    const context = prepareCharacterSheetContext({
      ...actor,
      system: {
        ...actor.system,
        attributes: {
          ...(actor.system.attributes as Record<string, unknown>),
          hp: { value: 8, max: 16, temp: 3 },
          deathSaves: { status: "dying", successes: 2, failures: 1 },
        },
        resources: { pool: { value: 1, maxBonus: 0 } },
      },
    });

    expect(context.survivalStatus).toBe("dying");
    expect(context.survivalLabel).toBe("PIVOT.Survival.dying");
    expect(context.hpPercent).toBe(50);
    expect(context.poolPercent).toBe(20);
    expect(context.deathSaveSuccessPips).toEqual([true, true, false]);
    expect(context.deathSaveFailurePips).toEqual([true, false, false]);
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

describe("sheet edits survive a stale prepared copy", () => {
  it("reopens a linked actor from persisted source, not the stale system", () => {
    const actor = linkedActor();
    const context = prepareCharacterSheetContext(actor);

    expect(persistedView(context)).toEqual({
      name: "Renamed Hera",
      level: 4,
      hp: 12,
      hpPercent: 43,
      equipment: ["Rope"],
      features: ["Alert"],
    });
  });

  it("keeps a linked edit after submit when prepared data is not refreshed", async () => {
    const actor = linkedActor();
    const sheet = Object.assign(Object.create(sheetClass().prototype), { document: actor });
    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: { system: { progression: { level: 5 } } },
    });

    expect(persistedView(prepareCharacterSheetContext(actor))).toMatchObject({
      level: 5,
      hp: 12,
      equipment: ["Rope"],
      features: ["Alert"],
    });
    expect(actor.source.system.resources.pool.value).toBe(3);
  });

  it("writes a pool change from persisted pool value, not the stale prepared value", async () => {
    const actor = linkedActor();
    const sheet = Object.assign(Object.create(sheetClass().prototype), { document: actor });
    await sheetClass().DEFAULT_OPTIONS.actions.adjustResource.call(sheet, click(), {
      dataset: { path: "resources.pool.value", delta: "1" },
    } as unknown as HTMLElement);

    expect(actor.source.system.resources.pool.value).toBe(4);
    expect(persistedView(prepareCharacterSheetContext(actor)).hp).toBe(12);
  });

  it("reopens an unlinked token actor from its own persisted delta", async () => {
    const { base, tokenActor, sheet } = unlinkedPair();
    const context = await openSheet(sheet);

    expect(persistedView(context)).toEqual({
      name: "Token Hera",
      level: 4,
      hp: 9,
      hpPercent: 32,
      equipment: ["Rope"],
      features: ["Alert"],
    });
    expect(base.updates).toEqual([]);
    expect(tokenActor.updates).toEqual([]);
  });

  it("keeps token edits on the unlinked actor across submit, delete, and create", async () => {
    const { base, tokenActor, sheet } = unlinkedPair();
    const handler = sheetClass().DEFAULT_OPTIONS.form.handler;
    await handler.call(sheet, click(), {} as HTMLFormElement, {
      object: { system: { progression: { level: 6 } } },
    });
    const afterLevel = await openSheet(sheet);
    expect(persistedView(afterLevel)).toMatchObject({
      level: 6,
      hp: 9,
      equipment: ["Rope"],
      features: ["Alert"],
    });

    await sheetClass().DEFAULT_OPTIONS.actions.deleteItem.call(sheet, click(), {
      dataset: { itemId: "alert" },
    } as unknown as HTMLElement);
    await sheetClass().DEFAULT_OPTIONS.actions.createItem.call(sheet, click(), {
      dataset: { type: "equipment" },
    } as unknown as HTMLElement);

    expect(persistedView(await openSheet(sheet))).toEqual({
      name: "Token Hera",
      level: 6,
      hp: 9,
      hpPercent: 32,
      equipment: ["Rope", "New Equipment"],
      features: [],
    });
    expect(base.updates).toEqual([]);
    expect(tokenActor.updates).toEqual([{ system: { progression: { level: 6 } } }]);
  });
});

function click() {
  return { preventDefault() {} } as PointerEvent;
}

function persistedView(context: CharacterSheetContext & { name?: string }) {
  const system = context.system as {
    progression?: { level?: number };
    attributes?: { hp?: { value?: number } };
  };
  return {
    name: context.name,
    level: system.progression?.level,
    hp: system.attributes?.hp?.value,
    hpPercent: context.hpPercent,
    equipment: context.items.equipment.map((item) => item.name),
    features: context.items.features.map((item) => item.name),
  };
}

function sheetClass() {
  return createPivotCharacterSheetClass(sheetFoundry()) as unknown as {
    prototype: {
      _prepareContext(options: Record<string, unknown>): Promise<CharacterSheetContext>;
    };
    DEFAULT_OPTIONS: {
      form: {
        handler: (
          this: object,
          event: Event,
          form: HTMLFormElement,
          formData: { object?: Record<string, unknown> },
        ) => Promise<unknown>;
      };
      actions: {
        adjustResource: (this: object, event: PointerEvent, target: HTMLElement) => Promise<void>;
        createItem: (this: object, event: PointerEvent, target: HTMLElement) => Promise<void>;
        deleteItem: (this: object, event: PointerEvent, target: HTMLElement) => Promise<void>;
      };
    };
  };
}

function openSheet(sheet: object) {
  return sheetClass().prototype._prepareContext.call(sheet, {});
}

function linkedActor() {
  const source = characterSource({
    name: "Renamed Hera",
    level: 4,
    hp: 12,
    pool: 3,
    items: [ropeItem(), alertItem()],
  });
  const actor = {
    name: "Hera",
    type: "character",
    system: staleSystem(),
    items: [] as ItemLike[],
    source,
    toObject() {
      return structuredClone(source);
    },
    async update(data: Record<string, unknown>) {
      mergeUpdate(source, data);
    },
  };
  return actor;
}

function unlinkedPair() {
  const source = characterSource({
    name: "Token Hera",
    level: 4,
    hp: 9,
    pool: 2,
    items: [ropeItem(), alertItem()],
  });
  const updates: Record<string, unknown>[] = [];
  const tokenActor = {
    name: "Token Stale",
    type: "character",
    system: staleSystem(),
    items: [] as ItemLike[],
    updates,
    toObject() {
      return structuredClone(source);
    },
    async update(data: Record<string, unknown>) {
      updates.push(structuredClone(data));
      mergeUpdate(source, data);
    },
    async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
      const created = data.map((entry) => ({ ...entry, _id: "created-gear" }));
      source.items.push(...created);
      return created;
    },
    async deleteEmbeddedDocuments(_type: string, ids: string[]) {
      source.items = source.items.filter((item) => !ids.includes(String(item._id)));
    },
  };
  const base = {
    name: "Base Hera",
    type: "character",
    system: staleSystem(),
    items: [] as ItemLike[],
    updates: [] as string[],
    async update() {
      base.updates.push("base");
    },
  };
  const sheet = Object.assign(Object.create(sheetClass().prototype), {
    document: base,
    token: { actorLink: false as const, actor: tokenActor },
  });
  return { base, tokenActor, sheet };
}

function characterSource(input: {
  name: string;
  level: number;
  hp: number;
  pool: number;
  items: Array<Record<string, unknown>>;
}) {
  return {
    name: input.name,
    type: "character",
    system: {
      progression: { level: input.level },
      attributes: { hp: { value: input.hp, max: 28, temp: 0 } },
      resources: { pool: { value: input.pool, maxBonus: 0 } },
    },
    items: input.items,
  };
}

function staleSystem() {
  return {
    progression: { level: 1 },
    attributes: { hp: { value: 28, max: 28, temp: 0 } },
    resources: { pool: { value: 0, maxBonus: 0 } },
  };
}

function ropeItem() {
  return {
    _id: "rope",
    name: "Rope",
    type: "equipment",
    system: { quantity: 1, weight: 1, carried: true },
  };
}

function alertItem() {
  return {
    _id: "alert",
    name: "Alert",
    type: "feature",
    system: { category: "feat" },
  };
}

function mergeUpdate(target: Record<string, unknown>, update: Record<string, unknown>) {
  for (const [key, value] of Object.entries(update)) {
    if (key.includes(".")) {
      const parts = key.split(".");
      let current = target;
      for (const part of parts.slice(0, -1)) {
        const next = current[part];
        if (typeof next !== "object" || next === null || Array.isArray(next)) current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
      const leaf = parts.at(-1);
      if (leaf) current[leaf] = value;
      continue;
    }
    if (isMergeRecord(value) && isMergeRecord(target[key])) {
      mergeUpdate(target[key], value);
      continue;
    }
    target[key] = value;
  }
}

function isMergeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sheetFoundry(): FoundryRuntime {
  class ActorSheetV2 {
    readonly kind = "actor";
  }
  class ItemSheetV2 {
    readonly kind = "item";
  }
  class TypeDataModel {
    readonly kind = "model";
  }
  class NumberField {
    readonly kind = "number";
  }
  class StringField {
    readonly kind = "string";
  }
  class BooleanField {
    readonly kind = "boolean";
  }
  class SchemaField {
    readonly kind = "schema";
  }
  class ArrayField {
    readonly kind = "array";
  }
  return {
    abstract: { TypeDataModel },
    data: {
      fields: { NumberField, StringField, BooleanField, SchemaField, ArrayField },
    },
    applications: {
      api: { HandlebarsApplicationMixin: (base) => base },
      apps: { DocumentSheetConfig: { registerSheet() {} } },
      sheets: { ActorSheetV2, ItemSheetV2 },
    },
  };
}
