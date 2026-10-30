import { describe, expect, it, vi } from "vitest";

import { createPivotCharacterDataModel } from "../../src/data/character-data";
import { createPivotItemDataModels } from "../../src/data/item-data";
import { createPivotNpcDataModel } from "../../src/data/npc-data";
import type { FoundryRuntime } from "../../src/foundry-runtime";
import {
  planActorMigration,
  planItemMigration,
  type MigrationPlan,
} from "../../src/migrations/m001";
import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
import { registerPivotFantasySystem } from "../../src/pivot";
import { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION } from "../../src/rules/schema-version";

type VersionedPlanner = (
  storedSystem: unknown,
  options?: { currentVersion?: number },
) => MigrationPlan;

class NumberField {
  constructor(readonly options?: { initial?: number }) {}
}
class StringField {
  constructor(readonly options?: unknown) {}
}
class BooleanField {
  constructor(readonly options?: unknown) {}
}
class SchemaField {
  constructor(readonly fields?: unknown) {}
}
class ArrayField {
  constructor(readonly inner?: unknown) {}
}

function mockFoundry(): FoundryRuntime {
  return {
    abstract: {
      TypeDataModel: class {
        readonly model = "type";
      },
    },
    data: {
      fields: { NumberField, StringField, BooleanField, SchemaField, ArrayField },
    },
    applications: {
      api: { HandlebarsApplicationMixin: (base) => base },
      apps: { DocumentSheetConfig: { registerSheet() {} } },
      sheets: {
        ActorSheetV2: class {
          readonly mockSheet = "actor";
        },
        ItemSheetV2: class {
          readonly mockSheet = "item";
        },
      },
    },
  } as FoundryRuntime;
}

function fieldInitial(field: unknown): number {
  const initial = (field as { options?: { initial?: number } }).options?.initial;
  if (typeof initial !== "number") {
    throw new Error("schemaVersion field has no numeric initial");
  }
  return initial;
}

function modelInitials(): { character: number; npc: number; weapon: number } {
  const foundry = mockFoundry();
  return {
    character: fieldInitial(createPivotCharacterDataModel(foundry).defineSchema().schemaVersion),
    npc: fieldInitial(createPivotNpcDataModel(foundry).defineSchema().schemaVersion),
    weapon: fieldInitial(createPivotItemDataModels(foundry).weapon.defineSchema().schemaVersion),
  };
}

function planActor(storedSystem: unknown, currentVersion: number): MigrationPlan {
  return (planActorMigration as VersionedPlanner)(storedSystem, { currentVersion });
}

function planItem(storedSystem: unknown, currentVersion: number): MigrationPlan {
  return (planItemMigration as VersionedPlanner)(storedSystem, { currentVersion });
}

describe("schemaVersion model default", () => {
  it("uses the legacy sentinel so a missing stamp is not the current version", () => {
    expect(modelInitials()).toEqual({
      character: LEGACY_SCHEMA_VERSION,
      npc: LEGACY_SCHEMA_VERSION,
      weapon: LEGACY_SCHEMA_VERSION,
    });
    expect(LEGACY_SCHEMA_VERSION).not.toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe.each([1, 2])("unstamped documents when the current schema version is %s", (current) => {
  it("migrates the model default instead of skipping it", () => {
    const initial = modelInitials();
    expect(planActor({ schemaVersion: initial.character }, current)).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": current },
    });
    expect(planActor({ schemaVersion: initial.npc }, current)).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": current },
    });
    expect(planItem({ notes: "axe", schemaVersion: initial.weapon }, current)).toEqual({
      ok: true,
      changed: true,
      update: {
        "system.schemaVersion": current,
        "system.effects": [],
      },
    });
  });

  it("leaves a document already stamped at that version untouched", () => {
    expect(planActor({ schemaVersion: current, notes: { special: "" } }, current)).toEqual({
      ok: true,
      changed: false,
    });
    expect(planItem({ schemaVersion: current, effects: [] }, current)).toEqual({
      ok: true,
      changed: false,
    });
  });
});

describe("version 1 to version 2", () => {
  it("migrates an unstamped document and an explicit version 1 document when current is 2", () => {
    const initial = modelInitials();
    expect(planActor({ schemaVersion: initial.character }, 2)).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": 2 },
    });
    expect(planActor({ schemaVersion: 1 }, 2)).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": 2 },
    });
    expect(planActor({ schemaVersion: 2 }, 2)).toEqual({ ok: true, changed: false });
  });
});

describe("persisted M001 stamp", () => {
  it("writes schemaVersion for an actor and embedded item filled with the model default", async () => {
    const initial = modelInitials();
    const worldItem = trackedDocument("World Axe", { schemaVersion: initial.weapon });
    const embedded = trackedDocument("Embedded Axe", { schemaVersion: initial.weapon });
    const actor = trackedDocument(
      "Legacy",
      { schemaVersion: initial.character },
      { type: "character", items: [embedded] },
    );

    const report = await runWorldMigrations({
      game: { user: { isGM: true }, actors: [actor], items: [worldItem] },
    });

    expect(report.failed).toBe(0);
    expect(actor.updates[0]).toMatchObject({ "system.schemaVersion": CURRENT_SCHEMA_VERSION });
    expect(embedded.updates).toEqual([
      { "system.schemaVersion": CURRENT_SCHEMA_VERSION, "system.effects": [] },
    ]);
    expect(worldItem.updates).toEqual([
      { "system.schemaVersion": CURRENT_SCHEMA_VERSION, "system.effects": [] },
    ]);
  });
});

describe("fresh document stamp", () => {
  it("writes the current schema version on create and does not rewrite a stored stamp", () => {
    const listeners = captureCreateListeners();
    const initial = modelInitials();

    const npc = vi.fn();
    runListeners(listeners.actors, {
      type: "npc",
      system: { schemaVersion: initial.npc },
      updateSource: npc,
    });
    expect(npc).toHaveBeenCalledWith({ "system.schemaVersion": CURRENT_SCHEMA_VERSION });

    const item = vi.fn();
    runListeners(listeners.items, {
      system: { schemaVersion: initial.weapon },
      updateSource: item,
    });
    expect(item).toHaveBeenCalledWith({ "system.schemaVersion": CURRENT_SCHEMA_VERSION });

    const stamped = vi.fn();
    runListeners(listeners.actors, {
      type: "npc",
      system: { schemaVersion: 2 },
      updateSource: stamped,
    });
    expect(stamped).not.toHaveBeenCalled();

    const current = vi.fn();
    runListeners(listeners.actors, {
      type: "character",
      system: { schemaVersion: CURRENT_SCHEMA_VERSION, survivalVersion: 1 },
      updateSource: current,
    });
    expect(current).not.toHaveBeenCalledWith({ "system.schemaVersion": CURRENT_SCHEMA_VERSION });
  });
});

function trackedDocument(
  name: string,
  storedSystem: Record<string, unknown>,
  extras: Partial<MigratableDocument> = {},
): MigratableDocument & { updates: Record<string, unknown>[] } {
  const updates: Record<string, unknown>[] = [];
  return {
    name,
    toObject: () => ({ system: storedSystem }),
    update: async (data) => {
      updates.push(data);
    },
    updates,
    ...extras,
  };
}

type CreateListener = (document: {
  type?: string;
  system?: unknown;
  updateSource?: (data: Record<string, unknown>) => unknown;
}) => void;

function captureCreateListeners(): { actors: CreateListener[]; items: CreateListener[] } {
  const actors: CreateListener[] = [];
  const items: CreateListener[] = [];
  registerPivotFantasySystem({
    Hooks: {
      on(event, callback) {
        if (event === "preCreateActor") actors.push(callback as CreateListener);
        if (String(event) === "preCreateItem") items.push(callback as CreateListener);
      },
      once() {},
    },
    CONFIG: {
      Actor: { dataModels: {}, trackableAttributes: {} },
      Item: { dataModels: {} },
    },
    foundry: mockFoundry(),
  });
  return { actors, items };
}

function runListeners(
  listeners: CreateListener[],
  document: {
    type?: string;
    system?: unknown;
    updateSource?: (data: Record<string, unknown>) => unknown;
  },
): void {
  for (const listener of listeners) listener(document);
}
