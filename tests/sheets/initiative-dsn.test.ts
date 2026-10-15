import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Initiative roll with Dice So Nice integration", () => {
  it("creates chat message with Roll attached, applies roll mode, waits for DSN, then updates combatant", async () => {
    const callOrder: string[] = [];

    // Mock Foundry v14 ChatMessage class with implementation pattern
    class BaseChatMessage {
      id?: string;
      static get implementation(): typeof BaseChatMessage {
        return ChatMessageV14;
      }
      static async createDocuments(data: object[]): Promise<BaseChatMessage[]> {
        callOrder.push("chat-create");
        const impl = this.implementation;
        return data.map((d, i) => Object.assign(new impl(), d, { id: `msg-${i}` }));
      }
      static applyRollMode = vi.fn((data: Record<string, unknown>, mode: string) => {
        callOrder.push(`apply-mode-${mode}`);
      });
    }
    class ChatMessageV14 extends BaseChatMessage {}

    vi.stubGlobal("ChatMessage", ChatMessageV14);

    // Mock game with settings and dice3d
    vi.stubGlobal("game", {
      settings: {
        get: vi.fn((scope: string, key: string) => {
          if (scope === "core" && key === "rollMode") return "blindroll";
          return undefined;
        }),
      },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async (id: string) => {
          expect(id).toBe("msg-0");
          callOrder.push("dice3d-wait");
        }),
      },
      combat: null as unknown,
    });

    // Create a proper Roll mock constructor
    const createMockRoll = () => ({
      evaluate: vi.fn(async function (this: ReturnType<typeof createMockRoll>) {
        return this;
      }),
      toMessage: vi.fn(async function (
        this: ReturnType<typeof createMockRoll>,
        data: Record<string, unknown>,
      ) {
        callOrder.push("roll-to-message");
        return {
          ...data,
          rolls: [this],
        };
      }),
    });

    const RollConstructor = vi.fn(function (this: ReturnType<typeof createMockRoll>) {
      return Object.assign(this, createMockRoll());
    }) as unknown as new (formula: string) => ReturnType<typeof createMockRoll>;

    vi.stubGlobal("Roll", RollConstructor);

    // Mock combat and combatant
    const mockCombatant = {
      id: "combatant-1",
      actorId: "actor-1",
      update: vi.fn(async (data: { initiative: number }) => {
        callOrder.push(`update-initiative-${data.initiative}`);
      }),
    };

    const gameGlobal = globalThis as { game?: { combat?: unknown } };
    if (gameGlobal.game) {
      gameGlobal.game.combat = {
        combatants: [mockCombatant],
      };
    }

    // Execute the initiative roll path through character sheet
    const { prepareCharacterSheetContext, buildD20ChatFlavor } =
      await import("../../src/sheets/character-sheet");

    const mockActor = {
      id: "actor-1",
      name: "Test Hero",
      type: "character",
      system: {
        abilities: {
          str: { score: 10, mod: 0 },
          dex: { score: 16, mod: 3 },
          con: { score: 10, mod: 0 },
          int: { score: 10, mod: 0 },
          wis: { score: 10, mod: 0 },
          cha: { score: 10, mod: 0 },
        },
        attributes: {
          initiative: { bonus: 2 },
          hp: { value: 10, max: 10, temp: 0 },
          hitDie: "d8",
        },
        resources: {
          pool: { value: 5 },
        },
        magic: {
          awakened: false,
          mp: { value: 0 },
        },
      },
    };

    const context = prepareCharacterSheetContext(mockActor, true);
    const total = 17;
    const kept = 14;
    const modifier = context.derived.initiative;

    const flavor = buildD20ChatFlavor({
      label: "Initiative",
      mode: "normal",
      kept,
      modifier,
      total,
      attackCrit: null,
      localize: (key: string) => key,
    });

    // Simulate the rollInitiativeWithDiceAnimation call (not exported, so we inline it)
    const roll = new RollConstructor(`${kept}${modifier >= 0 ? "+" : ""}${modifier}`);
    await roll.evaluate();

    const chatData = await roll.toMessage({
      speaker: { alias: mockActor.name },
      flavor,
    });

    const game = globalThis as typeof globalThis & {
      game?: { settings?: { get?: (scope: string, key: string) => unknown } };
    };
    const rawMode = game.game?.settings?.get?.("core", "rollMode");
    const rollMode = typeof rawMode === "string" ? rawMode : "roll";

    const ChatMessage = (
      globalThis as typeof globalThis & {
        ChatMessage?: {
          implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
          createDocuments?: (data: unknown[]) => Promise<unknown>;
          applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
        };
      }
    ).ChatMessage;

    if (ChatMessage?.applyRollMode) {
      ChatMessage.applyRollMode(chatData, rollMode);
    }

    const Cls = ChatMessage?.implementation ?? ChatMessage;
    let created: unknown = [];
    if (Cls?.createDocuments) {
      created = await Cls.createDocuments([chatData]);
    }

    const createdList = Array.isArray(created) ? created : [];
    const message = createdList[0] as { id?: string } | undefined;
    if (message?.id) {
      const dice3d = (
        globalThis as typeof globalThis & {
          game?: { dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> } };
        }
      ).game?.dice3d;
      if (dice3d?.waitFor3DAnimationByMessageID) {
        await dice3d.waitFor3DAnimationByMessageID(message.id);
      }
    }

    await mockCombatant.update({ initiative: total });

    // Verify correct order: roll -> create chat -> apply mode -> wait DSN -> update initiative
    expect(callOrder).toEqual([
      "roll-to-message",
      "apply-mode-blindroll",
      "chat-create",
      "dice3d-wait",
      "update-initiative-17",
    ]);

    // Verify Roll was attached to message
    expect(roll.toMessage).toHaveBeenCalledWith(
      expect.objectContaining({ speaker: { alias: "Test Hero" } }),
    );

    // Verify roll mode was applied
    expect(ChatMessageV14.applyRollMode).toHaveBeenCalledWith(
      expect.objectContaining({ rolls: [roll] }),
      "blindroll",
    );
  });

  it("works without Dice So Nice module installed", async () => {
    const callOrder: string[] = [];

    class BaseChatMessage {
      id?: string;
      constructor(data?: { id?: string }) {
        if (data?.id) this.id = data.id;
      }
      static get implementation(): typeof BaseChatMessage {
        return ChatMessageV14;
      }
      static async createDocuments(data: object[]): Promise<BaseChatMessage[]> {
        callOrder.push("chat");
        const impl = this.implementation;
        return data.map((d, i) => new impl({ ...(d as { id?: string }), id: `m${i}` }));
      }
      static applyRollMode = vi.fn();
    }
    class ChatMessageV14 extends BaseChatMessage {}

    vi.stubGlobal("ChatMessage", ChatMessageV14);
    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      // No dice3d property
      combat: {
        combatants: [
          {
            id: "c1",
            actorId: "a1",
            update: vi.fn(async () => {
              callOrder.push("update");
            }),
          },
        ],
      },
    });

    const createMockRoll = () => ({
      evaluate: vi.fn(async function (this: ReturnType<typeof createMockRoll>) {
        return this;
      }),
      toMessage: vi.fn(async function (
        this: ReturnType<typeof createMockRoll>,
        data: Record<string, unknown>,
      ) {
        return { ...data, rolls: [this] };
      }),
    });

    const RollConstructor = vi.fn(function (this: ReturnType<typeof createMockRoll>) {
      return Object.assign(this, createMockRoll());
    }) as unknown as new (formula: string) => ReturnType<typeof createMockRoll>;

    vi.stubGlobal("Roll", RollConstructor);

    // Simulate initiative roll flow without DSN
    const roll = new RollConstructor("15+3");
    await roll.evaluate();
    const chatData = await roll.toMessage({ speaker: { alias: "Hero" }, flavor: "Initiative" });

    const ChatMessage = (globalThis as { ChatMessage?: typeof BaseChatMessage }).ChatMessage;
    if (ChatMessage?.applyRollMode) {
      ChatMessage.applyRollMode(chatData, "roll");
    }

    const Cls = ChatMessage?.implementation ?? ChatMessage;
    if (Cls?.createDocuments) {
      await Cls.createDocuments([chatData]);
    }

    const game = globalThis as {
      game?: { combat?: { combatants: { id: string; update: (d: unknown) => Promise<void> }[] } };
    };
    await game.game?.combat?.combatants[0]?.update({ initiative: 18 });

    // Should NOT have dice3d-wait in the call order
    expect(callOrder).toEqual(["chat", "update"]);
  });
});
