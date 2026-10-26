import { describe, expect, it } from "vitest";

import {
  runWorldMigrations,
  type MigratableDocument,
  type WorldMigrationGame,
} from "../../src/migrations/world-migrations";

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
  extras: { id?: string; type?: string; prototypeToken?: { actorLink?: unknown } } = {},
): MigratableDocument & { updates: Record<string, unknown>[]; stored: StoredActor } {
  const stored: StoredActor = {
    system: structuredClone(system),
    ...(extras.prototypeToken ? { prototypeToken: structuredClone(extras.prototypeToken) } : {}),
  };
  const updates: Record<string, unknown>[] = [];
  return {
    id: extras.id,
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

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = structuredClone(base);
  for (const [key, value] of Object.entries(over)) {
    const current = result[key];
    if (isPlain(current) && isPlain(value)) result[key] = deepMerge(current, value);
    else result[key] = structuredClone(value);
  }
  return result;
}

function createBaseAndDelta(
  baseName: string,
  baseSystem: Record<string, unknown>,
  deltaSystem: Record<string, unknown>,
  type = "character",
) {
  const base = createActor(baseName, baseSystem, { id: `${baseName}-id`, type });
  const deltaStored: StoredActor = { system: structuredClone(deltaSystem) };
  const deltaWrites: Record<string, unknown>[] = [];
  const synthetic = {
    id: `${baseName}-token`,
    name: `${baseName} Token`,
    type,
    updates: deltaWrites,
    toObject: () => ({ system: deepMerge(base.stored.system, deltaStored.system) }),
    update: async (data: Record<string, unknown>) => {
      deltaWrites.push(structuredClone(data));
      applyUpdate(deltaStored, data);
    },
  };
  const delta = {
    name: `${baseName} Delta`,
    toObject: () => structuredClone(deltaStored),
  };
  const token = {
    actorLink: false as const,
    actorId: base.id,
    actor: synthetic,
    delta,
  };
  return { base, synthetic, deltaStored, token };
}

const leftUnlinked = (name: string) =>
  `Left ${name} unlinked. This placed scene token keeps its own HP delta.`;

function unlinkLocalize(key: string): string {
  return key === "PIVOT.Migration.TokenLeftUnlinked"
    ? "Left {name} unlinked. This placed scene token keeps its own HP delta."
    : key;
}

describe("M004 HP max and prototype link", () => {
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

  it("does not copy a base-only bad HP max into an unlinked token delta", async () => {
    const { base, synthetic, token } = createBaseAndDelta(
      "Hero",
      settled({ value: 10, max: null }),
      {},
    );

    await runWorldMigrations({
      game: {
        user: { isGM: true },
        actors: [base],
        items: [],
        scenes: [{ tokens: [token] }],
      } as WorldMigrationGame,
    });

    expect(base.updates).toEqual([{ "system.attributes.hp.max": 10 }]);
    expect(synthetic.updates).toEqual([]);
  });

  it("writes a token delta HP max only from the delta's own data", async () => {
    const badMax = createBaseAndDelta("BadMax", settled({ value: 10, max: 20 }), {
      attributes: { hp: { value: 4, max: null } },
    });
    const above = createBaseAndDelta("Above", settled({ value: 10, max: null }), {
      attributes: { hp: { value: 18 } },
    });
    const below = createBaseAndDelta("Below", settled({ value: 10, max: null }), {
      attributes: { hp: { value: 4 } },
    });

    await runWorldMigrations({
      game: {
        user: { isGM: true },
        actors: [badMax.base, above.base, below.base],
        items: [],
        scenes: [{ tokens: [badMax.token, above.token, below.token] }],
      } as WorldMigrationGame,
    });

    expect(badMax.base.updates).toEqual([]);
    expect(badMax.synthetic.updates).toEqual([{ "system.attributes.hp.max": 4 }]);
    expect(above.base.updates).toEqual([{ "system.attributes.hp.max": 10 }]);
    expect(above.synthetic.updates).toEqual([{ "system.attributes.hp.max": 18 }]);
    expect(below.base.updates).toEqual([{ "system.attributes.hp.max": 10 }]);
    expect(below.synthetic.updates).toEqual([]);
  });

  it("logs an unlinked character token only when this run wrote it", async () => {
    const healthy = createActor("Healthy", settled({ value: 8, max: 8 }), { type: "character" });
    const scout = createActor("Scout", settled({ value: 7, max: null }), { type: "character" });
    const logs: string[] = [];
    const game = {
      user: { isGM: true },
      actors: [],
      items: [],
      scenes: [
        {
          tokens: [
            { actorLink: false, actor: healthy },
            { actorLink: false, actor: scout },
          ],
        },
      ],
      i18n: { localize: unlinkLocalize },
    } as WorldMigrationGame;

    await runWorldMigrations({ game, log: (message) => logs.push(message) });

    expect(healthy.updates).toEqual([]);
    expect(logs).not.toContain(leftUnlinked("Healthy"));
    expect(logs).toContain(leftUnlinked("Scout"));

    logs.length = 0;
    scout.updates.length = 0;
    await runWorldMigrations({ game, log: (message) => logs.push(message) });

    expect(scout.updates).toEqual([]);
    expect(logs).not.toContain(leftUnlinked("Scout"));
  });

  it("skips HP max repair when current HP is not a safe non-negative integer", async () => {
    const actors = [null, -1, Number.NaN, "12", 1.5].map((value, index) =>
      createActor(`BadHp${index}`, settled({ value, max: null }), { type: "character" }),
    );

    await runWorldMigrations({
      game: { user: { isGM: true }, actors, items: [] },
    });

    for (const actor of actors) expect(actor.updates).toEqual([]);
  });
});
