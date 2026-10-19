import { describe, expect, it } from "vitest";

import { createPivotItemDataModels } from "../../src/data/item-data";

type EchelonField = {
  kind?: string;
  options?: {
    initial?: unknown;
    choices?: unknown;
    validate?: (value: unknown) => boolean;
  };
};

class BaseTypeDataModel {
  readonly parent?: unknown;
}

function foundry() {
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
    constructor(readonly fields: Record<string, EchelonField>) {}
  }
  class ArrayField {
    readonly kind = "array";
    constructor(readonly inner: EchelonField) {}
  }

  return {
    abstract: { TypeDataModel: BaseTypeDataModel },
    data: { fields: { NumberField, StringField, BooleanField, SchemaField, ArrayField } },
    applications: {
      api: { HandlebarsApplicationMixin: (base: typeof BaseTypeDataModel) => base },
      apps: { DocumentSheetConfig: { registerSheet: () => undefined } },
      sheets: {
        ActorSheetV2: class {
          readonly mockSheet = "actor";
        },
        ItemSheetV2: class {
          readonly mockSheet = "item";
        },
      },
    },
  };
}

function echelonField(type: "magicAbility" | "magicStream"): EchelonField {
  const models = createPivotItemDataModels(foundry());
  return models[type].defineSchema().echelon as EchelonField;
}

describe("magic echelon data model", () => {
  it("accepts Core and 1 through 5 and rejects every other value", () => {
    for (const type of ["magicAbility", "magicStream"] as const) {
      const field = echelonField(type);
      expect(field.kind).toBe("string");
      expect(field.options?.initial).toBe("core");
      expect(field.options?.choices).toEqual(["core", "1", "2", "3", "4", "5"]);
      const validate = field.options?.validate;
      expect(validate).toEqual(expect.any(Function));
      for (const value of ["core", "Core", "CORE", 1, 2, 3, 4, 5, "5"]) {
        expect(validate?.(value)).toBe(true);
      }
      for (const value of [0, 6, -1, 1.5, "foo"]) {
        expect(validate?.(value)).toBe(false);
      }
    }
  });
});
