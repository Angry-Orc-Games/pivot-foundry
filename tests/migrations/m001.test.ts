import { describe, expect, it } from "vitest";

import {
  planActorMigration,
  planItemMigration,
  type MigrationPlan,
} from "../../src/migrations/m001";
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  SHEET_V2_SCHEMA_VERSION,
} from "../../src/rules/schema-version";

describe("M001 actor migration", () => {
  it("migrates missing or 0 schemaVersion to the current version", () => {
    expect(planActorMigration({})).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": CURRENT_SCHEMA_VERSION },
    });
    expect(planActorMigration({ schemaVersion: 0, resources: { pool: { value: 3 } } })).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": CURRENT_SCHEMA_VERSION },
    });
  });

  it("is a no-op for the current version and does not persist derived totals", () => {
    const plan = planActorMigration({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      notes: { special: "" },
    });
    expect(plan).toEqual({ ok: true, changed: false });
    expect(JSON.stringify(plan)).not.toMatch(/pool\.max|armourClass|initiative/);
  });

  it("fails malformed or newer documents without pretending success", () => {
    expect(planActorMigration("nope")).toEqual({
      ok: false,
      error: "system data is not an object",
    });
    expect(planActorMigration({ schemaVersion: 1.5 })).toMatchObject({ ok: false });
    expect(planActorMigration({ schemaVersion: 99 })).toMatchObject({ ok: false });
  });

  it("leaves a sheet-v2 schemaVersion 2 document in place and writes the current version for legacy data", () => {
    expect(planActorMigration({ schemaVersion: 2, notes: { special: "" } })).toEqual({
      ok: true,
      changed: false,
    });
    expect(planItemMigration({ schemaVersion: 2, effects: [] })).toEqual({
      ok: true,
      changed: false,
    });
    expect(planActorMigration({ schemaVersion: 0 })).toEqual({
      ok: true,
      changed: true,
      update: { "system.schemaVersion": CURRENT_SCHEMA_VERSION },
    });
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });
});

describe("M001 item migration", () => {
  it("adds schemaVersion and empty effects for legacy items", () => {
    expect(planItemMigration({ notes: "axe" })).toEqual({
      ok: true,
      changed: true,
      update: {
        "system.schemaVersion": CURRENT_SCHEMA_VERSION,
        "system.effects": [],
      },
    });
  });

  it("keeps existing valid effects and is idempotent at the current version", () => {
    const current = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [{ type: "acBonus", amount: 1, ability: null, skill: null, category: null }],
    };
    expect(planItemMigration(current)).toEqual({ ok: true, changed: false });
    expect(planItemMigration(planItemMigration(current).ok ? current : {})).toEqual({
      ok: true,
      changed: false,
    });
  });

  it("fails unsupported stored effects instead of repairing them", () => {
    expect(
      planItemMigration({
        schemaVersion: 0,
        effects: [{ type: "eval", code: "game.user" }],
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("schema version write and accept", () => {
  it("writes the exported current schema version", () => {
    for (const plan of [
      planActorMigration(undefined),
      planActorMigration(null),
      planActorMigration({}),
      planActorMigration({ schemaVersion: LEGACY_SCHEMA_VERSION }),
      planItemMigration(undefined),
      planItemMigration(null),
      planItemMigration({}),
      planItemMigration({ schemaVersion: LEGACY_SCHEMA_VERSION, effects: [] }),
    ]) {
      writtenSchemaVersion(plan);
    }
  });

  it("accepts the written schema version so it is not newer than supported", () => {
    const acceptedSchemaVersions = new Set<number>([
      LEGACY_SCHEMA_VERSION,
      CURRENT_SCHEMA_VERSION,
      SHEET_V2_SCHEMA_VERSION,
    ]);
    const written = writtenSchemaVersion(
      planActorMigration({ schemaVersion: LEGACY_SCHEMA_VERSION }),
    );
    expect(writtenSchemaVersion(planItemMigration({}))).toBe(written);
    expect(written).toBe(CURRENT_SCHEMA_VERSION);
    expect(acceptedSchemaVersions.has(CURRENT_SCHEMA_VERSION)).toBe(true);
    expect(acceptedSchemaVersions.has(written)).toBe(true);

    const actor = planActorMigration({ schemaVersion: written });
    const item = planItemMigration({ schemaVersion: written, effects: [] });
    expect(actor).toEqual({ ok: true, changed: false });
    expect(item).toEqual({ ok: true, changed: false });
    expect(JSON.stringify([actor, item])).not.toMatch(/newer than supported/);

    for (const version of acceptedSchemaVersions) {
      const acceptedActor = planActorMigration({ schemaVersion: version });
      const acceptedItem = planItemMigration({ schemaVersion: version, effects: [] });
      expect(acceptedActor.ok).toBe(true);
      expect(acceptedItem.ok).toBe(true);
      expect(JSON.stringify([acceptedActor, acceptedItem])).not.toMatch(/newer than supported/);
    }
  });

  it("rejects an actor one version past the sheet-v2 stamp", () => {
    const version = SHEET_V2_SCHEMA_VERSION + 1;
    expect(planActorMigration({ schemaVersion: version })).toEqual({
      ok: false,
      error: `schemaVersion ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    });
  });

  it("rejects an item one version past the sheet-v2 stamp", () => {
    const version = SHEET_V2_SCHEMA_VERSION + 1;
    expect(planItemMigration({ schemaVersion: version, effects: [] })).toEqual({
      ok: false,
      error: `schemaVersion ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    });
  });
});

function writtenSchemaVersion(plan: MigrationPlan): number {
  if (!plan.ok || !plan.changed) {
    throw new Error("migration did not write schemaVersion");
  }
  const version = plan.update["system.schemaVersion"];
  if (typeof version !== "number") {
    throw new Error("written schemaVersion was not a number");
  }
  expect(version).toBe(CURRENT_SCHEMA_VERSION);
  return version;
}
