import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("D20 roll attachments for Dice So Nice!", () => {
  it("attaches pool roll to ChatMessage for ability check", async () => {
    const { promptRollMode, prepareCharacterSheetContext } =
      await import("../../src/sheets/character-sheet");

    vi.spyOn({ promptRollMode }, "promptRollMode").mockResolvedValue("normal");

    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-123",
      ...data,
    }));

    const applyRollMode = vi.fn();

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode,
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 12 }] }];
        total = 12;
        async evaluate() {
          return this;
        }
        toMessage = vi.fn(async (data: Record<string, unknown>) => {
          return { id: "msg-456", rolls: [this], ...data };
        });
        constructor(public formula: string) {}
      },
    );

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn().mockResolvedValue("normal") } } },
    });

    vi.stubGlobal("game", { i18n: { localize: (key: string) => key } });

    const actor = {
      name: "Hero",
      type: "character",
      system: {
        progression: { level: 5 },
        abilities: {
          str: { score: 16, primary: true },
          dex: { score: 14, primary: false },
          con: { score: 12, primary: true },
          int: { score: 10, primary: false },
          wis: { score: 13, primary: false },
          cha: { score: 8, primary: false },
        },
        skills: {},
      },
      items: [],
    };

    prepareCharacterSheetContext(actor);
    const { createPivotCharacterSheetClass } = await import("../../src/sheets/character-sheet");

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
      .DEFAULT_OPTIONS?.actions?.roll;

    if (typeof rollAction === "function") {
      await rollAction.call(
        sheet,
        new Event("click") as never,
        {
          dataset: { rollKind: "ability", key: "str", label: "Strength" },
        } as never,
      );
    }

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const messageData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(messageData.rolls).toBeDefined();
    expect(Array.isArray(messageData.rolls)).toBe(true);
    const rolls = messageData.rolls as { formula?: string; dice?: unknown[] }[];
    expect(rolls.length).toBe(1);
    expect(rolls[0]?.formula).toBe("1d20");
    expect(rolls[0]?.dice).toBeDefined();
  });

  it("fails when pool roll is not attached", async () => {
    const { promptRollMode } = await import("../../src/sheets/character-sheet");

    vi.spyOn({ promptRollMode }, "promptRollMode").mockResolvedValue("advantage");

    const chatCreate = vi.fn(async (data: Record<string, unknown>) => ({
      id: "msg-789",
      ...data,
    }));

    vi.stubGlobal("ChatMessage", {
      create: chatCreate,
      applyRollMode: vi.fn(),
      getSpeaker: () => ({ alias: "Hero" }),
    });

    vi.stubGlobal(
      "Roll",
      class {
        dice = [{ faces: 20, results: [{ result: 15 }, { result: 8 }] }];
        total = 15;
        async evaluate() {
          return this;
        }
        toMessage = vi.fn(async (data: Record<string, unknown>) => {
          return { id: "msg-790", rolls: [this], ...data };
        });
        constructor(public formula: string) {}
      },
    );

    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { prompt: vi.fn().mockResolvedValue("advantage") } } },
    });

    vi.stubGlobal("game", { i18n: { localize: (key: string) => key } });

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
      .DEFAULT_OPTIONS?.actions?.roll;

    if (typeof rollAction === "function") {
      await rollAction.call(
        sheet,
        new Event("click") as never,
        {
          dataset: { rollKind: "save", key: "str", label: "Strength Save" },
        } as never,
      );
    }

    expect(chatCreate).toHaveBeenCalledTimes(1);
    const messageData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const rolls = messageData.rolls as { formula?: string }[];
    expect(rolls[0]?.formula).toBe("2d20");
  });
});
