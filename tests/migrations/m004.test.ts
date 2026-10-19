import { describe, expect, it } from "vitest";

import { planWeaponEquippedMigration } from "../../src/migrations/m004";
import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

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
      update: { "system.equipped": true },
    });
  });

  it("leaves a weapon without effects unequipped when the key is missing", () => {
    expect(
      planWeaponEquippedMigration({ schemaVersion: CURRENT_SCHEMA_VERSION, effects: [] }, "weapon"),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": false },
    });
    expect(
      planWeaponEquippedMigration({ schemaVersion: CURRENT_SCHEMA_VERSION }, "weapon"),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": false },
    });
    expect(
      planWeaponEquippedMigration(
        { schemaVersion: CURRENT_SCHEMA_VERSION, effects: "yes" },
        "weapon",
      ),
    ).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": false },
    });
  });

  it("does not change a weapon that already stores equipped", () => {
    expect(
      planWeaponEquippedMigration(
        {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          effects: [strengthEffect],
          equipped: false,
        },
        "weapon",
      ),
    ).toEqual({ ok: true, changed: false });
    expect(
      planWeaponEquippedMigration(
        { schemaVersion: CURRENT_SCHEMA_VERSION, effects: [], equipped: true },
        "weapon",
      ),
    ).toEqual({ ok: true, changed: false });
  });

  it("is idempotent once equipped has been stored", () => {
    const stored = { schemaVersion: CURRENT_SCHEMA_VERSION, effects: [strengthEffect] };
    const first = planWeaponEquippedMigration(stored, "weapon");
    expect(first).toEqual({
      ok: true,
      changed: true,
      update: { "system.equipped": true },
    });

    const second = planWeaponEquippedMigration({ ...stored, equipped: true }, "weapon");
    expect(second).toEqual({ ok: true, changed: false });
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
});

function persistingItem(name: string, initial: Record<string, unknown>) {
  let stored = { ...initial };
  const document = {
    name,
    type: "weapon",
    toObject: () => ({ system: stored }),
    update: async (data: Record<string, unknown>) => {
      if ("system.equipped" in data) {
        stored = { ...stored, equipped: data["system.equipped"] };
      }
    },
    get stored() {
      return stored;
    },
  };
  return document;
}
