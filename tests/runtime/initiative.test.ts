import { describe, expect, it } from "vitest";
import { createPivotCharacterDataModel } from "../../src/data/character-data";
import { createPivotNpcDataModel } from "../../src/data/npc-data";
import type { FoundryRuntime } from "../../src/foundry-runtime";

// Mock Foundry field constructors
class MockField {
  _mock = true;
}

class MockTypeDataModel {
  parent?: unknown;
}

// Mock Foundry runtime
const mockFoundryRuntime: FoundryRuntime = {
  abstract: {
    TypeDataModel: MockTypeDataModel as unknown as new (...args: never[]) => object,
  },
  data: {
    fields: {
      NumberField: MockField as unknown as new (options?: Record<string, unknown>) => object,
      StringField: MockField as unknown as new (options?: Record<string, unknown>) => object,
      BooleanField: MockField as unknown as new (options?: Record<string, unknown>) => object,
      SchemaField: MockField as unknown as new (fields: Record<string, object>) => object,
      ArrayField: MockField as unknown as new (field: object) => object,
    },
  },
  applications: {
    api: {
      HandlebarsApplicationMixin: ((base: unknown) => base) as (
        base: new (...args: never[]) => object,
      ) => new (...args: never[]) => object,
    },
    apps: {
      DocumentSheetConfig: {
        registerSheet: () => {},
      },
    },
    sheets: {
      ActorSheetV2: MockTypeDataModel as unknown as new (...args: never[]) => object,
      ItemSheetV2: MockTypeDataModel as unknown as new (...args: never[]) => object,
    },
  },
};

describe("Character initiative integration", () => {
  it("sets initiative field during prepareDerivedData", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const model = new CharacterDataModel();

    // Set up data directly on model (TypeDataModel IS the system data)
    const modelAsRecord = model as unknown as Record<string, unknown>;
    modelAsRecord.abilities = {
      dex: { score: 16 }, // +3 mod
    };
    modelAsRecord.attributes = {
      initiative: { bonus: 2 },
    };

    // Call prepareDerivedData (Foundry calls this during data preparation)
    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    // Check initiative field directly (actor.getRollData() returns actor.system)
    expect(model).toHaveProperty("initiative", 5); // dex mod (3) + bonus (2)
  });

  it("calculates initiative with negative modifier", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const model = new CharacterDataModel();

    const modelAsRecord = model as unknown as Record<string, unknown>;
    modelAsRecord.abilities = {
      dex: { score: 8 }, // -1 mod
    };
    modelAsRecord.attributes = {
      initiative: { bonus: 0 },
    };

    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    expect(model).toHaveProperty("initiative", -1);
  });

  it("handles missing data gracefully", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const model = new CharacterDataModel();

    // Leave model empty (no abilities/attributes set)

    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    // Should default to 0 when data is missing
    expect(model).toHaveProperty("initiative", 0);
  });
});

describe("NPC initiative integration", () => {
  it("has initiative field set to 0", () => {
    const NpcDataModel = createPivotNpcDataModel(mockFoundryRuntime);
    const model = new NpcDataModel();

    // NPC initiative rules not yet implemented (UC-003 non-goal)
    // initiative field defaults to 0 to prevent crashes when NPCs are in combat
    expect(model).toHaveProperty("initiative", 0);
  });
});
