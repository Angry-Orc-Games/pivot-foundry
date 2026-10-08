import { describe, expect, it } from "vitest";
import { createPivotCharacterDataModel } from "../../src/data/character-data";
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
  it("provides initiative in getRollData for combat tracker", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const model = new CharacterDataModel();

    // Set up parent with system data
    const mockParent = {
      system: {
        abilities: {
          dex: { score: 16 }, // +3 mod
        },
        attributes: {
          initiative: { bonus: 2 },
        },
      },
    };

    (model as { parent: unknown }).parent = mockParent;

    // Call prepareDerivedData (Foundry calls this during data preparation)
    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    // Get roll data
    const rollData =
      "getRollData" in model && typeof model.getRollData === "function" ? model.getRollData() : {};

    // Should provide initiative: dex mod (3) + bonus (2) = 5
    expect(rollData).toHaveProperty("initiative", 5);
  });

  it("calculates initiative with negative modifier", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const model = new CharacterDataModel();

    const mockParent = {
      system: {
        abilities: {
          dex: { score: 8 }, // -1 mod
        },
        attributes: {
          initiative: { bonus: 0 },
        },
      },
    };

    (model as { parent: unknown }).parent = mockParent;

    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    const rollData =
      "getRollData" in model && typeof model.getRollData === "function" ? model.getRollData() : {};

    expect(rollData).toHaveProperty("initiative", -1);
  });

  it("handles missing data gracefully", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const model = new CharacterDataModel();

    const mockParent = {
      system: {},
    };

    (model as { parent: unknown }).parent = mockParent;

    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    const rollData =
      "getRollData" in model && typeof model.getRollData === "function" ? model.getRollData() : {};

    // Should default to 0 when data is missing
    expect(rollData).toHaveProperty("initiative", 0);
  });
});
