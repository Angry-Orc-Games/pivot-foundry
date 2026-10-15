import { afterEach, describe, expect, it, vi } from "vitest";
import { shortRestDialog } from "../../src/runtime/rest-dialogs";

afterEach(() => vi.unstubAllGlobals());

describe("Short rest roll attachments for Dice So Nice!", () => {
  it("attaches all hit die rolls to short rest chat message", async () => {
    const prompt = vi.fn().mockResolvedValueOnce({ poolSpendsRaw: "2", inDanger: false });

    vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });

    const chatCreate = vi.fn(async (data: unknown) => data);
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

    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => key,
        format: (key: string) => key,
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

  it("preserves short rest chat content with roll attachment", async () => {
    const prompt = vi.fn().mockResolvedValueOnce({ poolSpendsRaw: "1", inDanger: false });

    vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });

    let capturedContent = "";
    const chatCreate = vi.fn(async (data: Record<string, unknown>) => {
      capturedContent = String(data.content ?? "");
      return data;
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
    expect(capturedContent).toContain("PIVOT.Rest.ShortRestComplete");
    expect(capturedContent).toContain("PIVOT.Rest.PoolSpent");
    expect(capturedContent).toContain("PIVOT.Rest.HpHealed");
  });
});
