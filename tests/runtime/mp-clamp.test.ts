import { describe, expect, it } from "vitest";

import {
  clampMpOnActorUpdate,
  clampStoredMp,
  registerMpClampHooks,
} from "../../src/runtime/mp-clamp";

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

describe("clampMpOnActorUpdate", () => {
  it("persists an update of mp.value to 99 as the derived max", () => {
    const actor = { type: "character", system: awakenedMagic(4), items: [] };
    const changes: Record<string, unknown> = { system: { magic: { mp: { value: 99 } } } };

    clampMpOnActorUpdate(actor, changes);

    expect(changes).toMatchObject({ system: { magic: { mp: { value: 5 } } } });
  });

  it("persists a dotted mp.value update as the derived max", () => {
    const actor = { type: "character", system: awakenedMagic(4), items: [] };
    const changes: Record<string, unknown> = { "system.magic.mp.value": 99 };

    clampMpOnActorUpdate(actor, changes);

    expect(changes["system.magic.mp.value"]).toBe(5);
  });

  it("clamps the stored current MP when a dotted update lowers max", () => {
    const actor = { type: "character", system: awakenedMagic(8, 3), items: [] };
    const changes: Record<string, unknown> = { "system.magic.mp.maxBonus": 0 };

    clampMpOnActorUpdate(actor, changes);

    expect(changes.system).toMatchObject({ magic: { mp: { value: 5 } } });
  });

  it("clamps the stored current MP when an update lowers max", () => {
    const actor = { type: "character", system: awakenedMagic(8, 3), items: [] };
    const changes: Record<string, unknown> = { system: { magic: { mp: { maxBonus: 0 } } } };

    clampMpOnActorUpdate(actor, changes);

    expect(changes).toMatchObject({
      system: { magic: { mp: { maxBonus: 0, value: 5 } } },
    });
  });

  it("reads the stored source when prepared data was already display-clamped", () => {
    const actor = {
      type: "character",
      system: awakenedMagic(5, 3),
      _source: { system: awakenedMagic(8, 3) },
      items: [],
    };
    const changes: Record<string, unknown> = { system: { magic: { mp: { maxBonus: 0 } } } };

    clampMpOnActorUpdate(actor, changes);

    expect(changes).toMatchObject({ system: { magic: { mp: { value: 5 } } } });
  });
});

describe("clampStoredMp", () => {
  it("clamps stored MP when an embedded mpMaxBonus item is removed", () => {
    const updates: Record<string, unknown>[] = [];
    const actor = {
      type: "character",
      system: awakenedMagic(8),
      items: [{ system: { effects: [{ type: "mpMaxBonus", amount: 3 }] } }],
      update: (data: Record<string, unknown>) => {
        updates.push(data);
      },
    };

    clampStoredMp(actor);
    expect(updates).toEqual([]);

    actor.items = [];
    clampStoredMp(actor);

    expect(updates).toEqual([{ "system.magic.mp.value": 5 }]);
  });

  it("clamps stored MP when an ability-score item that feeds max MP is removed", () => {
    const updates: Record<string, unknown>[] = [];
    const actor = {
      type: "character",
      system: awakenedMagic(9),
      items: [{ system: { effects: [{ type: "abilityScoreBonus", ability: "int", amount: 4 }] } }],
      update: (data: Record<string, unknown>) => {
        updates.push(data);
      },
    };

    clampStoredMp(actor);
    expect(updates).toEqual([]);

    actor.items = [];
    clampStoredMp(actor);

    expect(updates).toEqual([{ "system.magic.mp.value": 5 }]);
  });

  it("does not write when stored MP is already within max", () => {
    const updates: Record<string, unknown>[] = [];
    const actor = {
      type: "character",
      system: awakenedMagic(4),
      items: [{ system: { effects: [{ type: "mpMaxBonus", amount: 3 }] } }],
      update: (data: Record<string, unknown>) => {
        updates.push(data);
      },
    };

    clampStoredMp(actor);

    expect(updates).toEqual([]);
  });

  it("persists from stored source after the prepared value was display-clamped", () => {
    const updates: Record<string, unknown>[] = [];
    const actor = {
      type: "character",
      system: awakenedMagic(5),
      _source: { system: awakenedMagic(8) },
      items: [] as { system?: unknown }[],
      update: (data: Record<string, unknown>) => {
        updates.push(data);
      },
    };

    clampStoredMp(actor);

    expect(updates).toEqual([{ "system.magic.mp.value": 5 }]);
  });
});

describe("registerMpClampHooks", () => {
  it("clamps the parent character when an embedded item is deleted", () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    registerMpClampHooks({
      on: (event, callback) => {
        listeners.set(event, callback as (...args: unknown[]) => void);
      },
    });
    const updates: Record<string, unknown>[] = [];
    const actor = {
      type: "character",
      system: awakenedMagic(8),
      items: [] as unknown[],
      update: (data: Record<string, unknown>) => {
        updates.push(data);
      },
    };

    for (const event of ["createItem", "updateItem", "deleteItem"]) {
      updates.length = 0;
      actor.system = awakenedMagic(8);
      listeners.get(event)?.({ parent: actor });
      expect(updates).toEqual([{ "system.magic.mp.value": 5 }]);
    }
  });
});
