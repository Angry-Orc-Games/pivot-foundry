import { describe, expect, it } from "vitest";
import { createPivotCharacterDataModel } from "../../src/data/character-data";
import { createPivotNpcDataModel } from "../../src/data/npc-data";
import { registerPivotFantasySystem } from "../../src/pivot";
import type { FoundryRuntime, FoundryConfig, FoundryHooks } from "../../src/foundry-runtime";

// Mock Foundry field constructors
class MockField {
  _mock = true;
}

class MockTypeDataModel {
  parent?: unknown;
  prepareDerivedData?(): void {}
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
      dex: { score: 16 }, // +3 mod via abilityModifier
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
      dex: { score: 8 }, // -1 mod via abilityModifier
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
  it("uses combatBonuses.physical for initiative", () => {
    const NpcDataModel = createPivotNpcDataModel(mockFoundryRuntime);
    const model = new NpcDataModel();

    const modelAsRecord = model as unknown as Record<string, unknown>;
    modelAsRecord.combatBonuses = {
      physical: 3, // Base Bonus + traits
    };

    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    // Per rulebook: "GM rolls for monsters and adds in their Base Bonus"
    // Assumption pending Dan: NPC initiative = physical bonus
    expect(model).toHaveProperty("initiative", 3);
  });

  it("defaults to 0 when combatBonuses missing", () => {
    const NpcDataModel = createPivotNpcDataModel(mockFoundryRuntime);
    const model = new NpcDataModel();

    if ("prepareDerivedData" in model && typeof model.prepareDerivedData === "function") {
      model.prepareDerivedData();
    }

    expect(model).toHaveProperty("initiative", 0);
  });
});

describe("Initiative formula regression (reproduces a780cf5 bug)", () => {
  it("CONFIG.Combat.initiative is set after system registration", () => {
    // Mock hooks and config for registration
    const hooks: FoundryHooks = {
      once: (event: "init" | "ready", callback: () => void) => {
        if (event === "init") {
          // Immediately fire init hook for test
          callback();
        }
      },
    };

    const config: FoundryConfig = {
      Actor: {
        dataModels: {},
      },
      Item: {
        dataModels: {},
      },
    };

    // Register system
    registerPivotFantasySystem({
      Hooks: hooks,
      CONFIG: config,
      foundry: mockFoundryRuntime,
      ActorDocument: undefined,
      ItemDocument: undefined,
    });

    // Reproduce Foundry v14 Combat#_getInitiativeFormula behavior
    const configWithCombat = config as typeof config & {
      Combat?: { initiative?: { formula?: string } | string };
    };
    const gameSystem = { initiative: undefined };
    const resolvedFormula = String(
      configWithCombat.Combat?.initiative && typeof configWithCombat.Combat.initiative === "object"
        ? configWithCombat.Combat.initiative.formula
        : configWithCombat.Combat?.initiative || gameSystem.initiative,
    );

    // On a780cf5, this would be "undefined"
    expect(resolvedFormula).not.toBe("undefined");
    expect(resolvedFormula).toBe("1d20 + @initiative");
  });

  it("formula resolves to numeric expression for character", () => {
    const CharacterDataModel = createPivotCharacterDataModel(mockFoundryRuntime);
    const system = new CharacterDataModel();

    const systemAsRecord = system as unknown as Record<string, unknown>;
    systemAsRecord.abilities = { dex: { score: 14 } }; // +2
    systemAsRecord.attributes = { initiative: { bonus: 1 } };

    if ("prepareDerivedData" in system && typeof system.prepareDerivedData === "function") {
      system.prepareDerivedData();
    }

    // Simulate actor.getRollData() = actor.system
    const rollData = system as unknown as Record<string, unknown>;

    // Formula "1d20 + @initiative" with @initiative = 3
    expect(rollData.initiative).toBe(3);
    expect(typeof rollData.initiative).toBe("number");

    // When Foundry substitutes @initiative, it becomes "1d20 + 3" (numeric)
    const substituted = `1d20 + ${rollData.initiative}`;
    expect(substituted).toBe("1d20 + 3");
  });

  it("formula resolves to numeric expression for NPC", () => {
    const NpcDataModel = createPivotNpcDataModel(mockFoundryRuntime);
    const system = new NpcDataModel();

    const systemAsRecord = system as unknown as Record<string, unknown>;
    systemAsRecord.combatBonuses = { physical: 2 };

    if ("prepareDerivedData" in system && typeof system.prepareDerivedData === "function") {
      system.prepareDerivedData();
    }

    // Simulate actor.getRollData() = actor.system
    const rollData = system as unknown as Record<string, unknown>;

    // Formula "1d20 + @initiative" with @initiative = 2
    expect(rollData.initiative).toBe(2);
    expect(typeof rollData.initiative).toBe("number");

    const substituted = `1d20 + ${rollData.initiative}`;
    expect(substituted).toBe("1d20 + 2");
  });
});
