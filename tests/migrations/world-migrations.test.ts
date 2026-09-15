import { describe, expect, it } from "vitest";

import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

function createDocument(
  name: string,
  storedSystem: Record<string, unknown>,
  extras: Partial<MigratableDocument> = {},
): MigratableDocument & { updates: Record<string, unknown>[] } {
  const updates: Record<string, unknown>[] = [];
  return {
    name,
    system: { schemaVersion: CURRENT_SCHEMA_VERSION, ...storedSystem },
    toObject: () => ({ system: storedSystem }),
    update: async (data) => {
      updates.push(data);
    },
    updates,
    ...extras,
  };
}

describe("runWorldMigrations", () => {
  it("skips when the current user is not a GM", async () => {
    const report = await runWorldMigrations({
      game: { user: { isGM: false }, actors: [], items: [] },
    });
    expect(report).toEqual({ skipped: true, updated: 0, failed: 0 });
  });

  it("updates legacy world and embedded documents from stored source, not prepared defaults", async () => {
    const worldItem = createDocument("World Feature", {});
    const embeddedItem = createDocument("Embedded Feature", { schemaVersion: 0 });
    const actor = createDocument(
      "Grawl",
      { resources: { pool: { value: 2 } } },
      {
        items: [embeddedItem],
      },
    );
    const notifications: Array<{ level: string; message: string }> = [];

    const report = await runWorldMigrations({
      game: {
        user: { isGM: true },
        items: [worldItem],
        actors: [actor],
        i18n: {
          localize: (key) => key,
        },
      },
      notify: (level, message) => notifications.push({ level, message }),
    });

    expect(report).toEqual({ skipped: false, updated: 3, failed: 0 });
    expect(worldItem.updates).toEqual([
      { "system.schemaVersion": CURRENT_SCHEMA_VERSION, "system.effects": [] },
    ]);
    expect(actor.updates).toEqual([
      {
        "system.schemaVersion": CURRENT_SCHEMA_VERSION,
        "system.survivalVersion": 1,
        "system.attributes.hp.temp": 0,
        "system.attributes.deathSaves.status": "unconfirmed",
      },
    ]);
    expect(embeddedItem.updates).toEqual([
      { "system.schemaVersion": CURRENT_SCHEMA_VERSION, "system.effects": [] },
    ]);
    expect(JSON.stringify(actor.updates)).not.toMatch(/derived|pool\.max/);
    expect(notifications[0]?.message).toContain("PIVOT.Migration.Complete");
  });

  it("reports a malformed document without updating it and continues with others", async () => {
    const bad = createDocument("Broken", { schemaVersion: "nope" as unknown as number });
    const good = createDocument("Fine", {});
    const warnings: string[] = [];

    const report = await runWorldMigrations({
      game: {
        items: [bad, good],
        actors: [],
        i18n: {
          localize: (key) =>
            key === "PIVOT.Migration.DocumentFailed"
              ? "Migration {id} failed for {name}: {error}"
              : key,
        },
      },
      notify: (_level, message) => warnings.push(message),
    });

    expect(report.failed).toBe(1);
    expect(report.updated).toBe(1);
    expect(bad.updates).toEqual([]);
    expect(good.updates).toHaveLength(1);
    expect(warnings.some((message) => message.includes("Broken"))).toBe(true);
  });

  it("is a no-op when stored documents are already current", async () => {
    const item = createDocument("Current", {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
    });

    const report = await runWorldMigrations({
      game: { items: [item], actors: [] },
    });

    expect(report).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(item.updates).toEqual([]);
  });
});
it("migrates unlinked scene actors separately and skips linked copies", async () => {
  const synthetic = createDocument(
    "Token",
    { schemaVersion: 1, attributes: { hp: { value: 0, max: 20 }, deathSaves: { failures: 2 } } },
    { type: "character" },
  );
  const linked = createDocument("Linked", { schemaVersion: 1 }, { type: "character" });
  const report = await runWorldMigrations({
    game: {
      user: { isGM: true },
      scenes: [
        {
          tokens: [
            { actorLink: false, actor: synthetic },
            { actorLink: true, actor: linked },
          ],
        },
      ],
    },
  });
  expect(report.updated).toBe(1);
  expect(synthetic.updates[0]).toMatchObject({
    "system.survivalVersion": 1,
    "system.attributes.deathSaves.status": "unconfirmed",
  });
  expect(linked.updates).toHaveLength(0);
});
it("does not claim a missing update method persisted migrations", async () => {
  expect(
    (await runWorldMigrations({ game: { actors: [{ type: "character", system: {} }] } })).failed,
  ).toBe(1);
});
