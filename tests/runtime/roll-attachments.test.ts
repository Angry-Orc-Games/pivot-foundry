import { afterEach, describe, expect, it, vi } from "vitest";
import { damageRollDialog } from "../../src/runtime/damage-roll";

afterEach(() => vi.unstubAllGlobals());

describe("Roll attachments for Dice So Nice!", () => {
  describe("damageRollDialog", () => {
    it("attaches roll objects to chat message for exploding damage", async () => {
      const prompt = vi.fn().mockResolvedValueOnce({
        formula: "1d6",
        kind: "damage",
        critical: false,
        enhanced: false,
      });

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
          total = 4;
          async evaluate() {
            return this;
          }
          constructor(formula: string) {
            rollInstances.push({ formula, instance: this });
          }
        },
      );

      await damageRollDialog({ name: "Hero", uuid: "Actor.test" }, "1d6");

      expect(chatCreate).toHaveBeenCalledTimes(1);
      const chatData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(chatData.rolls).toBeDefined();
      expect(Array.isArray(chatData.rolls)).toBe(true);
      expect((chatData.rolls as unknown[]).length).toBeGreaterThan(0);
    });

    it("attaches roll to ordinary formula fallback", async () => {
      const prompt = vi
        .fn()
        .mockResolvedValueOnce({
          formula: "1d6+@bonus",
          kind: "damage",
          critical: false,
          enhanced: false,
        })
        .mockResolvedValueOnce(true);

      vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });

      const toMessage = vi.fn(async () => ({}));
      vi.stubGlobal(
        "Roll",
        class {
          total = 8;
          async evaluate() {
            return this;
          }
          toMessage = toMessage;
        },
      );

      await damageRollDialog({ name: "Hero", getRollData: () => ({ bonus: 4 }) }, "1d6+@bonus");

      expect(toMessage).toHaveBeenCalledTimes(1);
      expect(toMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          rolls: expect.arrayContaining([expect.anything()]),
        }),
      );
    });
  });
});

describe("Roll content preservation", () => {
  it("preserves chat card content with roll attachment for damage", async () => {
    const prompt = vi.fn().mockResolvedValueOnce({
      formula: "2d6+3",
      kind: "damage",
      critical: false,
      enhanced: false,
    });

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
        total = 4;
        async evaluate() {
          return this;
        }
      },
    );

    await damageRollDialog({ name: "Hero", uuid: "Actor.test" }, "2d6+3");

    expect(chatCreate).toHaveBeenCalledTimes(1);
    if (chatCreate.mock.calls.length > 0) {
      expect(capturedContent).toContain("Hero");
      expect(capturedContent).toContain("2d6+3");
      expect(capturedContent).toContain("data-pivot-apply");
    }
  });
});
