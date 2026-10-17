import { afterEach, describe, expect, it, vi } from "vitest";

import { createPivotCombatClass } from "../../src/runtime/combat-document";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tracker Roll Initiative", () => {
  it("creates chat messages, waits for Dice So Nice, then updates combatants", async () => {
    const callOrder: string[] = [];

    vi.stubGlobal("game", {
      i18n: { format: (_key: string, data: { name: string }) => `${data.name} rolls initiative` },
      settings: { get: () => "public" },
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          callOrder.push("dice3d");
        }),
      },
    });

    vi.stubGlobal("ChatMessage", {
      getSpeaker: () => ({ alias: "Hero" }),
      implementation: {
        create: vi.fn(async (message: Record<string, unknown>) => {
          callOrder.push("chat");
          expect(message.rolls).toEqual([{ total: 15 }]);
          return { ...message, id: "msg-0" };
        }),
      },
    });

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          actor: { id: "actor-1", name: "Hero" },
          token: null,
          hidden: false,
          isOwner: true,
          getInitiativeRoll: () => ({
            total: 15,
            _evaluated: true,
            async toMessage(data: Record<string, unknown>, opts: { create?: boolean }) {
              expect(opts.create).toBe(false);
              return { ...data, rolls: [{ total: 15 }] };
            },
          }),
        },
      ];
      updateEmbeddedDocuments = vi.fn(async () => {
        callOrder.push("update");
      });
      update = vi.fn(async () => undefined);
      combatant = { id: "c1" };
      turns = [{ id: "c1" }];
      async rollInitiative() {
        callOrder.push("original");
        return this;
      }
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();
    await (combat as { rollInitiative: (ids: string) => Promise<unknown> }).rollInitiative("c1");

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
    expect(callOrder).not.toContain("original");
  });
});

describe("tracker Roll Initiative with v14-shaped ChatMessage class", () => {
  it("calls static create bound to the class and honors roll mode", async () => {
    const order: string[] = [];
    class BaseChatMessage {
      id?: string;
      static get implementation(): typeof BaseChatMessage {
        return ChatMessageV14;
      }
      static async createDocuments(data: object[]) {
        const impl = this.implementation;
        order.push("chat");
        return data.map((d, i) => Object.assign(new impl(), d, { id: `m${i}` }));
      }
      static async create(data: object | object[]) {
        const list = Array.isArray(data) ? data : [data];
        const created = await this.implementation.createDocuments(list);
        return Array.isArray(data) ? created : created[0];
      }
      static getSpeaker() {
        return { alias: "Hero" };
      }
    }
    class ChatMessageV14 extends BaseChatMessage {}
    vi.stubGlobal("ChatMessage", ChatMessageV14);
    vi.stubGlobal("game", {
      settings: {
        get: (_scope: string, key: string) => (key === "rollMode" ? "blindroll" : undefined),
      },
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async (id: string) => {
          expect(id).toBe("m0");
          order.push("dice3d");
        }),
      },
    });

    const toMessage = vi.fn<
      (
        data: Record<string, unknown>,
        opts: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>
    >(async (data) => ({
      ...data,
      rolls: [{ total: 12 }],
    }));
    class BaseCombat {
      combatants = [
        {
          id: "c1",
          actor: { name: "Hero" },
          hidden: false,
          isOwner: true,
          getInitiativeRoll: () => ({
            total: 12,
            _evaluated: true,
            toMessage,
          }),
        },
      ];
      updateEmbeddedDocuments = vi.fn(async () => {
        order.push("update");
      });
      update = vi.fn(async () => undefined);
      combatant = null;
      turns: Array<{ id?: string }> = [];
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();
    await (combat as { rollInitiative: (ids: string[]) => Promise<unknown> }).rollInitiative([
      "c1",
    ]);

    expect(order).toEqual(["chat", "dice3d", "update"]);
    expect(
      (combat as { updateEmbeddedDocuments: ReturnType<typeof vi.fn> }).updateEmbeddedDocuments,
    ).toHaveBeenCalledWith("Combatant", [{ _id: "c1", initiative: 12 }]);
    expect(toMessage.mock.calls[0]?.[1]).toEqual({ rollMode: "blindroll", create: false });
  });
});
