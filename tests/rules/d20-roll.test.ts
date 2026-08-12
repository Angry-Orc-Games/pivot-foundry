import { describe, expect, it } from "vitest";

import { applyAttackCrit, resolveDicePool } from "../../src/rules/d20-roll";

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
});
