import { describe, expect, it } from "vitest";

import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";

interface StoredActor {
  system: Record<string, unknown>;
  prototypeToken?: { actorLink?: unknown };
}

function settled(hp: Record<string, unknown>): Record<string, unknown> {
  return { schemaVersion: 1, survivalVersion: 1, attributes: { hp } };
}

function createActor(
  name: string,
  system: Record<string, unknown>,
  extras: { type?: string; prototypeToken?: { actorLink?: unknown } } = {},
): MigratableDocument & { updates: Record<string, unknown>[]; stored: StoredActor } {
  const stored: StoredActor = {
    system: structuredClone(system),
    ...(extras.prototypeToken ? { prototypeToken: structuredClone(extras.prototypeToken) } : {}),
  };
  const updates: Record<string, unknown>[] = [];
  return {
    name,
    type: extras.type,
    updates,
    stored,
    toObject: () => structuredClone(stored),
    update: async (data) => {
      updates.push(structuredClone(data));
      applyUpdate(stored, data);
    },
  };
}

function applyUpdate(stored: StoredActor, data: Record<string, unknown>): void {
  const root = stored as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split(".");
    let target = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index] ?? "";
      const next = target[part];
      if (typeof next !== "object" || next === null || Array.isArray(next)) target[part] = {};
      target = target[part] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1] ?? "";
    target[leaf] = value;
  }
}

describe("M003 HP max and prototype link", () => {
  it("repairs a blank, non-numeric, or too-small HP max on a base actor", async () => {
    const blank = createActor("Blank", settled({ value: 14, max: null }), { type: "character" });
    const text = createActor("Text", settled({ value: 9, max: "nope" }), { type: "character" });
    const fractional = createActor("Fractional", settled({ value: 4, max: 1.5 }), {
      type: "character",
    });
    const negative = createActor("Negative", settled({ value: 3, max: -1 }), { type: "character" });
    const tooSmall = createActor("TooSmall", settled({ value: 11, max: 2 }), { type: "character" });

    await runWorldMigrations({
      game: {
        user: { isGM: true },
        actors: [blank, text, fractional, negative, tooSmall],
        items: [],
      },
    });

    expect(blank.updates).toEqual([{ "system.attributes.hp.max": 14 }]);
    expect(text.updates).toEqual([{ "system.attributes.hp.max": 9 }]);
    expect(fractional.updates).toEqual([{ "system.attributes.hp.max": 4 }]);
    expect(negative.updates).toEqual([{ "system.attributes.hp.max": 3 }]);
    expect(tooSmall.updates).toEqual([{ "system.attributes.hp.max": 11 }]);
  });

  it("repairs a bad HP max on an unlinked token delta and logs the token left unlinked", async () => {
    const token = createActor("Scout", settled({ value: 7, max: null }), { type: "character" });
    const logs: string[] = [];

    await runWorldMigrations({
      game: {
        user: { isGM: true },
        actors: [],
        items: [],
        scenes: [{ tokens: [{ actorLink: false, actor: token }] }],
        i18n: {
          localize: (key) =>
            key === "PIVOT.Migration.TokenLeftUnlinked"
              ? "Left {name} unlinked. This placed scene token keeps its own HP delta."
              : key,
        },
      },
      log: (message) => logs.push(message),
    });

    expect(token.updates).toEqual([{ "system.attributes.hp.max": 7 }]);
    expect(JSON.stringify(token.updates)).not.toMatch(/actorLink/);
    expect(logs).toContain("Left Scout unlinked. This placed scene token keeps its own HP delta.");
  });

  it("raises HP max when current HP is above max and keeps the current HP", async () => {
    const actor = createActor("Over", settled({ value: 15, max: 6 }), { type: "character" });

    await runWorldMigrations({
      game: { user: { isGM: true }, actors: [actor], items: [] },
    });

    expect(actor.updates).toEqual([{ "system.attributes.hp.max": 15 }]);
    expect(actor.stored.system).toMatchObject({ attributes: { hp: { value: 15, max: 15 } } });
  });

  it("links an unlinked player-character prototype token", async () => {
    const actor = createActor("Hera", settled({ value: 10, max: 20 }), {
      type: "character",
      prototypeToken: { actorLink: false },
    });

    await runWorldMigrations({
      game: { user: { isGM: true }, actors: [actor], items: [] },
    });

    expect(actor.updates).toEqual([{ "prototypeToken.actorLink": true }]);
    expect(actor.stored.prototypeToken).toEqual({ actorLink: true });
  });

  it("does not change an NPC actorLink", async () => {
    const clean = createActor(
      "Gonk",
      { schemaVersion: 1, attributes: { hp: { value: 8, max: 8 } } },
      {
        type: "npc",
        prototypeToken: { actorLink: false },
      },
    );
    const hurt = createActor(
      "Bruised",
      { schemaVersion: 1, attributes: { hp: { value: 9, max: null } } },
      { type: "npc", prototypeToken: { actorLink: false } },
    );
    const logs: string[] = [];

    await runWorldMigrations({
      game: {
        user: { isGM: true },
        actors: [clean, hurt],
        items: [],
        scenes: [{ tokens: [{ actorLink: false, actor: clean }] }],
      },
      log: (message) => logs.push(message),
    });

    expect(clean.updates).toEqual([]);
    expect(hurt.updates).toEqual([{ "system.attributes.hp.max": 9 }]);
    expect(JSON.stringify(clean.updates)).not.toMatch(/actorLink/);
    expect(JSON.stringify(hurt.updates)).not.toMatch(/actorLink/);
    expect(clean.stored.prototypeToken).toEqual({ actorLink: false });
    expect(hurt.stored.prototypeToken).toEqual({ actorLink: false });
    expect(logs.join("\n")).not.toMatch(/Gonk|Bruised/);
  });

  it("changes nothing on the second run", async () => {
    const actor = createActor("Again", settled({ value: 12, max: null }), {
      type: "character",
      prototypeToken: { actorLink: false },
    });
    const game = { user: { isGM: true }, actors: [actor], items: [] };

    await runWorldMigrations({ game });
    expect(actor.updates).toEqual([
      { "system.attributes.hp.max": 12, "prototypeToken.actorLink": true },
    ]);

    actor.updates.length = 0;
    const second = await runWorldMigrations({ game });

    expect(second).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(actor.updates).toEqual([]);
    expect(actor.stored.prototypeToken).toEqual({ actorLink: true });
    expect(actor.stored.system).toMatchObject({ attributes: { hp: { value: 12, max: 12 } } });
  });
});
