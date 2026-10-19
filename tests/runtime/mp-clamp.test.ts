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

const FOUNDRY_OWNER = 3;

type ClientUser = { id: string; active: boolean; isGM: boolean };

function clientGame(selfId: string, users: ClientUser[]) {
  const activeGms = users
    .filter((user) => user.active && user.isGM)
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const activeGm = activeGms[0];
  return {
    user: { id: selfId, isGM: users.find((user) => user.id === selfId)?.isGM === true },
    users: {
      activeGM: activeGm ? { id: activeGm.id, isSelf: activeGm.id === selfId } : null,
      contents: users,
    },
  };
}

function deleteItemAs(selfId: string, users: ClientUser[], ownership: Record<string, number>) {
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
    ownership,
    update: (data: Record<string, unknown>) => {
      updates.push(data);
    },
  };
  const globals = globalThis as { game?: ReturnType<typeof clientGame> };
  const previous = globals.game;
  globals.game = clientGame(selfId, users);
  try {
    listeners.get("deleteItem")?.({ parent: actor });
  } finally {
    globals.game = previous;
  }
  return updates;
}

describe("MP clamp writer", () => {
  const gmAndOwner: ClientUser[] = [
    { id: "gm-1", active: true, isGM: true },
    { id: "owner-a", active: true, isGM: false },
  ];

  it("does not call update from a non-GM client while a GM is connected", () => {
    const updates = deleteItemAs("owner-a", gmAndOwner, {
      default: 0,
      "gm-1": FOUNDRY_OWNER,
      "owner-a": FOUNDRY_OWNER,
    });
    expect(updates).toEqual([]);
  });

  it("calls update once from the active GM", () => {
    const updates = deleteItemAs("gm-1", gmAndOwner, { default: 0, "gm-1": FOUNDRY_OWNER });
    expect(updates).toEqual([{ "system.magic.mp.value": 5 }]);
  });

  it("calls update from exactly one owner when no GM is connected", () => {
    const users: ClientUser[] = [
      { id: "owner-b", active: true, isGM: false },
      { id: "owner-a", active: true, isGM: false },
      { id: "watcher", active: true, isGM: false },
    ];
    const ownership = { default: 0, "owner-a": FOUNDRY_OWNER, "owner-b": FOUNDRY_OWNER };
    const firstOwner = deleteItemAs("owner-a", users, ownership);
    const secondOwner = deleteItemAs("owner-b", users, ownership);
    const watcher = deleteItemAs("watcher", users, ownership);
    const writes = [firstOwner, secondOwner, watcher].filter((updates) => updates.length > 0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual([{ "system.magic.mp.value": 5 }]);
    expect(firstOwner).toHaveLength(1);
    expect(secondOwner).toEqual([]);
  });
});
