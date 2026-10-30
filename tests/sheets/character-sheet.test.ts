import { describe, expect, it, vi } from "vitest";

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
    expect(context.derived.initiative).toBe(0);
    expect(context.initiativeText).toBe("+0");
    expect(context.items.weapons).toEqual([]);
  });

  it("displays existing actor data and embedded item calculations", () => {
    const context = prepareCharacterSheetContext(sampleActor());

    expect(context.derived.proficiencyBonus).toBe(3);
    expect(context.derived.armourClass.value).toBe(16);
    expect(context.derived.initiative).toBe(4);
    expect(context.initiativeText).toBe("+4");
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
    expect(baseline.abilityRows.find((row) => row.key === "dex")?.mod).toBe("+2");
    expect(boosted.abilityRows.find((row) => row.key === "dex")?.mod).toBe("+3");
    expect(baseline.skillRows.find((row) => row.id === "perception")?.total).toBe("+4");
    expect(boosted.skillRows.find((row) => row.id === "perception")?.total).toBe("+6");
    expect(boosted.derived.proficiencies.weapons.bows).toBe(true);
    expect(baseline.derived.initiative).toBe(4);
    expect(boosted.derived.initiative).toBe(5);
    expect(baseline.scoreSourceText).toBe("");
    expect(boosted.scoreSourceText).toBe("Score sources. Dex: base 14, Bow Training +2.");
    expect(baseline.skillRows.find((row) => row.id === "athletics")?.ability).toBe("Str");
    expect(baseline.skillRows.find((row) => row.id === "perception")?.ability).toBe("Wis");
  });

  it("lists body modifications apart from traits", () => {
    const actor = sampleActor();
    const withMods = {
      ...actor,
      items: [
        ...(Array.isArray(actor.items) ? actor.items : []),
        {
          id: "mod-1",
          name: "Gills",
          type: "feature",
          system: { category: "bodyModification" },
        },
        {
          id: "trait-1",
          name: "Darkvision",
          type: "feature",
          system: { category: "species" },
        },
      ],
    };
    const context = prepareCharacterSheetContext(withMods);
    expect(context.items.bodyModifications.map((item) => item.name)).toEqual(["Gills"]);
    expect(context.items.traits.map((item) => item.name)).toEqual(["Darkvision"]);
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

    expect(context.survivalStatus).toBe("alive");
    expect(context.survivalLabel).toBe("PIVOT.Survival.alive");
    expect(context.hpPercent).toBe(50);
    expect(context.poolPercent).toBe(20);
    expect(context.deathSaveSuccessPips).toEqual([false, false, false]);
    expect(context.deathSaveFailurePips).toEqual([false, false, false]);
  });

  it("shows alive after prepare when stored HP is positive and status is dying", () => {
    const actor = sampleActor();
    const context = prepareCharacterSheetContext({
      ...actor,
      system: {
        ...actor.system,
        attributes: {
          ...(actor.system.attributes as Record<string, unknown>),
          hp: { value: 10, max: 10, temp: 0 },
          deathSaves: { status: "dying", successes: 1, failures: 2 },
        },
      },
    });

    expect(context.survivalStatus).toBe("alive");
    expect(context.survivalLabel).toBe("PIVOT.Survival.alive");
    expect(context.deathSaveSuccessPips).toEqual([false, false, false]);
    expect(context.deathSaveFailurePips).toEqual([false, false, false]);
  });

  it("keeps zero HP dying, zero HP stable, and dead characters on the sheet", () => {
    const actor = sampleActor();
    const statusFor = (hp: number, status: string) =>
      prepareCharacterSheetContext({
        ...actor,
        system: {
          ...actor.system,
          attributes: {
            ...(actor.system.attributes as Record<string, unknown>),
            hp: { value: hp, max: 10, temp: 0 },
            deathSaves: { status, successes: 2, failures: 1 },
          },
        },
      }).survivalStatus;

    expect(statusFor(0, "dying")).toBe("dying");
    expect(statusFor(0, "stable")).toBe("stable");
    expect(statusFor(10, "dead")).toBe("dead");
    expect(statusFor(0, "dead")).toBe("dead");
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
    expect(createEmbeddedItemData("feature", "other")).toEqual({
      name: "New Trait",
      type: "feature",
      system: { category: "other" },
    });
  });

  it("passes a trait category through createItem and opens the new sheet", async () => {
    const created: unknown[] = [];
    let rendered = false;
    const SheetClass = createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          // eslint-disable-next-line @typescript-eslint/no-extraneous-class
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
          },
        },
      },
    } as never);
    const sheet = new SheetClass();
    Object.defineProperty(sheet, "document", {
      value: {
        async createEmbeddedDocuments(_type: string, data: unknown[]) {
          created.push(...data);
          return [{ sheet: { render: (force?: boolean) => (rendered = force === true) } }];
        },
      },
    });
    const createItem = (
      SheetClass as {
        DEFAULT_OPTIONS?: {
          actions?: {
            createItem?: (
              this: unknown,
              event: Event,
              target: { dataset: Record<string, string> },
            ) => Promise<void>;
          };
        };
      }
    ).DEFAULT_OPTIONS?.actions?.createItem;
    await createItem?.call(sheet, new Event("click"), {
      dataset: { type: "feature", category: "other" },
    });
    expect(created).toEqual([
      { name: "New Trait", type: "feature", system: { category: "other" } },
    ]);
    expect(rendered).toBe(true);
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

describe("D20 roll attachments for Dice So Nice!", () => {
  it("attaches pool roll with dice to ChatMessage.create", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-pool",
      ...(data as object),
    }));

    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      i18n: { localize: (key: string) => key },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "advantage") } } },
    });

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 15 }, { result: 8 }] }];
        async evaluate() {
          return this;
        }
        async render() {
          return "<div>18</div>";
        }
        constructor(public formula: string) {}
      },
    );

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        progression: { level: 5 },
        abilities: { str: { score: 16, primary: true } },
        skills: {},
      },
      items: [],
    };

    const { createPivotCharacterSheetClass, prepareCharacterSheetContext } =
      await import("../../src/sheets/character-sheet");

    prepareCharacterSheetContext(actor);

    const SheetClass = createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          // eslint-disable-next-line @typescript-eslint/no-extraneous-class
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
          },
        },
      },
    } as never);

    const sheet = new SheetClass();
    Object.defineProperty(sheet, "document", { value: actor, writable: true });

    const rollAction = (SheetClass as { DEFAULT_OPTIONS?: { actions?: { roll?: unknown } } })
      .DEFAULT_OPTIONS?.actions?.roll as (
      this: unknown,
      event: Event,
      target: { dataset: Record<string, string> },
    ) => Promise<void>;

    expect(rollAction).toBeTypeOf("function");
    await rollAction.call(
      sheet,
      new Event("click") as never,
      {
        dataset: { rollKind: "save", key: "str", label: "Strength Save" },
      } as never,
    );

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const messageData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const rolls = messageData.rolls as { formula?: string; dice?: unknown[] }[];
    expect(rolls).toBeDefined();
    expect(rolls.length).toBe(1);
    expect(rolls[0]?.formula).toBe("2d20");
    expect(rolls[0]?.dice).toBeDefined();
  });

  it("message content equals resultRoll.render() output", async () => {
    const renderedContent = "<div class='dice-roll'>Result: 18</div>";
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-render",
      ...(data as object),
    }));

    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      i18n: { localize: (key: string) => key },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {}),
      },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 15 }] }];
        async evaluate() {
          return this;
        }
        async render() {
          return renderedContent;
        }
        constructor(public formula: string) {}
      },
    );

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        progression: { level: 5 },
        abilities: { str: { score: 16, primary: true } },
        skills: {},
      },
      items: [],
    };

    const { createPivotCharacterSheetClass, prepareCharacterSheetContext } =
      await import("../../src/sheets/character-sheet");

    prepareCharacterSheetContext(actor);

    const SheetClass = createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          // eslint-disable-next-line @typescript-eslint/no-extraneous-class
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
          },
        },
      },
    } as never);

    const sheet = new SheetClass();
    Object.defineProperty(sheet, "document", { value: actor, writable: true });

    const rollAction = (SheetClass as { DEFAULT_OPTIONS?: { actions?: { roll?: unknown } } })
      .DEFAULT_OPTIONS?.actions?.roll as (
      this: unknown,
      event: Event,
      target: { dataset: Record<string, string> },
    ) => Promise<void>;

    expect(rollAction).toBeTypeOf("function");
    await rollAction.call(
      sheet,
      new Event("click") as never,
      {
        dataset: { rollKind: "save", key: "str", label: "Save" },
      } as never,
    );

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const messageData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(messageData.content).toBe(renderedContent);
  });
});

describe("character sheet edit toggle", () => {
  function sheetClass(ownerEditable: boolean) {
    return createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
            async _prepareContext() {
              return { editable: ownerEditable };
            }
          },
        },
      },
    } as never);
  }

  it("switches an owner between edit and view, and keeps a non-owner in view", async () => {
    type SheetInstance = {
      editorOpen?: boolean;
      document: ActorLike;
      render: () => void;
      _prepareContext: (options: Record<string, unknown>) => Promise<{
        editable: boolean;
        disabledAttr: string;
      }>;
    };
    const SheetClass = sheetClass(true);
    const sheet = new SheetClass() as SheetInstance;
    sheet.document = sampleActor();
    sheet.render = () => undefined;
    const toggle = (
      SheetClass as unknown as {
        DEFAULT_OPTIONS: { actions: { toggleEditMode: (this: SheetInstance) => void } };
      }
    ).DEFAULT_OPTIONS.actions.toggleEditMode;

    const editing = await sheet._prepareContext({});
    expect(editing.editable).toBe(true);
    expect(editing.disabledAttr).toBe("");

    toggle.call(sheet);
    const viewing = await sheet._prepareContext({});
    expect(sheet.editorOpen).toBe(false);
    expect(viewing.editable).toBe(false);
    expect(viewing.disabledAttr).toBe("disabled");

    toggle.call(sheet);
    const editingAgain = await sheet._prepareContext({});
    expect(editingAgain.editable).toBe(true);
    expect(editingAgain.disabledAttr).toBe("");

    const LockedSheet = sheetClass(false);
    const locked = new LockedSheet() as SheetInstance;
    locked.document = sampleActor();
    locked.render = () => undefined;
    const lockedToggle = (
      LockedSheet as unknown as {
        DEFAULT_OPTIONS: { actions: { toggleEditMode: (this: SheetInstance) => void } };
      }
    ).DEFAULT_OPTIONS.actions.toggleEditMode;
    lockedToggle.call(locked);
    lockedToggle.call(locked);
    const stillLocked = await locked._prepareContext({});
    expect(stillLocked.editable).toBe(false);
    expect(stillLocked.disabledAttr).toBe("disabled");
  });
});
describe("character sheet submit", () => {
  it("writes only fields that differ from the actor source", async () => {
    const { sheet, updates } = worldActorSheet();
    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        name: "Hera",
        "system.progression.level": 5,
        "system.attributes.hp.max": 28,
      },
    });

    expect(updates).toEqual([{ system: { progression: { level: 5 } } }]);
  });

  it("does not write a second sheet's unchanged fields over the shared source", async () => {
    const { sheet, updates } = worldActorSheet();
    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        name: "Renamed Hera",
        "system.progression.level": 4,
        "system.attributes.hp.max": 28,
      },
    });

    expect(updates).toEqual([{ name: "Renamed Hera" }]);
  });

  it("skips update when the form matches the actor source", async () => {
    const { sheet, updates } = worldActorSheet();
    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        name: "Hera",
        "system.progression.level": 4,
        "system.attributes.hp.max": 28,
      },
    });

    expect(updates).toEqual([]);
  });

  it("keeps stored specialization fields when academia or crafting text changes", async () => {
    const academia = [
      specializationEntry("History", {
        ability: "wis",
        proficient: false,
        deepening: 3,
        expertise: true,
        bonus: 2,
      }),
      specializationEntry("Theology", { deepening: 1, bonus: 4 }),
    ];
    const crafting = [
      specializationEntry("Smithing", {
        ability: "dex",
        deepening: 2,
        expertise: true,
        bonus: 5,
      }),
    ];
    const { sheet, updates } = worldActorSheet({
      skillSpecializations: { academia, crafting },
    });

    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        "system.skillSpecializations.academiaText": "History, Arcana",
        "system.skillSpecializations.craftingText": "Smithing, Alchemy",
      },
    });

    expect(updates).toEqual([
      {
        system: {
          skillSpecializations: {
            academia: [academia[0], specializationEntry("Arcana")],
            crafting: [crafting[0], specializationEntry("Alchemy")],
          },
        },
      },
    ]);
  });

  it("does not write academia or crafting when the submitted names match the source", async () => {
    const { sheet, updates } = worldActorSheet({
      skillSpecializations: {
        academia: [
          specializationEntry("History", {
            ability: "wis",
            proficient: false,
            deepening: 3,
            expertise: true,
            bonus: 2,
          }),
          specializationEntry("Theology", { deepening: 1, bonus: 4 }),
        ],
        crafting: [
          specializationEntry("Smithing", {
            ability: "dex",
            deepening: 2,
            expertise: true,
            bonus: 5,
          }),
        ],
      },
    });

    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        "system.skillSpecializations.academiaText": "History, Theology",
        "system.skillSpecializations.craftingText": "Smithing",
      },
    });

    expect(updates).toEqual([]);
  });

  it("keeps stored specialization fields when only the name casing changes", async () => {
    const history = {
      ability: "wis",
      proficient: false,
      deepening: 3,
      expertise: true,
      bonus: 2,
    };
    const smithing = {
      ability: "dex",
      deepening: 2,
      expertise: true,
      bonus: 5,
    };
    const { sheet, updates } = worldActorSheet({
      skillSpecializations: {
        academia: [specializationEntry("History", history)],
        crafting: [specializationEntry("Smithing", smithing)],
      },
    });

    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        "system.skillSpecializations.academiaText": "history",
        "system.skillSpecializations.craftingText": "smithing",
      },
    });

    expect(updates).toEqual([
      {
        system: {
          skillSpecializations: {
            academia: [specializationEntry("history", history)],
            crafting: [specializationEntry("smithing", smithing)],
          },
        },
      },
    ]);
  });

  it("matches a stored specialization name that has stray spaces", async () => {
    const history = {
      ability: "wis",
      proficient: false,
      deepening: 3,
      expertise: true,
      bonus: 2,
    };
    const smithing = {
      ability: "dex",
      deepening: 2,
      expertise: true,
      bonus: 5,
    };
    const { sheet, updates } = worldActorSheet({
      skillSpecializations: {
        academia: [specializationEntry("History ", history)],
        crafting: [specializationEntry("Smithing ", smithing)],
      },
    });

    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        "system.skillSpecializations.academiaText": "History",
        "system.skillSpecializations.craftingText": "Smithing",
      },
    });

    expect(updates).toEqual([
      {
        system: {
          skillSpecializations: {
            academia: [specializationEntry("History", history)],
            crafting: [specializationEntry("Smithing", smithing)],
          },
        },
      },
    ]);
  });

  it("keeps differing duplicate specialization entries in list order", async () => {
    const { sheet, updates } = worldActorSheet({
      skillSpecializations: {
        academia: [
          specializationEntry("History", { deepening: 3, expertise: true, bonus: 2 }),
          specializationEntry("History", { deepening: 1, bonus: 4, proficient: false }),
        ],
        crafting: [
          specializationEntry("Smithing", { ability: "dex", deepening: 2, expertise: true }),
          specializationEntry("Smithing", { ability: "str", bonus: 1, proficient: false }),
        ],
      },
    });

    await sheetClass().DEFAULT_OPTIONS.form.handler.call(sheet, click(), {} as HTMLFormElement, {
      object: {
        "system.skillSpecializations.academiaText": "History, History",
        "system.skillSpecializations.craftingText": "Smithing, Smithing",
      },
    });

    expect(updates).toEqual([]);
  });
});

function specializationEntry(
  name: string,
  fields: {
    ability?: string;
    proficient?: boolean;
    deepening?: number;
    expertise?: boolean;
    bonus?: number;
  } = {},
): Record<string, unknown> {
  return {
    name,
    ability: "int",
    proficient: true,
    deepening: 0,
    expertise: false,
    bonus: 0,
    ...fields,
  };
}

function worldActorSheet(extraSystem: Record<string, unknown> = {}) {
  const updates: Record<string, unknown>[] = [];
  const storedSystem = {
    progression: { level: 4 },
    attributes: { hp: { value: 12, max: 28 } },
    ...structuredClone(extraSystem),
  };
  const document = {
    name: "Hera",
    type: "character",
    token: null,
    system: {
      ...structuredClone(storedSystem),
      initiative: 3,
    },
    _source: {
      name: "Hera",
      system: storedSystem,
    },
    async update(data: Record<string, unknown>) {
      updates.push(structuredClone(data));
    },
  };
  const sheet = Object.assign(Object.create(sheetClass().prototype), { document });
  return { sheet, updates };
}

function click() {
  return { preventDefault() {} } as PointerEvent;
}

function sheetClass() {
  return createPivotCharacterSheetClass(sheetFoundry()) as unknown as {
    prototype: object;
    DEFAULT_OPTIONS: {
      form: {
        handler: (
          this: object,
          event: Event,
          form: HTMLFormElement,
          formData: { object?: Record<string, unknown> },
        ) => Promise<unknown>;
      };
    };
  };
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
