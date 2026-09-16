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
