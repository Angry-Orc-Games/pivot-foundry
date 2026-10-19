import { describe, expect, it } from "vitest";
import { createPivotCharacterDataModel } from "../../src/data/character-data";
import type { FoundryRuntime } from "../../src/foundry-runtime";

class MockField {
  _mock = true;
}

class MockTypeDataModel {
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
      HandlebarsApplicationMixin: ((base: unknown) =>
        base) as FoundryRuntime["applications"]["api"]["HandlebarsApplicationMixin"],
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

function prepare(attributes: Record<string, unknown>): Record<string, unknown> {
  const Model = createPivotCharacterDataModel(mockFoundryRuntime);
  const model = new Model() as {
    prepareDerivedData?: () => void;
    attributes?: Record<string, unknown>;
  };
  model.attributes = attributes;
  model.prepareDerivedData?.();
  return model.attributes ?? {};
}

describe("prepareDerivedData survival", () => {
  it("shows alive after prepare when stored HP is positive and status is dying", () => {
    const attributes = prepare({
      hp: { value: 10, max: 10, temp: 0 },
      deathSaves: { status: "dying", successes: 1, failures: 2 },
    });
    expect(attributes.deathSaves).toMatchObject({
      status: "alive",
      successes: 0,
      failures: 0,
    });
  });

  it("leaves zero HP dying, zero HP stable, and dead actors unchanged", () => {
    expect(
      prepare({
        hp: { value: 0, max: 10, temp: 0 },
        deathSaves: { status: "dying", successes: 2, failures: 1 },
      }).deathSaves,
    ).toMatchObject({ status: "dying", successes: 2, failures: 1 });
    expect(
      prepare({
        hp: { value: 0, max: 10, temp: 0 },
        deathSaves: { status: "stable", successes: 0, failures: 0 },
      }).deathSaves,
    ).toMatchObject({ status: "stable" });
    expect(
      prepare({
        hp: { value: 10, max: 10, temp: 0 },
        deathSaves: { status: "dead", successes: 0, failures: 3 },
      }).deathSaves,
    ).toMatchObject({ status: "dead", failures: 3 });
  });
});
