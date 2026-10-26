import { describe, expect, it } from "vitest";

import { createPivotCharacterDataModel } from "../../src/data/character-data";
import type { FoundryRuntime } from "../../src/foundry-runtime";

class MockField {
  _mock = true;
}

class MockTypeDataModel {
  parent?: unknown;
  prepareDerivedData?(): void {}
}

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

function awakenedMagic(value: number, maxBonus = 0) {
  return {
    progression: { level: 1 },
    abilities: {
      str: { score: 10 },
      dex: { score: 10 },
      con: { score: 10 },
      int: { score: 10 },
      wis: { score: 10 },
      cha: { score: 10 },
    },
    magic: {
      awakened: true,
      ability: "int",
      mp: { value, maxBonus },
    },
  };
}

describe("displayed current MP", () => {
  it("never shows current MP above max, including before the stored value is fixed", () => {
    const CharacterData = createPivotCharacterDataModel(mockFoundryRuntime);

    const overMax = new CharacterData() as {
      prepareDerivedData(): void;
      magic: { mp: { value: number } };
    };
    Object.assign(overMax, awakenedMagic(12, 3));
    overMax.prepareDerivedData();
    expect(overMax.magic.mp.value).toBe(8);

    const quench = new CharacterData() as {
      prepareDerivedData(): void;
      magic: { mp: { value: number } };
    };
    Object.assign(quench, {
      magic: { awakened: false, ability: null, mp: { value: 2, maxBonus: 0 } },
    });
    quench.prepareDerivedData();
    expect(quench.magic.mp.value).toBe(0);

    const within = new CharacterData() as {
      prepareDerivedData(): void;
      magic: { mp: { value: number } };
    };
    Object.assign(within, awakenedMagic(4, 3));
    within.prepareDerivedData();
    expect(within.magic.mp.value).toBe(4);

    const withItem = new CharacterData() as {
      prepareDerivedData(): void;
      parent?: unknown;
      magic: { mp: { value: number } };
    };
    Object.assign(withItem, awakenedMagic(20));
    withItem.parent = {
      items: [{ system: { effects: [{ type: "mpMaxBonus", amount: 3 }] } }],
    };
    withItem.prepareDerivedData();
    expect(withItem.magic.mp.value).toBe(8);
  });
});
