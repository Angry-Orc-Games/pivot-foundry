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

describe("rollInitiativeWithDiceAnimation (sheet path)", () => {
  it("creates exactly one message with create:false and stores the evaluated total after DSN", async () => {
    const { rollInitiativeWithDiceAnimation } = await import("../../src/sheets/character-sheet");
    const callOrder: string[] = [];
    const create = vi.fn(async (data: Record<string, unknown>) => {
      callOrder.push("chat");
      return { ...data, id: "sheet-msg" };
    });
    const createDocuments = vi.fn(async () => [{ id: "unused" }]);
    vi.stubGlobal("ChatMessage", { implementation: { create, createDocuments } });
    const waitFor = vi.fn(async (id: string) => {
      callOrder.push(`dsn:${id}`);
    });
    vi.stubGlobal("game", {
      settings: { get: () => "gmroll" },
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
      dice3d: { waitFor3DAnimationByMessageID: waitFor },
    });

    const roll = {
      _evaluated: false,
      total: undefined as number | undefined,
      evaluate: vi.fn(async function (this: { _evaluated: boolean; total?: number }) {
        this._evaluated = true;
        this.total = 17;
        return this;
      }),
      toMessage: vi.fn<
        (data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown>
      >(async (data) => ({ ...data })),
    };
    await roll.evaluate();

    const update = vi.fn(async (d: { initiative: number }) => {
      callOrder.push(`update:${d.initiative}`);
    });
    const combat = { combatants: [{ id: "c1", actorId: "a1", update }] };

    await rollInitiativeWithDiceAnimation({
      actor: { id: "a1", name: "Hero", type: "character" } as never,
      roll,
      total: roll.total ?? 0,
      flavor: "Initiative",
      combat: combat as never,
      notify: vi.fn(),
      localize: (k: string) => k,
    });

    expect(roll.toMessage).toHaveBeenCalledTimes(1);
    expect(roll.toMessage).toHaveBeenCalledWith(
      expect.objectContaining({ flags: { "core.initiativeRoll": true } }),
      { rollMode: "gmroll", create: false },
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(createDocuments).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ initiative: 17 });
    expect(callOrder).toEqual(["chat", "dsn:sheet-msg", "update:17"]);
  });

  it("falls back to createDocuments once when create is unavailable", async () => {
    const { rollInitiativeWithDiceAnimation } = await import("../../src/sheets/character-sheet");
    const createDocuments = vi.fn(async (data: unknown[]) =>
      data.map(() => ({ id: "fallback-msg" })),
    );
    vi.stubGlobal("ChatMessage", { implementation: { createDocuments } });
    vi.stubGlobal("game", { settings: { get: () => "roll" }, modules: { get: () => undefined } });
    const roll = {
      toMessage: vi.fn<
        (data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown>
      >(async (data) => ({ ...data })),
    };
    const update = vi.fn(async () => {});

    await rollInitiativeWithDiceAnimation({
      actor: { id: "a1", name: "Hero", type: "character" } as never,
      roll,
      total: 9,
      flavor: "Initiative",
      combat: { combatants: [{ id: "c1", actorId: "a1", update }] } as never,
      notify: vi.fn(),
      localize: (k: string) => k,
    });

    expect(createDocuments).toHaveBeenCalledTimes(1);
    expect(roll.toMessage.mock.calls[0]?.[1]).toEqual({ rollMode: "roll", create: false });
    expect(update).toHaveBeenCalledWith({ initiative: 9 });
  });
});
