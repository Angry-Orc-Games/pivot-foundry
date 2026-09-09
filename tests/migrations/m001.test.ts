import { describe, expect, it } from "vitest";

import { planActorMigration, planItemMigration } from "../../src/migrations/m001";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

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
