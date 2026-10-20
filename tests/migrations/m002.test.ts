import { expect, it } from "vitest";
import { planSurvivalMigration } from "../../src/migrations/m002";
import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
it("preserves legacy HP and counters while flagging ambiguous zero HP", () => {
  expect(
    planSurvivalMigration({
      schemaVersion: 1,
      attributes: { hp: { value: 0, max: 20 }, deathSaves: { successes: 2, failures: 1 } },
    }),
  ).toEqual({
    ok: true,
    changed: true,
    update: {
      "system.survivalVersion": 1,
      "system.attributes.hp.temp": 0,
      "system.attributes.deathSaves.status": "unconfirmed",
    },
  });
});
it("marks positive HP conscious and is idempotent", () => {
  expect(planSurvivalMigration({ attributes: { hp: { value: 10, max: 20 } } })).toMatchObject({
    update: { "system.attributes.deathSaves.status": "alive" },
  });
  expect(planSurvivalMigration({ survivalVersion: 1 })).toEqual({ ok: true, changed: false });
});
it("preserves existing temp and status and rejects future or malformed state", () => {
  expect(
    planSurvivalMigration({
      attributes: { hp: { value: 0, temp: 5 }, deathSaves: { status: "stable" } },
    }),
  ).toMatchObject({ update: { "system.survivalVersion": 1 } });
  expect(planSurvivalMigration({ survivalVersion: 2 }).ok).toBe(false);
  expect(planSurvivalMigration({ attributes: { hp: { temp: -1 } } }).ok).toBe(false);
});
it("recognizes injected legacy-safe model defaults rather than skipping migration", () => {
  expect(
    planSurvivalMigration({
      schemaVersion: 1,
      survivalVersion: 0,
      attributes: {
        hp: { value: 10, max: 20, temp: 0 },
        deathSaves: { status: "unconfirmed", successes: 0, failures: 0 },
      },
    }),
  ).toMatchObject({
    changed: true,
    update: { "system.survivalVersion": 1, "system.attributes.deathSaves.status": "alive" },
  });
  expect(
    planSurvivalMigration({
      survivalVersion: 0,
      attributes: {
        hp: { value: 0, temp: 0 },
        deathSaves: { status: "unconfirmed", successes: 1, failures: 1 },
      },
    }),
  ).toMatchObject({ update: { "system.attributes.deathSaves.status": "unconfirmed" } });
});

const versionOneDying = {
  schemaVersion: 2,
  survivalVersion: 1,
  attributes: {
    hp: { value: 10, max: 10, temp: 0 },
    deathSaves: { status: "dying", successes: 1, failures: 2 },
  },
  magic: { awakened: false, mp: { value: 5 } },
};

it("persists alive for a version-1 actor with positive HP stored as dying, and is a no-op on the second run", async () => {
  const first = planSurvivalMigration(versionOneDying);
  expect(first).toEqual({
    ok: true,
    changed: true,
    update: {
      "system.attributes.deathSaves.status": "alive",
      "system.attributes.deathSaves.successes": 0,
      "system.attributes.deathSaves.failures": 0,
    },
  });
  expect(JSON.stringify(first)).not.toMatch(/magic|mp/);

  const stored: Record<string, unknown> = structuredClone(versionOneDying);
  const updates: Record<string, unknown>[] = [];
  const actor: MigratableDocument = {
    name: "Rest",
    type: "character",
    toObject: () => ({ system: stored }),
    update: async (data) => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.replace(/^system\./, "").split(".");
        let cursor: Record<string, unknown> = stored;
        for (const part of parts.slice(0, -1)) {
          const next = cursor[part];
          if (!next || typeof next !== "object") {
            cursor[part] = {};
          }
          cursor = cursor[part] as Record<string, unknown>;
        }
        cursor[parts[parts.length - 1] ?? ""] = value;
      }
    },
  };
  const game = { user: { isGM: true }, actors: [actor], items: [] };
  const firstRun = await runWorldMigrations({ game });
  expect(firstRun).toEqual({ skipped: false, updated: 1, failed: 0 });
  expect(updates).toHaveLength(1);
  expect((stored.attributes as { deathSaves: { status: string } }).deathSaves.status).toBe("alive");

  const secondRun = await runWorldMigrations({ game });
  expect(secondRun).toEqual({ skipped: false, updated: 0, failed: 0 });
  expect(updates).toHaveLength(1);
  expect(planSurvivalMigration(stored)).toEqual({ ok: true, changed: false });
});

it("does not persist a stale dying state when the user is not a GM", async () => {
  const actor: MigratableDocument = {
    name: "Rest",
    type: "character",
    toObject: () => ({ system: versionOneDying }),
    update: async () => {
      throw new Error("non-GM must not write");
    },
  };
  const report = await runWorldMigrations({
    game: { user: { isGM: false }, actors: [actor], items: [] },
  });
  expect(report).toEqual({ skipped: true, updated: 0, failed: 0 });
});

it("leaves zero HP dying, zero HP stable, and dead actors untouched", () => {
  for (const source of [
    {
      survivalVersion: 1,
      attributes: {
        hp: { value: 0, max: 10, temp: 0 },
        deathSaves: { status: "dying", successes: 2, failures: 1 },
      },
    },
    {
      survivalVersion: 1,
      attributes: {
        hp: { value: 0, max: 10, temp: 0 },
        deathSaves: { status: "stable", successes: 0, failures: 0 },
      },
    },
    {
      survivalVersion: 1,
      attributes: {
        hp: { value: 10, max: 10, temp: 0 },
        deathSaves: { status: "dead", successes: 0, failures: 3 },
      },
    },
  ]) {
    expect(planSurvivalMigration(source)).toEqual({ ok: true, changed: false });
  }
});

it("preserves a stored MP value above the non-awakened maximum", () => {
  const blank = planSurvivalMigration({
    survivalVersion: 1,
    attributes: {
      hp: { value: 10, max: 10 },
      deathSaves: { status: "alive", successes: 0, failures: 0 },
    },
    magic: { awakened: false, mp: { value: undefined } },
  });
  expect(blank).toEqual({ ok: true, changed: false });
  const overMax = planSurvivalMigration({
    survivalVersion: 1,
    attributes: {
      hp: { value: 10, max: 10 },
      deathSaves: { status: "alive", successes: 0, failures: 0 },
    },
    magic: { awakened: false, mp: { value: 5 } },
  });
  expect(overMax).toEqual({ ok: true, changed: false });
});
