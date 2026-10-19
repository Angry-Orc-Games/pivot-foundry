import { describe, expect, it } from "vitest";

import { SYSTEM_ID } from "../../src/config";
import { planWeaponEquippedMigration } from "../../src/migrations/m004";
import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

const M004_FLAG = `flags.${SYSTEM_ID}.m004`;

const strengthEffect = { type: "abilityScoreBonus", ability: "str", amount: 2 };

describe("planWeaponEquippedMigration", () => {
  it("equips a weapon that has effects and no equipped key", () => {
    expect(
      planWeaponEquippedMigration(
        { schemaVersion: CURRENT_SCHEMA_VERSION, effects: [strengthEffect] },
        "weapon",
      ),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": true, [M004_FLAG]: true },
    });
  });

  it("leaves a weapon without effects unequipped when the key is missing", () => {
    expect(
      planWeaponEquippedMigration({ schemaVersion: CURRENT_SCHEMA_VERSION, effects: [] }, "weapon"),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": false, [M004_FLAG]: true },
    });
    expect(
      planWeaponEquippedMigration({ schemaVersion: CURRENT_SCHEMA_VERSION }, "weapon"),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": false, [M004_FLAG]: true },
    });
    expect(
      planWeaponEquippedMigration(
        { schemaVersion: CURRENT_SCHEMA_VERSION, effects: "yes" },
        "weapon",
      ),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": false, [M004_FLAG]: true },
    });
  });

  it("equips an effect weapon whose stored false is only the schema default, and keeps a marked choice", () => {
    expect(
      planWeaponEquippedMigration(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          effects: [strengthEffect],
          equipped: false,
        },
        "weapon",
      ),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": true, [M004_FLAG]: true },
    });
    expect(
      planWeaponEquippedMigration(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          effects: [strengthEffect],
          equipped: false,
        },
        "weapon",
        { [SYSTEM_ID]: { m004: true } },
      ),
    ).toEqual({ ok: true, changed: false });
    expect(
      planWeaponEquippedMigration(
        { schemaVersion: CURRENT_SCHEMA_VERSION, effects: [], equipped: true },
        "weapon",
      ),
    ).toEqual({
      ok: true,
      changed: true,
      update: { [M004_FLAG]: true },
    });
  });

  it("is idempotent once the M004 marker is stored", () => {
    const stored = { schemaVersion: CURRENT_SCHEMA_VERSION, effects: [strengthEffect] };
    const first = planWeaponEquippedMigration(stored, "weapon");
    expect(first).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": true, [M004_FLAG]: true },
    });

    const second = planWeaponEquippedMigration({ ...stored, equipped: true }, "weapon", {
      [SYSTEM_ID]: { m004: true },
    });
    expect(second).toEqual({ ok: true, changed: false });
  });

  it("equips carried equipment that has effects and no M004 marker", () => {
    expect(
      planWeaponEquippedMigration(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          effects: [strengthEffect],
          equipped: false,
          carried: true,
        },
        "equipment",
      ),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": true, [M004_FLAG]: true },
    });
  });

  it("leaves equipment without effects alone", () => {
    expect(
      planWeaponEquippedMigration(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          effects: [],
          equipped: false,
          carried: true,
        },
        "equipment",
      ),
    ).toEqual({ ok: true, changed: false });
  });

  it("does not re-equip equipment after the M004 marker is set", () => {
    expect(
      planWeaponEquippedMigration(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          effects: [strengthEffect],
          equipped: false,
          carried: true,
        },
        "equipment",
        { [SYSTEM_ID]: { m004: true } },
      ),
    ).toEqual({ ok: true, changed: false });
  });

  it("ignores items that are not weapons", () => {
    expect(
      planWeaponEquippedMigration(
        { schemaVersion: CURRENT_SCHEMA_VERSION, effects: [strengthEffect] },
        "armour",
      ),
    ).toEqual({ ok: true, changed: false });
    expect(
      planWeaponEquippedMigration({ schemaVersion: CURRENT_SCHEMA_VERSION, effects: [] }),
    ).toEqual({ ok: true, changed: false });
  });
});

describe("M004 world migration", () => {
  it("logs each weapon change for an embedded item and a world item, then changes nothing on rerun", async () => {
    const flameTongue = persistingItem("Flame Tongue", {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [strengthEffect],
    });
    const dagger = persistingItem("Dagger", {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
    });
    const worldSword = persistingItem("World Sword", {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [strengthEffect],
    });
    const actor: MigratableDocument = {
      name: "Arwen",
      type: "character",
      toObject: () => ({
        system: { schemaVersion: CURRENT_SCHEMA_VERSION, survivalVersion: 1 },
      }),
      update: async () => undefined,
      items: [flameTongue, dagger],
    };
    const logs: string[] = [];
    const notifications: string[] = [];
    const dependencies = {
      game: {
        user: { isGM: true },
        actors: [actor],
        items: [worldSword],
      },
      log: (message: string) => logs.push(message),
      notify: (_level: "info" | "warn" | "error", message: string) => notifications.push(message),
    };

    const first = await runWorldMigrations(dependencies);

    expect(first).toEqual({ skipped: false, updated: 3, failed: 0 });
    expect(flameTongue.stored.equipped).toBe(true);
    expect(dagger.stored.equipped).toBe(false);
    expect(worldSword.stored.equipped).toBe(true);
    expect(logs).toEqual([
      "M004: equipped weapon 'World Sword' so its bonuses keep applying",
      "M004: equipped weapon 'Flame Tongue' on 'Arwen' so its bonuses keep applying",
      "M004: set weapon 'Dagger' on 'Arwen' unequipped because it has no effect bonuses",
      "PIVOT.Migration.Complete",
    ]);
    expect(notifications).toEqual(expect.arrayContaining(logs));

    logs.length = 0;
    notifications.length = 0;
    const second = await runWorldMigrations(dependencies);

    expect(second).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(logs).toEqual([]);
    expect(flameTongue.stored.equipped).toBe(true);
    expect(dagger.stored.equipped).toBe(false);
  });

  it("equips a weapon whose equipped false comes only from the schema default", async () => {
    const raw: Record<string, unknown> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [strengthEffect],
    };
    let prepared: Record<string, unknown> = { ...raw, equipped: false };
    const weapon: MigratableDocument = {
      name: "Flame Tongue",
      type: "weapon",
      _source: { system: raw },
      toObject: () => ({ system: prepared }),
      update: async (data) => {
        if ("system.equipped" in data)
          prepared = { ...prepared, equipped: data["system.equipped"] };
      },
    };

    const report = await runWorldMigrations({
      game: { user: { isGM: true }, actors: [], items: [weapon] },
    });

    expect(report).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(prepared.equipped).toBe(true);
  });

  it("equips carried equipment with effects once, then leaves a later unequip alone", async () => {
    const ring = persistingEquipment("Ring of Protection", {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [strengthEffect],
      equipped: false,
      carried: true,
    });
    const rope = persistingEquipment("Rope", {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
      equipped: false,
      carried: true,
    });
    const actor: MigratableDocument = {
      name: "Arwen",
      type: "character",
      toObject: () => ({
        system: { schemaVersion: CURRENT_SCHEMA_VERSION, survivalVersion: 1 },
      }),
      update: async () => undefined,
      items: [ring, rope],
    };
    const logs: string[] = [];
    const dependencies = {
      game: { user: { isGM: true }, actors: [actor], items: [] },
      log: (message: string) => logs.push(message),
      notify: () => undefined,
    };

    const first = await runWorldMigrations(dependencies);

    expect(first).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(ring.stored.equipped).toBe(true);
    expect(ring.marked).toBe(true);
    expect(rope.stored.equipped).toBe(false);
    expect(rope.updates).toEqual([]);
    expect(logs).toEqual([
      "M004: equipped equipment 'Ring of Protection' on 'Arwen' so its bonuses keep applying",
      "PIVOT.Migration.Complete",
    ]);

    logs.length = 0;
    const second = await runWorldMigrations(dependencies);
    expect(second).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(logs).toEqual([]);

    ring.setEquipped(false);
    const third = await runWorldMigrations(dependencies);
    expect(third).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(ring.stored.equipped).toBe(false);
    expect(logs).toEqual([]);
  });
});

function persistingEquipment(name: string, initial: Record<string, unknown>) {
  let stored = { ...initial };
  let marked = false;
  const updates: Record<string, unknown>[] = [];
  const document = {
    name,
    type: "equipment" as const,
    updates,
    toObject: () => ({
      system: stored,
      flags: marked ? { [SYSTEM_ID]: { m004: true } } : {},
    }),
    update: async (data: Record<string, unknown>) => {
      updates.push(data);
      if ("system.equipped" in data) stored = { ...stored, equipped: data["system.equipped"] };
      if (data[M004_FLAG] === true) marked = true;
    },
    setEquipped(value: boolean) {
      stored = { ...stored, equipped: value };
    },
    get stored() {
      return stored;
    },
    get marked() {
      return marked;
    },
  };
  return document;
}

function persistingItem(name: string, initial: Record<string, unknown>) {
  let stored = { ...initial };
  let marked = false;
  const document = {
    name,
    type: "weapon",
    toObject: () => ({
      system: stored,
      flags: marked ? { [SYSTEM_ID]: { m004: true } } : {},
    }),
    update: async (data: Record<string, unknown>) => {
      if ("system.equipped" in data) stored = { ...stored, equipped: data["system.equipped"] };
      if (data[M004_FLAG] === true) marked = true;
    },
    get stored() {
      return stored;
    },
  };
  return document;
}
