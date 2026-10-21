import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { damageRollDialog } from "../../src/runtime/damage-roll";
import { deathSaveDialog } from "../../src/runtime/death-saves";
import { shortRestDialog } from "../../src/runtime/rest-dialogs";
import { waitForDiceSoNiceAnimation } from "../../src/runtime/dice-so-nice";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Roll mode preservation", () => {
  it("preserves GM-only roll mode from game settings", async () => {
    let capturedRollMode: string | undefined;

    vi.stubGlobal("game", {
      settings: {
        get: (scope: string, key: string) => {
          if (scope === "core" && key === "rollMode") return "gmroll";
          return undefined;
        },
      },
      i18n: { localize: (key: string) => key },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => ({ id: "msg-1" })),
      applyRollMode: (data: Record<string, unknown>, mode: string) => {
        capturedRollMode = mode;
      },
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 15 }] }];
        async evaluate() {
          return this;
        }
        async render() {
          return "<div>15</div>";
        }
      },
    );

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        progression: { level: 5 },
        abilities: { str: { score: 16, primary: true } },
        skills: {},
      },
      items: [],
    };

    const { createPivotCharacterSheetClass, prepareCharacterSheetContext } =
      await import("../../src/sheets/character-sheet");

    prepareCharacterSheetContext(actor);

    const SheetClass = createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          // eslint-disable-next-line @typescript-eslint/no-extraneous-class
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
          },
        },
      },
    } as never);

    const sheet = new SheetClass();
    Object.defineProperty(sheet, "document", { value: actor, writable: true });

    const rollAction = (SheetClass as { DEFAULT_OPTIONS?: { actions?: { roll?: unknown } } })
      .DEFAULT_OPTIONS?.actions?.roll as (
      this: unknown,
      event: Event,
      target: { dataset: Record<string, string> },
    ) => Promise<void>;

    expect(rollAction).toBeTypeOf("function");
    await rollAction.call(
      sheet,
      new Event("click") as never,
      {
        dataset: { rollKind: "ability", key: "str", label: "Strength" },
      } as never,
    );

    expect(capturedRollMode).toBe("gmroll");
  });
});

describe("Initiative waits for Dice3D animation", () => {
  it("waits for animation before updating combat tracker", async () => {
    const callOrder: string[] = [];

    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      i18n: { localize: (key: string) => key },
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          callOrder.push("dice3d");
        }),
      },
      combat: {
        combatants: [{ id: "c1", actorId: "actor-1", update: vi.fn(async () => {}) }],
      },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => {
        callOrder.push("chat");
        return { id: "msg-init" };
      }),
      applyRollMode: vi.fn(),
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 12 }] }];
        async evaluate() {
          return this;
        }
        async render() {
          return "<div>15</div>";
        }
        async toMessage(data: Record<string, unknown>) {
          return { ...data, rolls: [this] };
        }
      },
    );

    const actor = {
      id: "actor-1",
      name: "Hero",
      type: "character",
      system: {
        progression: { level: 5 },
        abilities: { dex: { score: 14, primary: false } },
        skills: {},
        attributes: { initiative: { bonus: 2 } },
      },
      items: [],
    };

    const { createPivotCharacterSheetClass, prepareCharacterSheetContext } =
      await import("../../src/sheets/character-sheet");

    prepareCharacterSheetContext(actor);

    const SheetClass = createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          // eslint-disable-next-line @typescript-eslint/no-extraneous-class
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
          },
        },
      },
    } as never);

    const sheet = new SheetClass();
    Object.defineProperty(sheet, "document", { value: actor, writable: true });

    const rollAction = (SheetClass as { DEFAULT_OPTIONS?: { actions?: { roll?: unknown } } })
      .DEFAULT_OPTIONS?.actions?.roll as (
      this: unknown,
      event: Event,
      target: { dataset: Record<string, string> },
    ) => Promise<void>;

    expect(rollAction).toBeTypeOf("function");
    await rollAction.call(
      sheet,
      new Event("click") as never,
      {
        dataset: { rollKind: "initiative", label: "Initiative" },
      } as never,
    );

    expect(callOrder).toEqual(["chat", "dice3d"]);
  });
});

describe("Damage roll attachment", () => {
  it("attaches all exploding dice rolls to chat message", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-dmg",
      ...(data as object),
    }));

    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            prompt: vi.fn().mockResolvedValue({
              formula: "2d6",
              kind: "damage",
              critical: false,
              enhanced: false,
            }),
          },
        },
      },
    });

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
    });

    const rollInstances: unknown[] = [];
    vi.stubGlobal(
      "Roll",
      class {
        total = 5;
        async evaluate() {
          return this;
        }
        constructor(formula: string) {
          rollInstances.push({ formula, instance: this });
        }
      },
    );

    await damageRollDialog({ name: "Hero", uuid: "Actor.test" });

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const chatData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(chatData.rolls).toBeDefined();
    expect(Array.isArray(chatData.rolls)).toBe(true);
    expect((chatData.rolls as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("Dice So Nice wait timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("resolves after 10 seconds if animation hangs", async () => {
    const neverResolves = new Promise(() => {
      // Never resolves
    });

    const message = { id: "msg-timeout" };

    vi.stubGlobal("game", {
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(() => neverResolves),
      },
    });

    const waitPromise = waitForDiceSoNiceAnimation(message);

    // Fast-forward 10 seconds
    await vi.advanceTimersByTimeAsync(10000);

    await expect(waitPromise).resolves.toBeUndefined();
  });
});

describe("Death save ordering", () => {
  it("creates chat then waits then updates actor", async () => {
    const callOrder: string[] = [];

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => {
        callOrder.push("chat");
        return { id: "msg-death" };
      }),
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
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
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
      uuid: "Actor.death-test",
      isOwner: true,
      name: "Hero",
      type: "character",
      system: {
        attributes: {
          hp: { value: 0, max: 20, temp: 0 },
          deathSaves: { status: "dying", successes: 0, failures: 0 },
        },
      },
      update: vi.fn(async () => {
        callOrder.push("update");
        return {};
      }),
    };

    await deathSaveDialog(actor);

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
  });

  it("attaches roll with dice to death save chat message", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-death-rolls",
      ...(data as object),
    }));

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
        waitFor3DAnimationByMessageID: vi.fn(async () => {}),
      },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    const actor = {
      uuid: "Actor.death-test-2",
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
    const rolls = chatData.rolls as { dice?: unknown[] }[];
    expect(rolls.length).toBe(1);
    expect(rolls[0]?.dice).toBeDefined();
  });

  it("warns ReportFailed on chat failure but still updates actor", async () => {
    const warnSpy = vi.fn();

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => {
        throw new Error("Chat creation failed");
      }),
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
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {}),
      },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    vi.stubGlobal("ui", {
      notifications: {
        warn: warnSpy,
      },
    });

    const updateSpy = vi.fn(async () => ({}));

    const actor = {
      uuid: "Actor.death-test-3",
      isOwner: true,
      name: "Hero",
      type: "character",
      system: {
        attributes: {
          hp: { value: 0, max: 20, temp: 0 },
          deathSaves: { status: "dying", successes: 0, failures: 0 },
        },
      },
      update: updateSpy,
    };

    await deathSaveDialog(actor);

    expect(warnSpy).toHaveBeenCalledWith("PIVOT.Survival.ReportFailed");
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});

describe("Short rest ordering", () => {
  it("creates chat then waits then updates actor", async () => {
    const callOrder: string[] = [];

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => {
        callOrder.push("chat");
        return { id: "msg-rest" };
      }),
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
      modules: { get: (id: string) => (id === "dice-so-nice" ? { active: true } : undefined) },
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
      update: vi.fn(async () => {
        callOrder.push("update");
        return {};
      }),
    };

    await shortRestDialog(actor);

    expect(callOrder).toEqual(["chat", "dice3d", "update"]);
  });

  it("attaches rolls with dice to short rest chat message", async () => {
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-rest-rolls",
      ...(data as object),
    }));

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
        waitFor3DAnimationByMessageID: vi.fn(async () => {}),
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
      update: vi.fn(async () => ({})),
    };

    await shortRestDialog(actor);

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const chatData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(chatData.rolls).toBeDefined();
    expect(Array.isArray(chatData.rolls)).toBe(true);
    expect((chatData.rolls as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("Short Rest cancel is a clean no-op", () => {
  it("does not throw when dialog cancel returns undefined fields", async () => {
    const warnSpy = vi.fn();
    const updateSpy = vi.fn(async () => ({}));

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => ({ id: "should-not-create" })),
      applyMode: vi.fn(),
      applyRollMode: vi.fn(),
    });

    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key, format: (key: string) => key },
    });

    vi.stubGlobal("ui", {
      notifications: { warn: warnSpy },
    });

    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            // Foundry cancel / dismiss can resolve to a non-null non-form value
            prompt: vi.fn().mockResolvedValue({ poolSpendsRaw: undefined, inDanger: false }),
          },
        },
      },
    });

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        abilities: { con: { score: 12 } },
        attributes: { hp: { value: 8, max: 20, temp: 0 }, hitDie: "d8" },
        resources: { pool: { value: 2, maxBonus: 0 } },
        progression: { level: 3 },
        skills: {},
        magic: { awakened: false },
      },
      items: [],
      update: updateSpy,
    };

    await expect(shortRestDialog(actor)).resolves.toBeUndefined();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not throw when dialog cancel returns a bare action string", async () => {
    vi.stubGlobal("ChatMessage", {
      create: vi.fn(),
      applyMode: vi.fn(),
    });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key, format: (key: string) => key },
    });
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            prompt: vi.fn().mockResolvedValue("cancel"),
          },
        },
      },
    });

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        abilities: { con: { score: 12 } },
        attributes: { hp: { value: 8, max: 20, temp: 0 }, hitDie: "d8" },
        resources: { pool: { value: 2, maxBonus: 0 } },
        progression: { level: 3 },
        skills: {},
        magic: { awakened: false },
      },
      items: [],
      update: vi.fn(async () => ({})),
    };

    await expect(shortRestDialog(actor)).resolves.toBeUndefined();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Sheet initiative targets active combat", () => {
  it("updates combatant on combats.active, not viewed inactive encounter", async () => {
    const activeUpdate = vi.fn(async () => {});
    const inactiveUpdate = vi.fn(async () => {});

    const inactiveCombat = {
      id: "w4EanWvgyzXg1Etw",
      active: false,
      combatants: [{ id: "old-c", actorId: "actor-1", update: inactiveUpdate }],
    };
    const activeCombat = {
      id: "active-combat",
      active: true,
      combatants: [{ id: "c1", actorId: "actor-1", update: activeUpdate }],
    };

    vi.stubGlobal("game", {
      settings: { get: () => "roll" },
      i18n: { localize: (key: string) => key },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {}),
      },
      combat: inactiveCombat,
      combats: {
        active: activeCombat,
        viewed: inactiveCombat,
        contents: [inactiveCombat, activeCombat],
      },
    });

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn(async () => "normal") } } },
    });

    vi.stubGlobal("ChatMessage", {
      create: vi.fn(async () => ({ id: "msg-init-active" })),
      applyMode: vi.fn(),
      applyRollMode: vi.fn(),
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 12 }] }];
        async evaluate() {
          return this;
        }
        async render() {
          return "<div>15</div>";
        }
        async toMessage(data: Record<string, unknown>) {
          return { ...data, rolls: [this] };
        }
      },
    );

    const actor = {
      id: "actor-1",
      name: "Hero",
      type: "character",
      system: {
        progression: { level: 5 },
        abilities: { dex: { score: 14, primary: false } },
        skills: {},
        attributes: { initiative: { bonus: 2 } },
      },
      items: [],
    };

    const { createPivotCharacterSheetClass, prepareCharacterSheetContext } =
      await import("../../src/sheets/character-sheet");

    prepareCharacterSheetContext(actor);

    const SheetClass = createPivotCharacterSheetClass({
      applications: {
        api: { HandlebarsApplicationMixin: (base: unknown) => base },
        sheets: {
          // eslint-disable-next-line @typescript-eslint/no-extraneous-class
          ActorSheetV2: class ActorSheetV2 {
            static DEFAULT_OPTIONS = {};
          },
        },
      },
    } as never);

    const sheet = new SheetClass();
    Object.defineProperty(sheet, "document", { value: actor, writable: true });

    const rollAction = (SheetClass as { DEFAULT_OPTIONS?: { actions?: { roll?: unknown } } })
      .DEFAULT_OPTIONS?.actions?.roll as (
      this: unknown,
      event: Event,
      target: { dataset: Record<string, string> },
    ) => Promise<void>;

    await rollAction.call(
      sheet,
      new Event("click") as never,
      {
        dataset: { rollKind: "initiative", label: "Initiative" },
      } as never,
    );

    expect(activeUpdate).toHaveBeenCalled();
    expect(inactiveUpdate).not.toHaveBeenCalled();
  });
});
