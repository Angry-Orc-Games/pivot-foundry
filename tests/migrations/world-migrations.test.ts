import { describe, expect, it } from "vitest";

import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";
import { guardCharacterHpWrite } from "../../src/runtime/actor-guards";

function characterAtSpeed(
  name: string,
  species: string,
  speed: { value: number; bonus: number } | undefined,
  type = "character",
) {
  const stored: Record<string, unknown> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    survivalVersion: 1,
    identity: { speciesText: species },
    attributes: {
      hp: { value: 8, max: 8, temp: 0 },
      deathSaves: { status: "alive", successes: 0, failures: 0 },
      ...(speed ? { speed } : {}),
    },
  };
  const updates: Record<string, unknown>[] = [];
  return {
    name,
    type,
    updates,
    speedValue: () => {
      const attributes = stored.attributes as { speed?: { value?: number } };
      return attributes.speed?.value;
    },
    setSpeed: (value: number) => {
      const attributes = stored.attributes as { speed?: { value: number } };
      if (!attributes.speed) throw new Error(`${name} has no stored speed`);
      attributes.speed.value = value;
    },
    toObject: () => ({ system: structuredClone(stored) }),
    update: async (data: Record<string, unknown>) => {
      updates.push(structuredClone(data));
      for (const [key, value] of Object.entries(data)) {
        const path = key.split(".").filter((part) => part !== "system");
        let cursor: Record<string, unknown> = stored;
        for (const part of path.slice(0, -1)) {
          const next = cursor[part];
          if (!next || typeof next !== "object") cursor[part] = {};
          cursor = cursor[part] as Record<string, unknown>;
        }
        const leaf = path[path.length - 1];
        if (leaf) cursor[leaf] = value;
      }
    },
  };
}

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

  it("migrates a sheet-v2 schemaVersion 2 character once and does not warn that it is newer than supported", async () => {
    const stored: {
      schemaVersion: number;
      survivalVersion?: number;
      attributes: {
        hp: { value: number; max: number; temp?: number };
        deathSaves?: { status: string };
      };
    } = {
      schemaVersion: 2,
      attributes: { hp: { value: 8, max: 12 } },
    };
    const actor = createDocument("Imported", stored, { type: "character" });
    const messages: string[] = [];

    const report = await runWorldMigrations({
      game: { user: { isGM: true }, actors: [actor], items: [] },
      notify: (_level, message) => messages.push(message),
      log: (message) => messages.push(String(message)),
    });

    expect(report).toEqual({ skipped: false, updated: 1, failed: 0 });
    expect(messages.join("\n")).not.toMatch(/newer than supported/);
    expect(actor.updates).toEqual([
      {
        "system.survivalVersion": 1,
        "system.attributes.hp.temp": 0,
        "system.attributes.deathSaves.status": "alive",
      },
    ]);

    stored.survivalVersion = 1;
    stored.attributes = {
      hp: { value: 8, max: 12, temp: 0 },
      deathSaves: { status: "alive" },
    };
    actor.updates.length = 0;
    const second = await runWorldMigrations({
      game: { user: { isGM: true }, actors: [actor], items: [] },
      notify: (_level, message) => messages.push(message),
      log: (message) => messages.push(String(message)),
    });
    expect(second).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(actor.updates).toEqual([]);
    expect(messages.join("\n")).not.toMatch(/newer than supported/);
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
it("plans synthetic state before writes and persists it after base changes", async () => {
  let baseVersion = 0;
  const order: string[] = [];
  const base: MigratableDocument = {
    type: "character",
    toObject: () => ({ system: { schemaVersion: 1, survivalVersion: baseVersion } }),
    update: async () => {
      order.push("base");
      baseVersion = 1;
    },
  };
  const token: MigratableDocument = {
    type: "character",
    toObject: () => ({
      system: { schemaVersion: 1, survivalVersion: baseVersion, attributes: { hp: { value: 0 } } },
    }),
    update: async () => {
      order.push("token");
    },
  };
  await runWorldMigrations({
    game: {
      user: { isGM: true },
      actors: [base],
      scenes: [{ tokens: [{ actorLink: false, actor: token }] }],
    },
  });
  expect(order).toEqual(["base", "token"]);
});

it("sets base speed only when the stored value is still 10", async () => {
  const logs: string[] = [];
  const halfling = characterAtSpeed("Bram", "Halfling", { value: 10, bonus: 1 });
  const dwarf = characterAtSpeed("Durin", "Dwarf", { value: 10, bonus: 0 });
  const human = characterAtSpeed("Ada", "Human", { value: 10, bonus: 0 });
  const smallHumanoid = characterAtSpeed("Pip", "Small Humanoid", { value: 10, bonus: 0 });
  const large = characterAtSpeed("Brute", "Large Beast", { value: 10, bonus: 0 });
  const custom = characterAtSpeed("Nim", "Gnome", { value: 12, bonus: 0 });
  const zero = characterAtSpeed("Pebble", "Halfling", { value: 0, bonus: 0 });
  const missing = characterAtSpeed("Blank", "Gnome", undefined);
  const unknown = characterAtSpeed("Smaug", "Dragon", { value: 10, bonus: 0 });
  const npc = characterAtSpeed("Guard", "Halfling", { value: 10, bonus: 0 }, "npc");

  await runWorldMigrations({
    game: {
      user: { isGM: true },
      actors: [halfling, dwarf, human, smallHumanoid, large, custom, zero, missing, unknown, npc],
      items: [],
    },
    log: (message) => logs.push(message),
  });

  expect(halfling.updates).toEqual([{ "system.attributes.speed.value": 7 }]);
  expect(dwarf.updates).toEqual([{ "system.attributes.speed.value": 8 }]);
  expect(smallHumanoid.updates).toEqual([{ "system.attributes.speed.value": 7 }]);
  expect(large.updates).toEqual([{ "system.attributes.speed.value": 12 }]);
  expect(human.updates).toEqual([]);
  expect(custom.updates).toEqual([]);
  expect(zero.updates).toEqual([]);
  expect(missing.updates).toEqual([]);
  expect(unknown.updates).toEqual([]);
  expect(npc.updates).toEqual([]);
  expect(logs.filter((line) => !line.includes("PIVOT.Migration.Complete"))).toEqual([
    "Bram: base speed 10 -> 7 (Halfling).",
    "Durin: base speed 10 -> 8 (Dwarf).",
    "Pip: base speed 10 -> 7 (Small Humanoid).",
    "Brute: base speed 10 -> 12 (Large Beast).",
    'Smaug: unknown species "Dragon"; base speed left at 10.',
  ]);

  logs.length = 0;
  await runWorldMigrations({
    game: {
      user: { isGM: true },
      actors: [halfling, dwarf, human, smallHumanoid, large, custom, zero, missing, unknown, npc],
      items: [],
    },
    log: (message) => logs.push(message),
  });

  expect(halfling.updates).toHaveLength(1);
  expect(dwarf.updates).toHaveLength(1);
  expect(logs).toEqual(['Smaug: unknown species "Dragon"; base speed left at 10.']);
});

it("leaves a hand-set speed of 10 in place on the next ready", async () => {
  const dwarf = characterAtSpeed("Durin", "Dwarf", { value: 10, bonus: 0 });
  await runWorldMigrations({
    game: { user: { isGM: true }, actors: [dwarf], items: [] },
  });
  expect(dwarf.speedValue()).toBe(8);

  dwarf.setSpeed(10);
  await runWorldMigrations({
    game: { user: { isGM: true }, actors: [dwarf], items: [] },
  });

  expect(dwarf.speedValue()).toBe(10);
});

it("gives a fresh unmigrated character its species speed once", async () => {
  const halfling = characterAtSpeed("Bram", "Halfling", { value: 10, bonus: 0 });
  await runWorldMigrations({
    game: { user: { isGM: true }, actors: [halfling], items: [] },
  });
  expect(halfling.speedValue()).toBe(7);

  await runWorldMigrations({
    game: { user: { isGM: true }, actors: [halfling], items: [] },
  });
  expect(halfling.speedValue()).toBe(7);
});

it("keeps a later hand edit at 10 when species speed was already applied before the marker existed", async () => {
  const dwarf = characterAtSpeed("Durin", "Dwarf", { value: 8, bonus: 0 });
  await runWorldMigrations({
    game: { user: { isGM: true }, actors: [dwarf], items: [] },
  });
  expect(dwarf.speedValue()).toBe(8);

  dwarf.setSpeed(10);
  await runWorldMigrations({
    game: { user: { isGM: true }, actors: [dwarf], items: [] },
  });

  expect(dwarf.speedValue()).toBe(10);
});

it("writes migrations as trusted survival writes so the Character guard admits them", async () => {
  const writes: unknown[] = [];
  const actor = createDocument(
    "Hera",
    { attributes: { hp: { value: 5, max: 20 } } },
    {
      type: "character",
      update: async (data, options) => {
        writes.push(guardCharacterHpWrite({ type: "character", system: {} }, data, options));
      },
    },
  );
  const report = await runWorldMigrations({
    game: { user: { isGM: true }, actors: [actor], items: [] },
  });
  expect(report.failed).toBe(0);
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.every((result) => result === undefined)).toBe(true);
});
