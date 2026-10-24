import { afterEach, expect, it, vi } from "vitest";
import { damageRollDialog } from "../../src/runtime/damage-roll";
afterEach(() => vi.unstubAllGlobals());
it("keeps actor roll data for explicit ordinary formula fallback", async () => {
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
  const seen: unknown[] = [];
  const toMessage = vi.fn(async () => {});
  vi.stubGlobal(
    "Roll",
    class {
      constructor(formula: string, data: unknown) {
        seen.push(formula, data);
      }
      async evaluate() {}
      toMessage = toMessage;
    },
  );
  await damageRollDialog({ name: "Hero", getRollData: () => ({ bonus: 4 }) }, "1d6+@bonus");
  expect(seen).toEqual(["1d6+@bonus", { bonus: 4 }]);
  expect(toMessage).toHaveBeenCalledTimes(1);
});
it("cancelled unsupported fallback never rolls", async () => {
  const prompt = vi
    .fn()
    .mockResolvedValueOnce({ formula: "1d6*2", kind: "damage", critical: false, enhanced: false })
    .mockResolvedValueOnce(null);
  vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });
  const roll = vi.fn();
  vi.stubGlobal("Roll", roll);
  await damageRollDialog({ name: "Hero" });
  expect(roll).not.toHaveBeenCalled();
});

it("posts an applicable exploding damage payload and doubles critical dice", async () => {
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => ({
            formula: "1d8",
            kind: "damage",
            critical: true,
            enhanced: false,
          }),
        },
      },
    },
  });
  vi.stubGlobal(
    "Roll",
    class {
      total = 3;
      async evaluate() {}
      async toMessage() {}
    },
  );
  const create = vi.fn(async (data: { flags?: unknown }) => data);
  vi.stubGlobal("ChatMessage", { create, applyRollMode: vi.fn() });
  await damageRollDialog({ name: "Hero", uuid: "Actor.hero" }, "1d8");
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      flags: {
        "pivot-fantasy": {
          survivalRoll: {
            version: 1,
            complete: true,
            amount: 6,
            kind: "damage",
            critical: true,
            actorUuid: "Actor.hero",
          },
        },
      },
    }),
  );
});

it("does not mark healing critical or double its dice", async () => {
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => ({
            formula: "1d8",
            kind: "healing",
            critical: true,
            enhanced: false,
          }),
        },
      },
    },
  });
  vi.stubGlobal(
    "Roll",
    class {
      total = 4;
      async evaluate() {}
      async toMessage() {}
    },
  );
  const create = vi.fn(
    async (data: {
      flags?: { "pivot-fantasy"?: { survivalRoll?: { amount?: number; critical?: boolean } } };
    }) => data,
  );
  vi.stubGlobal("ChatMessage", { create, applyRollMode: vi.fn() });
  await damageRollDialog({ name: "Hero", uuid: "Actor.hero" });
  expect(create.mock.calls[0]?.[0]?.flags?.["pivot-fantasy"]?.survivalRoll).toEqual(
    expect.objectContaining({ amount: 4, kind: "healing", critical: false }),
  );
});

it("reports an incomplete exploding roll without an applicable payload", async () => {
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => ({
            formula: "1d8",
            kind: "damage",
            critical: false,
            enhanced: false,
          }),
        },
      },
    },
  });
  vi.stubGlobal(
    "Roll",
    class {
      total: number | undefined = 4;
      async evaluate() {
        this.total = undefined;
      }
    },
  );
  const create = vi.fn(
    async (data: { content?: string; flags?: { "pivot-fantasy"?: { survivalRoll?: unknown } } }) =>
      data,
  );
  vi.stubGlobal("ChatMessage", { create, applyRollMode: vi.fn() });
  await damageRollDialog({ name: "Hero", uuid: "Actor.hero" });
  expect(create.mock.calls[0]?.[0]?.flags?.["pivot-fantasy"]?.survivalRoll).toBeNull();
  expect(create.mock.calls[0]?.[0]?.content).toContain("Incomplete");
});

it("warns when an ordinary fallback roll cannot be constructed", async () => {
  const prompt = vi
    .fn()
    .mockResolvedValueOnce({
      formula: "1d6*2",
      kind: "damage",
      critical: false,
      enhanced: false,
    })
    .mockResolvedValueOnce(true);
  vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });
  vi.stubGlobal(
    "Roll",
    class {
      constructor() {
        throw new Error("no dice");
      }
      async evaluate() {}
    },
  );
  const warn = vi.fn();
  vi.stubGlobal("ui", { notifications: { warn } });
  await damageRollDialog({ name: "Hero" });
  expect(warn).toHaveBeenCalledWith("RollFailed");
});
