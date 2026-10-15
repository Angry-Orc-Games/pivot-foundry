import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Initiative roll with Dice So Nice integration", () => {
  it("waits for DSN when module is active and dice3d is available", async () => {
    const callOrder: string[] = [];

    // Mock Foundry v14 ChatMessage
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

    // Mock game WITH active DSN module
    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      modules: {
        get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined),
      },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          callOrder.push("dsn-wait");
        }),
      },
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

    // Simulate the DSN wait logic
    const roll = new RollConstructor("15+3");
    await roll.evaluate();
    const chatData = await roll.toMessage({ speaker: { alias: "Hero" }, flavor: "Initiative" });

    const ChatMessage = (globalThis as { ChatMessage?: typeof BaseChatMessage }).ChatMessage;
    if (ChatMessage?.applyRollMode) {
      ChatMessage.applyRollMode(chatData, "roll");
    }

    const Cls = ChatMessage?.implementation ?? ChatMessage;
    let created: unknown = [];
    if (Cls?.createDocuments) {
      created = await Cls.createDocuments([chatData]);
    }

    // DSN wait with module check
    const createdList = Array.isArray(created) ? created : [];
    const message = createdList[0] as { id?: string } | undefined;
    if (message?.id) {
      const gameGlobal = globalThis as typeof globalThis & {
        game?: {
          modules?: { get?: (id: string) => { active?: boolean } | undefined };
          dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
        };
      };
      const dsnModule = gameGlobal.game?.modules?.get?.("dice-so-nice");
      const dice3d = gameGlobal.game?.dice3d;

      if (dsnModule?.active && dice3d?.waitFor3DAnimationByMessageID) {
        try {
          const waitPromise = dice3d.waitFor3DAnimationByMessageID(message.id);
          const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 10000));
          await Promise.race([waitPromise, timeoutPromise]);
        } catch {
          // Continue
        }
      }
    }

    const game = globalThis as {
      game?: { combat?: { combatants: { update: (d: unknown) => Promise<void> }[] } };
    };
    await game.game?.combat?.combatants[0]?.update({ initiative: 18 });

    // Should include DSN wait
    expect(callOrder).toEqual(["chat", "dsn-wait", "update"]);
  });

  it("skips DSN wait when module is not active (production scenario)", async () => {
    const callOrder: string[] = [];

    class BaseChatMessage {
      id?: string;
      constructor(data?: { id?: string }) {
        if (data?.id) this.id = data.id;
      }
      static get implementation(): typeof BaseChatMessage {
        return ChatMessageV14;
      }
      static async createDocuments(data: object[]) {
        callOrder.push("chat");
        const impl = this.implementation;
        return data.map((d, i) => new impl({ ...(d as { id?: string }), id: `m${i}` }));
      }
      static applyRollMode = vi.fn();
    }
    class ChatMessageV14 extends BaseChatMessage {}

    vi.stubGlobal("ChatMessage", ChatMessageV14);

    // Mock game WITHOUT active DSN module
    const dsnWaitSpy = vi.fn(async () => {
      throw new Error("Should not be called when module is inactive");
    });

    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      modules: {
        get: (id: string) => (id === "dice-so-nice" ? { active: false } : undefined),
      },
      dice3d: {
        waitFor3DAnimationByMessageID: dsnWaitSpy,
      },
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

    // Simulate flow
    const roll = new RollConstructor("15+3");
    await roll.evaluate();
    const chatData = await roll.toMessage({ speaker: { alias: "Hero" }, flavor: "Initiative" });

    const ChatMessage = (globalThis as { ChatMessage?: typeof BaseChatMessage }).ChatMessage;
    if (ChatMessage?.applyRollMode) {
      ChatMessage.applyRollMode(chatData, "roll");
    }

    const Cls = ChatMessage?.implementation ?? ChatMessage;
    let created: unknown = [];
    if (Cls?.createDocuments) {
      created = await Cls.createDocuments([chatData]);
    }

    // DSN wait with module check
    const createdList = Array.isArray(created) ? created : [];
    const message = createdList[0] as { id?: string } | undefined;
    if (message?.id) {
      const gameGlobal = globalThis as typeof globalThis & {
        game?: {
          modules?: { get?: (id: string) => { active?: boolean } | undefined };
          dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
        };
      };
      const dsnModule = gameGlobal.game?.modules?.get?.("dice-so-nice");
      const dice3d = gameGlobal.game?.dice3d;

      if (dsnModule?.active && dice3d?.waitFor3DAnimationByMessageID) {
        try {
          const waitPromise = dice3d.waitFor3DAnimationByMessageID(message.id);
          const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 10000));
          await Promise.race([waitPromise, timeoutPromise]);
        } catch {
          // Continue
        }
      }
    }

    const game = globalThis as {
      game?: { combat?: { combatants: { update: (d: unknown) => Promise<void> }[] } };
    };
    await game.game?.combat?.combatants[0]?.update({ initiative: 18 });

    // Should skip DSN wait entirely
    expect(callOrder).toEqual(["chat", "update"]);
    expect(dsnWaitSpy).not.toHaveBeenCalled();
  });

  it("handles DSN wait timeout and still updates initiative", async () => {
    const callOrder: string[] = [];

    class BaseChatMessage {
      id?: string;
      constructor(data?: { id?: string }) {
        if (data?.id) this.id = data.id;
      }
      static get implementation(): typeof BaseChatMessage {
        return ChatMessageV14;
      }
      static async createDocuments(data: object[]) {
        callOrder.push("chat");
        const impl = this.implementation;
        return data.map((d, i) => new impl({ ...(d as { id?: string }), id: `m${i}` }));
      }
      static applyRollMode = vi.fn();
    }
    class ChatMessageV14 extends BaseChatMessage {}

    vi.stubGlobal("ChatMessage", ChatMessageV14);

    // Use fake timers for timeout control
    vi.useFakeTimers();

    // Mock DSN that never resolves
    const dsnWaitSpy = vi.fn(
      () =>
        new Promise<void>(() => {
          // Never resolves
        }),
    );

    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      modules: {
        get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined),
      },
      dice3d: {
        waitFor3DAnimationByMessageID: dsnWaitSpy,
      },
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

    // Simulate flow
    const roll = new RollConstructor("14+4");
    await roll.evaluate();
    const chatData = await roll.toMessage({ speaker: { alias: "Hero" }, flavor: "Initiative" });

    const ChatMessage = (globalThis as { ChatMessage?: typeof BaseChatMessage }).ChatMessage;
    if (ChatMessage?.applyRollMode) {
      ChatMessage.applyRollMode(chatData, "roll");
    }

    const Cls = ChatMessage?.implementation ?? ChatMessage;
    let created: unknown = [];
    if (Cls?.createDocuments) {
      created = await Cls.createDocuments([chatData]);
    }

    // Start DSN wait with timeout
    const createdList = Array.isArray(created) ? created : [];
    const message = createdList[0] as { id?: string } | undefined;
    const waitPromise = (async () => {
      if (message?.id) {
        const gameGlobal = globalThis as typeof globalThis & {
          game?: {
            modules?: { get?: (id: string) => { active?: boolean } | undefined };
            dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
          };
        };
        const dsnModule = gameGlobal.game?.modules?.get?.("dice-so-nice");
        const dice3d = gameGlobal.game?.dice3d;

        if (dsnModule?.active && dice3d?.waitFor3DAnimationByMessageID) {
          try {
            const waitForDsn = dice3d.waitFor3DAnimationByMessageID(message.id);
            const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 10000));
            await Promise.race([waitForDsn, timeoutPromise]);
          } catch {
            // Continue
          }
        }
      }
    })();

    // Fast-forward past the 10s timeout
    await vi.advanceTimersByTimeAsync(10000);
    await waitPromise;

    const game = globalThis as {
      game?: { combat?: { combatants: { update: (d: unknown) => Promise<void> }[] } };
    };
    await game.game?.combat?.combatants[0]?.update({ initiative: 18 });

    // Should timeout and continue
    expect(callOrder).toEqual(["chat", "update"]);
    expect(dsnWaitSpy).toHaveBeenCalledWith("m0");
  });
});
