import { describe, expect, it } from "vitest";

import { createPivotCharacterDataModel } from "../../src/data/character-data";
import { createPivotItemDataModels } from "../../src/data/item-data";
import { createPivotNpcDataModel } from "../../src/data/npc-data";
import type { FoundryRuntime } from "../../src/foundry-runtime";

/**
 * Foundry's base `migrateData` runs every nested field's `migrateSource`. A model that overrides
 * `migrateData` without delegating silently skips those migrations, so each override must reach
 * the base. The base here stamps a sentinel to prove it ran.
 */
class BaseTypeDataModel {
  readonly parent?: unknown;
  static migrateData(source: Record<string, unknown>): Record<string, unknown> {
    return { ...source, baseMigrated: true };
  }
}

class Field {
  constructor(readonly options?: unknown) {}
}

function foundry(): FoundryRuntime {
  return {
    abstract: { TypeDataModel: BaseTypeDataModel },
    data: {
      fields: {
        NumberField: Field,
        StringField: Field,
        BooleanField: Field,
        SchemaField: Field,
        ArrayField: Field,
      },
    },
  } as unknown as FoundryRuntime;
}

type MigratableModel = { migrateData?: (source: Record<string, unknown>) => unknown };

function models(): Array<[string, MigratableModel]> {
  const runtime = foundry();
  const all: Array<[string, unknown]> = [
    ...Object.entries(createPivotItemDataModels(runtime)),
    ["character", createPivotCharacterDataModel(runtime)],
    ["npc", createPivotNpcDataModel(runtime)],
  ];
  return all as Array<[string, MigratableModel]>;
}

describe("data model migrateData", () => {
  it.each(models())("%s keeps the base migration when it overrides migrateData", (_name, model) => {
    expect(model.migrateData?.({})).toMatchObject({ baseMigrated: true });
  });
});
