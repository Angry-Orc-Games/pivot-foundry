import { describe, expect, it } from "vitest";

import {
  poolRecoveryForLongRest,
  recoverBoundedResource,
  recoverPoolOnLongRest,
  spendBoundedResource,
} from "../../src/rules/resources";

describe("spendBoundedResource", () => {
  it("spends 5 by 2 to 3", () => {
    expect(spendBoundedResource(5, 2)).toBe(3);
  });

  it("clamps overspend to 0", () => {
    expect(spendBoundedResource(2, 5)).toBe(0);
  });

  it("treats spend amount 0 as a no-op", () => {
    expect(spendBoundedResource(4, 0)).toBe(4);
  });
});

describe("recoverBoundedResource", () => {
  it("caps recovery at max", () => {
    expect(recoverBoundedResource(4, 5, 3)).toBe(5);
  });
});

describe("poolRecoveryForLongRest", () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
  ])("max %i recovers %i", (poolMax, expected) => {
    expect(poolRecoveryForLongRest(poolMax)).toBe(expected);
  });
});

describe("recoverPoolOnLongRest", () => {
  it("caps current near max correctly", () => {
    expect(recoverPoolOnLongRest(4, 5)).toBe(5);
    expect(recoverPoolOnLongRest(5, 5)).toBe(5);
    expect(recoverPoolOnLongRest(0, 4)).toBe(2);
  });
});

describe("resource input validation", () => {
  it("throws for negative, non-integer, and non-finite inputs", () => {
    expect(() => spendBoundedResource(-1, 1)).toThrow(RangeError);
    expect(() => spendBoundedResource(1, 1.5)).toThrow(RangeError);
    expect(() => recoverBoundedResource(1, 0, 1)).toThrow(RangeError);
    expect(() => recoverBoundedResource(Number.NaN, 5, 1)).toThrow(RangeError);
    expect(() => poolRecoveryForLongRest(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
