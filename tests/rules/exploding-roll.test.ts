import { describe, expect, it } from "vitest";
import { parseExplodingFormula, rollExploding } from "../../src/rules/exploding-roll";

describe("exploding damage and healing", () => {
  it("preserves unsupported formulas for explicit fallback", () => {
    expect(parseExplodingFormula("2d6kh1 + @str")).toBeNull();
    expect(parseExplodingFormula("1d6 * 2")).toBeNull();
  });
  it("rejects nonterminating dice", async () => {
    expect(() => parseExplodingFormula("1d1")).toThrow();
    await expect(rollExploding("1d2", { enhanced: true }, async () => 1)).rejects.toThrow();
  });
  it("recurses and doubles only initial dice on critical", async () => {
    const faces = [6, 6, 2, 3];
    const result = await rollExploding("1d6+4", { critical: true }, async () => faces.shift() ?? 0);
    expect(result).toMatchObject({
      complete: true,
      total: 21,
      chains: [
        { faces: 6, results: [6, 6, 2] },
        { faces: 6, results: [3] },
      ],
    });
  });
  it("explodes ones with enhanced and applies negative modifiers once", async () => {
    const faces = [1, 6, 3];
    expect(
      await rollExploding("d6-20", { enhanced: true }, async () => faces.shift() ?? 0),
    ).toMatchObject({ complete: true, total: 0 });
  });
  it("marks interruption incomplete without an applicable total", async () => {
    let count = 0;
    const result = await rollExploding("d6", {}, async () => {
      if (++count === 3) throw new Error("cancel");
      return 6;
    });
    expect(result.complete).toBe(false);
    expect(result.total).toBeNull();
    expect(result.chains[0]?.results).toEqual([6, 6]);
  });
});
it("rejects unsafe modifier tokens and intermediate sums", () => {
  expect(() => parseExplodingFormula("1d6+9007199254740993-9007199254740992")).toThrow();
  expect(() => parseExplodingFormula("1d6+9007199254740991+1-1")).toThrow();
});
