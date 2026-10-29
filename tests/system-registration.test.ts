import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import manifestJson from "../system.json";
import { createPivotCharacterDataModel } from "../src/data/character-data";
import { createPivotNpcDataModel } from "../src/data/npc-data";
import { createPivotItemDataModels } from "../src/data/item-data";
import { registerPivotFantasySystem } from "../src/pivot";

type FieldRecord = {
  kind?: string;
  options?: unknown;
  fields?: Record<string, FieldRecord>;
  inner?: FieldRecord;
};

class BaseTypeDataModel {
  readonly parent?: unknown;
}

function createMockFoundry() {
  class NumberField {
    readonly kind = "number";
    constructor(readonly options?: unknown) {}
  }
  class StringField {
    readonly kind = "string";
    constructor(readonly options?: unknown) {}
  }
  class BooleanField {
    readonly kind = "boolean";
    constructor(readonly options?: unknown) {}
  }
  class SchemaField {
    readonly kind = "schema";
    constructor(readonly fields: Record<string, FieldRecord>) {}
  }
  class ArrayField {
    readonly kind = "array";
    constructor(readonly inner: FieldRecord) {}
  }

  const registeredSheets: unknown[] = [];

  return {
    registeredSheets,
    foundry: {
      abstract: { TypeDataModel: BaseTypeDataModel },
      data: { fields: { NumberField, StringField, BooleanField, SchemaField, ArrayField } },
      applications: {
        api: {
          HandlebarsApplicationMixin: (base: typeof BaseTypeDataModel) => base,
        },
        apps: {
          DocumentSheetConfig: {
            registerSheet: (...args: unknown[]) => registeredSheets.push(args),
          },
        },
        sheets: {
          ActorSheetV2: class {
            readonly mockSheet = "actor";
          },
          ItemSheetV2: class {
            readonly mockSheet = "item";
          },
        },
      },
    },
  };
}

describe("system manifest", () => {
  it("declares Pivot Fantasy character and item document types", () => {
    expect(manifestJson.documentTypes?.Actor).toHaveProperty("character");
    expect(manifestJson.documentTypes?.Actor).toHaveProperty("npc");
    expect(manifestJson.documentTypes?.Item).toMatchObject({
      weapon: {},
      armour: {},
      equipment: {},
      feature: {},
      magicStream: {},
      magicAbility: {},
    });
    expect(manifestJson.styles).toContain("styles/pivot-fantasy.css");
  });
});

describe("PivotCharacterData", () => {
  it("defines source fields for the approved character sheet sections", () => {
    const { foundry } = createMockFoundry();
    const CharacterData = createPivotCharacterDataModel(foundry);
    const schema = CharacterData.defineSchema();

    expect(schema).toHaveProperty("schemaVersion");
    expect(schema).toHaveProperty("identity");
    expect(schema).toHaveProperty("progression");
    expect(schema).toHaveProperty("abilities");
    expect(schema).toHaveProperty("attributes");
    expect(schema).toHaveProperty("resources");
    expect(schema).toHaveProperty("skills");
    expect(schema).toHaveProperty("proficiencies");
    expect(schema).toHaveProperty("currency");
    expect(schema).toHaveProperty("magic");
    expect(schema).toHaveProperty("notes");
  });
});

describe("PivotNpcData", () => {
  it("defines source fields for NPC sheet including tier, creature type, overlay, HP, AC, Speed, combat bonuses, CR, and biography", () => {
    const { foundry } = createMockFoundry();
    const NpcData = createPivotNpcDataModel(foundry);
    const schema = NpcData.defineSchema() as Record<string, FieldRecord>;

    expect(schema).toHaveProperty("schemaVersion");
    expect(schema).toHaveProperty("tier");
    expect(schema).toHaveProperty("creatureType");
    expect(schema).toHaveProperty("overlay");
    expect(schema).toHaveProperty("attributes");
    expect(schema).toHaveProperty("combatBonuses");
    expect(schema).toHaveProperty("cr");
    expect(schema).toHaveProperty("biography");

    const attributes = schema.attributes as FieldRecord;
    expect(attributes.fields).toHaveProperty("hp");
    expect(attributes.fields).toHaveProperty("ac");
    expect(attributes.fields).toHaveProperty("speed");

    const combatBonuses = schema.combatBonuses as FieldRecord;
    expect(combatBonuses.fields).toHaveProperty("physical");
    expect(combatBonuses.fields).toHaveProperty("intellectual");
  });
});

describe("Pivot item data models", () => {
  it("defines data models for repeatable sheet entities", () => {
    const { foundry } = createMockFoundry();
    const models = createPivotItemDataModels(foundry);
    const equipmentSchema = models.equipment.defineSchema() as Record<string, FieldRecord>;
    const featureSchema = models.feature.defineSchema() as Record<string, FieldRecord>;

    expect(Object.keys(models).sort()).toEqual([
      "armour",
      "equipment",
      "feature",
      "magicAbility",
      "magicStream",
      "weapon",
    ]);
    expect(models.weapon.defineSchema()).toHaveProperty("damage");
    expect(models.weapon.defineSchema()).toHaveProperty("schemaVersion");
    expect(models.weapon.defineSchema()).toHaveProperty("effects");
    expect(models.armour.defineSchema()).toHaveProperty("equipped");
    expect(equipmentSchema).toHaveProperty("quantity");
    expect(equipmentSchema.quantity?.options).toMatchObject({ integer: true });
    expect(featureSchema).toHaveProperty("effects");
    expect(featureSchema.effects?.kind).toBe("array");
  });
});

describe("registerPivotFantasySystem", () => {
  it("registers data models, token resources, and v14 document sheets during init", () => {
    const { foundry, registeredSheets } = createMockFoundry();
    const hooks = new Map<string, () => void>();
    const CONFIG = {
      Actor: { dataModels: {}, trackableAttributes: {} },
      Item: { dataModels: {} },
    };

    registerPivotFantasySystem({
      Hooks: {
        once(event, callback) {
          hooks.set(event, callback);
        },
      },
      CONFIG,
      foundry,
    });

    expect(hooks.has("init")).toBe(true);
    expect(hooks.has("ready")).toBe(true);
    hooks.get("init")?.();

    expect(CONFIG.Actor.dataModels).toHaveProperty("character");
    expect(CONFIG.Item.dataModels).toHaveProperty("weapon");
    expect(CONFIG.Item.dataModels).toHaveProperty("magicAbility");
    expect(CONFIG.Actor.trackableAttributes).toEqual({
      character: {
        bar: ["attributes.hp", "resources.pool", "magic.mp"],
        value: ["progression.xp", "progression.level"],
      },
      npc: {
        bar: ["attributes.hp"],
        value: [],
      },
    });
    expect(registeredSheets).toHaveLength(3);
    const characterSheetClass = (registeredSheets[0] as unknown[])[2] as {
      DEFAULT_OPTIONS?: { actions?: Record<string, unknown> };
    };
    expect(characterSheetClass.DEFAULT_OPTIONS?.actions).toHaveProperty("openItem");

    const npcSheetClass = (registeredSheets[1] as unknown[])[2] as {
      DEFAULT_OPTIONS?: { actions?: Record<string, unknown> };
    };
    expect(npcSheetClass.DEFAULT_OPTIONS?.actions).toHaveProperty("editItem");
  });

  it("links the prototype token of a new character and leaves other types alone", () => {
    const { foundry } = createMockFoundry();
    const listeners: Array<
      (
        actor: {
          type?: string;
          system?: unknown;
          updateSource?: (data: Record<string, unknown>) => unknown;
        },
        data?: unknown,
      ) => void
    > = [];

    registerPivotFantasySystem({
      Hooks: {
        on(event, callback) {
          if (event === "preCreateActor") listeners.push(callback as (typeof listeners)[number]);
        },
        once() {},
      },
      CONFIG: {
        Actor: { dataModels: {}, trackableAttributes: {} },
        Item: { dataModels: {} },
      },
      foundry,
    });

    const updateSource = vi.fn();
    const character = {
      type: "character",
      system: { survivalVersion: 1 },
      token: null,
      updateSource,
    };
    for (const listener of listeners) listener(character);
    expect(updateSource).toHaveBeenCalledWith({ "prototypeToken.actorLink": true });

    updateSource.mockClear();
    for (const listener of listeners) listener({ type: "npc", updateSource });
    expect(updateSource).not.toHaveBeenCalled();

    updateSource.mockClear();
    for (const listener of listeners) {
      listener(character, { prototypeToken: { actorLink: false } });
    }
    expect(updateSource).not.toHaveBeenCalled();
  });
});

describe("preCreateActor actorLink", () => {
  let restoreFoundry: () => void;

  beforeEach(() => {
    restoreFoundry = installFoundryV14PropertyUtils();
  });

  afterEach(() => {
    restoreFoundry();
  });

  it("keeps a flat prototypeToken.actorLink of false", () => {
    const updateSource = runPreCreateActor({ "prototypeToken.actorLink": false });
    expect(updateSource).not.toHaveBeenCalled();
  });

  it("keeps a nested prototypeToken.actorLink of false", () => {
    const updateSource = runPreCreateActor({ prototypeToken: { actorLink: false } });
    expect(updateSource).not.toHaveBeenCalled();
  });

  it("keeps a flat prototypeToken.actorLink of true", () => {
    const updateSource = runPreCreateActor({ "prototypeToken.actorLink": true });
    expect(updateSource).not.toHaveBeenCalled();
  });

  it("links a character when creation data omits actorLink", () => {
    const updateSource = runPreCreateActor(undefined);
    expect(updateSource).toHaveBeenCalledWith({ "prototypeToken.actorLink": true });
  });
});

function runPreCreateActor(data: unknown): ReturnType<typeof vi.fn> {
  const { foundry } = createMockFoundry();
  const listeners: Array<
    (actor: { type?: string; updateSource?: (data: unknown) => unknown }, data?: unknown) => void
  > = [];
  registerPivotFantasySystem({
    Hooks: {
      on(event, callback) {
        if (event === "preCreateActor") listeners.push(callback as (typeof listeners)[number]);
      },
      once() {},
    },
    CONFIG: {
      Actor: { dataModels: {}, trackableAttributes: {} },
      Item: { dataModels: {} },
    },
    foundry,
  });
  const updateSource = vi.fn();
  const character = {
    type: "character",
    system: { survivalVersion: 1 },
    token: null,
    updateSource,
  };
  for (const listener of listeners) listener(character, data);
  return updateSource;
}

function installFoundryV14PropertyUtils(): () => void {
  const host = globalThis as { foundry?: { utils?: object } };
  const previous = host.foundry;
  host.foundry = {
    utils: {
      hasProperty: foundryV14HasProperty,
      expandObject: foundryV14ExpandObject,
    },
  };
  return () => {
    if (previous === undefined) delete host.foundry;
    else host.foundry = previous;
  };
}

function foundryV14HasProperty(object: object, key: string): boolean {
  let current: unknown = object;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null || !(part in current)) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

function foundryV14ExpandObject(obj: object): object {
  const expanded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const nested = isPlainRecord(value) ? foundryV14ExpandObject(value) : value;
    assignDottedKey(expanded, key, nested);
  }
  return expanded;
}

function assignDottedKey(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!isPlainRecord(next)) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  const leaf = parts.at(-1);
  if (leaf) current[leaf] = value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
