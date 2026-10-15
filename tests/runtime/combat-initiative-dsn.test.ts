import { afterEach, describe, expect, it, vi } from "vitest";

import {
  installCombatInitiativeDice3DWait,
  resetCombatInitiativeDice3DWaitForTests,
  rollInitiativeWaitingForDice3D,
} from "../../src/runtime/combat-initiative";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rollInitiativeWaitingForDice3D", () => {
  it("creates chat messages, waits for Dice3D, then updates combatants", async () => {
    const callOrder: string[] = [];

    const combat = {
      combatant: { id: "c1" },
      turns: [{ id: "c1" }],
      combatants: {
        get: (id: string) =>
          id === "c1"
            ? {
                id: "c1",
                isOwner: true,
                name: "Hero",
                hidden: false,
                actor: { id: "actor-1" },
                token: null,
                getInitiativeRoll: () => ({
                  total: 15,
                  async evaluate() {
                    return this;
                  },
                  async toMessage(data: Record<string, unknown>, opts: { create?: boolean }) {
                    expect(opts.create).toBe(false);
                    return { ...data, rolls: [{ total: 15 }], content: "15" };
                  },
                }),
              }
            : undefined,
      },
      updateEmbeddedDocuments: vi.fn(async (_name: string, updates: unknown[]) => {
        callOrder.push("update");
        expect(updates).toEqual([{ _id: "c1", initiative: 15 }]);
        return updates;
      }),
      update: vi.fn(async () => combat),
    };

    const createdMessages: unknown[] = [];
    vi.stubGlobal("ChatMessage", {
      getSpeaker: () => ({ alias: "Hero" }),
      implementation: {
        create: vi.fn(async (messages: unknown[]) => {
          callOrder.push("chat");
          const list = Array.isArray(messages) ? messages : [messages];
          const withIds = list.map((m, i) => ({ ...(m as object), id: `msg-${i}` }));
          createdMessages.push(...withIds);
          return withIds;
        }),
      },
      create: vi.fn(async (messages: unknown[]) => {
        callOrder.push("chat");
        const list = Array.isArray(messages) ? messages : [messages];
        const withIds = list.map((m, i) => ({ ...(m as object), id: `msg-${i}` }));
        createdMessages.push(...withIds);
        return withIds;
      }),
    });

    vi.stubGlobal("game", {
      i18n: { format: (_key: string, data: { name: string }) => `${data.name} rolls initiative` },
      settings: { get: () => "public" },
    });

    const wait = vi.fn(async () => {
      callOrder.push("dice3d");
    });

    await rollInitiativeWaitingForDice3D(combat, "c1", {}, { waitForDice3D: wait });

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
    expect(wait).toHaveBeenCalled();
    expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith("Combatant", [
      { _id: "c1", initiative: 15 },
    ]);
  });
});

describe("installCombatInitiativeDice3DWait", () => {
  it("patches Combat.prototype.rollInitiative to wait before updating", async () => {
    const callOrder: string[] = [];

    class FakeCombat {
      combatant = { id: "c1" };
      turns = [{ id: "c1" }];
      combatants = {
        get: (id: string) =>
          id === "c1"
            ? {
                id: "c1",
                isOwner: true,
                name: "Hero",
                hidden: false,
                actor: { id: "a1" },
                token: null,
                getInitiativeRoll: () => ({
                  total: 12,
                  async evaluate() {
                    return this;
                  },
                  async toMessage(data: Record<string, unknown>) {
                    return { ...data, rolls: [{ total: 12 }] };
                  },
                }),
              }
            : undefined,
      };
      async updateEmbeddedDocuments(name: string, updates: unknown[]) {
        void name;
        void updates;
        callOrder.push("update");
        return [];
      }
      async update() {
        return this;
      }
      async rollInitiative(ids: string | string[]) {
        void ids;
        callOrder.push("original");
        return this;
      }
    }

    resetCombatInitiativeDice3DWaitForTests();
    vi.stubGlobal("Combat", FakeCombat);
    vi.stubGlobal("ChatMessage", {
      getSpeaker: () => ({ alias: "Hero" }),
      create: vi.fn(async (messages: unknown[]) => {
        callOrder.push("chat");
        const list = Array.isArray(messages) ? messages : [messages];
        return list.map((m, i) => ({ ...(m as object), id: `m${i}` }));
      }),
    });
    vi.stubGlobal("game", {
      i18n: { format: () => "init" },
      settings: { get: () => "public" },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          callOrder.push("dice3d");
        }),
      },
    });

    installCombatInitiativeDice3DWait();

    const combat = new FakeCombat();
    await combat.rollInitiative("c1");

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
    expect(callOrder).not.toContain("original");
  });
});
