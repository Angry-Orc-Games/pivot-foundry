import { describe, expect, it } from "vitest";

import manifestJson from "../system.json";
import { createPivotCharacterDataModel } from "../src/data/character-data";
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

describe("Pivot item data models", () => {
  it("defines data models for repeatable sheet entities", () => {
    const { foundry } = createMockFoundry();
    const models = createPivotItemDataModels(foundry);
    const equipmentSchema = models.equipment.defineSchema() as Record<string, FieldRecord>;

    expect(Object.keys(models).sort()).toEqual([
      "armour",
      "equipment",
      "feature",
      "magicAbility",
      "magicStream",
      "weapon",
    ]);
    expect(models.weapon.defineSchema()).toHaveProperty("damage");
    expect(models.armour.defineSchema()).toHaveProperty("equipped");
    expect(equipmentSchema).toHaveProperty("quantity");
    expect(equipmentSchema.quantity?.options).toMatchObject({ integer: true });
  });
});

describe("registerPivotFantasySystem", () => {
  it("registers data models, token resources, and v13 document sheets during init", () => {
    const { foundry, registeredSheets } = createMockFoundry();
    const callbacks: Array<() => void> = [];
    const CONFIG = {
      Actor: { dataModels: {}, trackableAttributes: {} },
      Item: { dataModels: {} },
    };

    registerPivotFantasySystem({
      Hooks: {
        once(event, callback) {
          expect(event).toBe("init");
          callbacks.push(callback);
        },
      },
      CONFIG,
      foundry,
    });

    callbacks[0]?.();

    expect(CONFIG.Actor.dataModels).toHaveProperty("character");
    expect(CONFIG.Item.dataModels).toHaveProperty("weapon");
    expect(CONFIG.Item.dataModels).toHaveProperty("magicAbility");
    expect(CONFIG.Actor.trackableAttributes).toEqual({
      character: {
        bar: ["attributes.hp", "resources.pool", "magic.mp"],
        value: ["progression.xp", "progression.level"],
      },
    });
    expect(registeredSheets).toHaveLength(2);
    const actorSheetClass = (registeredSheets[0] as unknown[])[2] as {
      DEFAULT_OPTIONS?: { actions?: Record<string, unknown> };
    };
    expect(actorSheetClass.DEFAULT_OPTIONS?.actions).toHaveProperty("openItem");
  });
});
