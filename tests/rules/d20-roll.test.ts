import { describe, expect, it } from "vitest";

import {
  applyAttackCrit,
  d20PoolFormula,
  dicePoolForRollMode,
  resolveDicePool,
  selectKeptD20,
} from "../../src/rules/d20-roll";

describe("resolveDicePool", () => {
  // Rulebook line 236-263.
  it("no advantage or disadvantage: single die", () => {
    expect(resolveDicePool(0, 0)).toEqual({ dieCount: 1, pick: "single" });
  });

  it("one source of advantage: 2 dice, pick highest", () => {
    expect(resolveDicePool(1, 0)).toEqual({ dieCount: 2, pick: "highest" });
  });

  it("one source of disadvantage: 2 dice, pick lowest", () => {
    expect(resolveDicePool(0, 1)).toEqual({ dieCount: 2, pick: "lowest" });
  });

  it("advantage and disadvantage cancel out entirely: single die", () => {
    // Line 256: neither Advantage nor Disadvantage applies.
    expect(resolveDicePool(1, 1)).toEqual({ dieCount: 1, pick: "single" });
  });

  it("Super-Advantage: N sources of advantage roll N dice, pick highest", () => {
    // Line 258-260: Super-Advantage is passed as advantageSources > 1 with no disadvantage.
    expect(resolveDicePool(3, 0)).toEqual({ dieCount: 3, pick: "highest" });
  });

  it("Super-Advantage reduced to normal Advantage by any Disadvantage", () => {
    // Line 262: any Disadvantage present reduces Super-Advantage to normal 2-die Advantage.
    expect(resolveDicePool(3, 1)).toEqual({ dieCount: 2, pick: "highest" });
    expect(resolveDicePool(2, 2)).toEqual({ dieCount: 2, pick: "highest" });
  });

  it("Super-Advantage overwhelmed by multiple Disadvantage becomes normal Disadvantage", () => {
    // Line 262: only if multiple Disadvantages outweigh all sources of Advantage does it flip to Disadvantage.
    expect(resolveDicePool(2, 3)).toEqual({ dieCount: 2, pick: "lowest" });
  });
});

describe("applyAttackCrit", () => {
  // Line 242-246: attack rolls only.
  it("natural 20 always hits", () => {
    expect(applyAttackCrit(20)).toBe("hit");
  });

  it("natural 1 always misses", () => {
    expect(applyAttackCrit(1)).toBe("miss");
  });

  it("anything else is not a crit/fumble", () => {
    expect(applyAttackCrit(15)).toBe(null);
  });

  it("classifies attack crits from the kept natural face", () => {
    expect(applyAttackCrit(20)).toBe("hit");
    expect(applyAttackCrit(1)).toBe("miss");
  });
});

describe("dicePoolForRollMode", () => {
  it("maps each RollMode to the expected pool resolution", () => {
    expect(dicePoolForRollMode("normal")).toEqual({ dieCount: 1, pick: "single" });
    expect(dicePoolForRollMode("advantage")).toEqual({ dieCount: 2, pick: "highest" });
    expect(dicePoolForRollMode("disadvantage")).toEqual({ dieCount: 2, pick: "lowest" });
    expect(dicePoolForRollMode("superAdvantage")).toEqual({ dieCount: 2, pick: "highest" });
  });
});

describe("selectKeptD20", () => {
  it("keeps the only die for a single-die pool", () => {
    expect(selectKeptD20([11], { dieCount: 1, pick: "single" })).toBe(11);
  });

  it("selects highest for advantage", () => {
    expect(selectKeptD20([3, 18], { dieCount: 2, pick: "highest" })).toBe(18);
  });

  it("selects lowest for disadvantage", () => {
    expect(selectKeptD20([3, 18], { dieCount: 2, pick: "lowest" })).toBe(3);
  });

  it("selects highest for Super-Advantage with two dice", () => {
    expect(selectKeptD20([4, 12], dicePoolForRollMode("superAdvantage"))).toBe(12);
  });

  it("throws for empty arrays, wrong counts, and invalid faces", () => {
    expect(() => selectKeptD20([], { dieCount: 1, pick: "single" })).toThrow(RangeError);
    expect(() => selectKeptD20([10, 11], { dieCount: 1, pick: "single" })).toThrow(RangeError);
    expect(() => selectKeptD20([10], { dieCount: 2, pick: "highest" })).toThrow(RangeError);
    expect(() => selectKeptD20([0, 10], { dieCount: 2, pick: "highest" })).toThrow(RangeError);
    expect(() => selectKeptD20([21], { dieCount: 1, pick: "single" })).toThrow(RangeError);
    expect(() => selectKeptD20([1.5], { dieCount: 1, pick: "single" })).toThrow(RangeError);
  });
});

describe("d20PoolFormula", () => {
  it("builds a Foundry pool formula from the resolved die count", () => {
    expect(d20PoolFormula(1)).toBe("1d20");
    expect(d20PoolFormula(2)).toBe("2d20");
    expect(d20PoolFormula(3)).toBe("3d20");
  });
});
