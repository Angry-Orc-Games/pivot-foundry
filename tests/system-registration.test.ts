import { describe, expect, it } from "vitest";

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
});
