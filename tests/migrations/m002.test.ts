import { expect, it } from "vitest";
import { planSurvivalMigration } from "../../src/migrations/m002";
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
