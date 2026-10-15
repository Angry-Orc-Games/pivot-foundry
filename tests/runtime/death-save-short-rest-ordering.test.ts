import { afterEach, describe, expect, it, vi } from "vitest";
import { deathSaveDialog } from "../../src/runtime/death-saves";
import { shortRestDialog } from "../../src/runtime/rest-dialogs";

afterEach(() => vi.unstubAllGlobals());

describe("Death save roll attachments and ordering", () => {
  it("attaches roll to death save chat message", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-123",
      ...(data as object),
    }));

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 15 }] }];
        async evaluate() {
          return this;
        }
      },
    );

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    const actor = {
      uuid: "Actor.test",
      isOwner: true,
      name: "Hero",
      type: "character",
      system: {
        attributes: {
          hp: { value: 0, max: 20, temp: 0 },
          deathSaves: { status: "dying", successes: 0, failures: 0 },
        },
      },
      update: vi.fn(async () => ({})),
    };

    await deathSaveDialog(actor);

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const chatData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(chatData.rolls).toBeDefined();
    expect(Array.isArray(chatData.rolls)).toBe(true);
    expect((chatData.rolls as unknown[]).length).toBe(1);
  });

  it("creates chat then waits then updates actor for death save", async () => {
    const callOrder: string[] = [];

    const chatCreate = vi.fn(async (data: Record<string, unknown>) => {
      callOrder.push("chat");
      return { id: "msg-456", ...(data as object) };
    });

    const actorUpdate = vi.fn(async () => {
      callOrder.push("update");
      return {};
    });

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 10 }] }];
        async evaluate() {
          return this;
        }
      },
    );

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          callOrder.push("dice3d");
        }),
      },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    const actor = {
      uuid: "Actor.test2",
      isOwner: true,
      name: "Hero",
      type: "character",
      system: {
        attributes: {
          hp: { value: 0, max: 20, temp: 0 },
          deathSaves: { status: "dying", successes: 0, failures: 0 },
        },
      },
      update: actorUpdate,
    };

    await deathSaveDialog(actor);

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
  });

  it("fails when death save roll is not attached", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => {
      if (!data.rolls || !Array.isArray(data.rolls) || data.rolls.length === 0) {
        throw new Error("Expected rolls array with at least one roll");
      }
      return { id: "msg-789", ...data };
    });

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 18 }] }];
        async evaluate() {
          return this;
        }
      },
    );

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    const actor = {
      uuid: "Actor.test3",
      isOwner: true,
      name: "Hero",
      type: "character",
      system: {
        attributes: {
          hp: { value: 0, max: 20, temp: 0 },
          deathSaves: { status: "dying", successes: 0, failures: 0 },
        },
      },
      update: vi.fn(async () => ({})),
    };

    await deathSaveDialog(actor);

    expect(chatCreate).toHaveBeenCalledTimes(1);
  });
});

describe("Short rest roll attachments and ordering", () => {
  it("attaches all hit die rolls to chat message", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-short-1",
      ...(data as object),
    }));

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
    });

    vi.stubGlobal(
      "Roll",
      class {
        total = 5;
        async evaluate() {
          return this;
        }
      },
    );

    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => key,
        format: (key: string) => key,
      },
    });

    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            prompt: vi.fn().mockResolvedValue({ poolSpendsRaw: "2", inDanger: false }),
          },
        },
      },
    });

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        abilities: { con: { score: 14 } },
        attributes: {
          hp: { value: 10, max: 20, temp: 0 },
          hitDie: "d8",
        },
        resources: { pool: { value: 3, maxBonus: 0 } },
        progression: { level: 5 },
        skills: {},
        magic: { awakened: false },
      },
      items: [],
      update: vi.fn(async () => ({})),
    };

    await shortRestDialog(actor);

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const chatData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(chatData.rolls).toBeDefined();
    expect(Array.isArray(chatData.rolls)).toBe(true);
    expect((chatData.rolls as unknown[]).length).toBeGreaterThan(0);
  });

  it("creates chat then waits then updates actor for short rest", async () => {
    const callOrder: string[] = [];

    const chatCreate = vi.fn(async (data: Record<string, unknown>) => {
      callOrder.push("chat");
      return { id: "msg-short-2", ...(data as object) };
    });

    const actorUpdate = vi.fn(async () => {
      callOrder.push("update");
      return {};
    });

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
    });

    vi.stubGlobal(
      "Roll",
      class {
        total = 6;
        async evaluate() {
          return this;
        }
      },
    );

    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => key,
        format: (key: string) => key,
      },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          callOrder.push("dice3d");
        }),
      },
    });

    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            prompt: vi.fn().mockResolvedValue({ poolSpendsRaw: "1", inDanger: false }),
          },
        },
      },
    });

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        abilities: { con: { score: 12 } },
        attributes: {
          hp: { value: 8, max: 20, temp: 0 },
          hitDie: "d8",
        },
        resources: { pool: { value: 2, maxBonus: 0 } },
        progression: { level: 3 },
        skills: {},
        magic: { awakened: false },
      },
      items: [],
      update: actorUpdate,
    };

    await shortRestDialog(actor);

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
  });
});
