import { describe, expect, it } from "vitest";
import { createPivotCharacterDataModel } from "../../src/data/character-data";
import type { FoundryRuntime } from "../../src/foundry-runtime";
import { initializeSurvival } from "../../src/migrations/m002";
import { abilityModifier } from "../../src/rules/modifiers";
import { prepareCharacterSheetContext } from "../../src/sheets/character-sheet";

class NumberField {
  constructor(private readonly options: { initial?: unknown } = {}) {}
  initialValue(): unknown {
    return this.options.initial;
  }
}

class StringField {
  constructor(private readonly options: { initial?: unknown } = {}) {}
  initialValue(): unknown {
    return this.options.initial;
  }
}

class BooleanField {
  constructor(private readonly options: { initial?: unknown } = {}) {}
  initialValue(): unknown {
    return this.options.initial;
  }
}

class SchemaField {
  constructor(private readonly fields: Record<string, { initialValue(): unknown }>) {}
  initialValue(): unknown {
    return Object.fromEntries(
      Object.entries(this.fields).map(([key, field]) => [key, field.initialValue()]),
    );
  }
}

class ArrayField {
  initialValue(): unknown {
    return [];
  }
}

class MockTypeDataModel {
  prepareDerivedData?(): void {}
}

const foundryRuntime = {
  abstract: { TypeDataModel: MockTypeDataModel },
  data: {
    fields: { NumberField, StringField, BooleanField, SchemaField, ArrayField },
  },
} as unknown as FoundryRuntime;

function applyActorUpdate(system: Record<string, unknown>, data: Record<string, unknown>): void {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let cursor: Record<string, unknown> = { system };
    for (const part of parts.slice(0, -1)) {
      const next = cursor[part];
      if (!next || typeof next !== "object") {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    if (leaf) cursor[leaf] = value;
  }
}

function freshCharacterSheet(stats?: { hitDie: string; constitution: number }) {
  const Model = createPivotCharacterDataModel(foundryRuntime);
  const schema = Model.defineSchema() as unknown as Record<string, { initialValue(): unknown }>;
  const system = Object.fromEntries(
    Object.entries(schema).map(([key, field]) => [key, field.initialValue()]),
  );
  if (stats) {
    const abilities = system.abilities as { con: { score: number } };
    const attributes = system.attributes as { hitDie: string };
    abilities.con.score = stats.constitution;
    attributes.hitDie = stats.hitDie;
  }
  const actor = {
    name: "New",
    type: "character" as const,
    system,
    updateSource(data: Record<string, unknown>) {
      applyActorUpdate(system, data);
    },
  };
  initializeSurvival(actor);
  const model = Object.assign(new Model(), system) as {
    prepareDerivedData(): void;
  };
  model.prepareDerivedData();
  return prepareCharacterSheetContext({
    name: actor.name,
    type: actor.type,
    system: model as unknown as Record<string, unknown>,
    items: [],
  });
}

function hitPointsFromStats(hitDie: string, constitution: number): number {
  return Number(hitDie.slice(1)) + abilityModifier(constitution);
}

describe("fresh Foundry character", () => {
  it("shows full hit points from the default hit die and Constitution, and is conscious", () => {
    const context = freshCharacterSheet();
    const hp = (context.system as { attributes: { hp: { value: number; max: number } } }).attributes
      .hp;
    const expected = hitPointsFromStats("d8", 10);

    expect({
      status: context.survivalStatus,
      label: context.survivalLabel,
      hp: `${hp.value} / ${hp.max}`,
      hpPercent: context.hpPercent,
    }).toEqual({
      status: "alive",
      label: "PIVOT.Survival.alive",
      hp: `${expected} / ${expected}`,
      hpPercent: 100,
    });
  });

  it("uses a chosen hit die and Constitution when HP was never set", () => {
    const context = freshCharacterSheet({ hitDie: "d10", constitution: 14 });
    const hp = (context.system as { attributes: { hp: { value: number; max: number } } }).attributes
      .hp;

    expect(hitPointsFromStats("d10", 14)).toBe(12);
    expect({
      status: context.survivalStatus,
      hp: `${hp.value} / ${hp.max}`,
    }).toEqual({ status: "alive", hp: "12 / 12" });
  });
});
