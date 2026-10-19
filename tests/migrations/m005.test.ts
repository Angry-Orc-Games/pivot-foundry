import { describe, expect, it } from "vitest";

import { runWorldMigrations, type MigratableDocument } from "../../src/migrations/world-migrations";

function character(
  name: string,
  mp: { value: number; maxBonus?: number },
  extras: {
    items?: MigratableDocument[];
    awakened?: boolean;
  } = {},
): MigratableDocument & { updates: Record<string, unknown>[] } {
  const updates: Record<string, unknown>[] = [];
  const system = {
    schemaVersion: 2,
    survivalVersion: 1,
    progression: { level: 1 },
    abilities: {
      str: { score: 10 },
      dex: { score: 10 },
      con: { score: 10 },
      int: { score: 10 },
      wis: { score: 10 },
      cha: { score: 10 },
    },
    magic: {
      awakened: extras.awakened ?? true,
      ability: "int",
      mp: { value: mp.value, maxBonus: mp.maxBonus ?? 0 },
    },
  };
  return {
    name,
    type: "character",
    system,
    items: extras.items ?? [],
    toObject: () => ({ system }),
    update: async (data) => {
      updates.push(data);
      const next = data["system.magic.mp.value"];
      if (typeof next === "number") system.magic.mp.value = next;
    },
    updates,
  };
}

function bonusItem(amount: number): MigratableDocument {
  const system = {
    schemaVersion: 2,
    effects: [{ type: "mpMaxBonus", amount }],
  };
  return {
    name: "Focus",
    type: "feature",
    system,
    toObject: () => ({ system }),
    update: async () => {},
  };
}

describe("M005 clamp current MP to derived max", () => {
  it("clamps stored MP above max and logs the change", async () => {
    const arwen = character("Arwen", { value: 12, maxBonus: 3 });
    const logs: string[] = [];
    const notices: string[] = [];

    const report = await runWorldMigrations({
      game: { user: { isGM: true }, actors: [arwen] },
      log: (message) => logs.push(message),
      notify: (_level, message) => notices.push(message),
    });

    expect(report.failed).toBe(0);
    expect(arwen.updates).toEqual([{ "system.magic.mp.value": 8 }]);
    expect(logs).toContain("M005: clamped MP on 'Arwen' from 12 to 8");
    expect(notices).toContain("M005: clamped MP on 'Arwen' from 12 to 8");
  });

  it("leaves a current MP that is already within max, including item bonuses", async () => {
    const arwen = character("Arwen", { value: 8 }, { items: [bonusItem(3)] });
    const logs: string[] = [];

    const report = await runWorldMigrations({
      game: { user: { isGM: true }, actors: [arwen] },
      log: (message) => logs.push(message),
    });

    expect(report).toEqual({ skipped: false, updated: 0, failed: 0 });
    expect(arwen.updates).toEqual([]);
    expect(logs.some((message) => message.startsWith("M005:"))).toBe(false);
  });

  it("is idempotent after the stored value has been clamped", async () => {
    const arwen = character("Arwen", { value: 12, maxBonus: 3 });
    const dependencies = {
      game: { user: { isGM: true }, actors: [arwen] },
    };

    await runWorldMigrations(dependencies);
    expect(arwen.updates).toEqual([{ "system.magic.mp.value": 8 }]);

    await runWorldMigrations(dependencies);
    expect(arwen.updates).toEqual([{ "system.magic.mp.value": 8 }]);
  });

  it("clamps unlinked token actors and skips linked copies", async () => {
    const token = character("Token Arwen", { value: 12, maxBonus: 3 });
    const linked = character("Linked", { value: 12, maxBonus: 3 });

    await runWorldMigrations({
      game: {
        user: { isGM: true },
        scenes: [
          {
            tokens: [
              { actorLink: false, actor: token },
              { actorLink: true, actor: linked },
            ],
          },
        ],
      },
    });

    expect(token.updates).toEqual([{ "system.magic.mp.value": 8 }]);
    expect(linked.updates).toEqual([]);
  });
});
