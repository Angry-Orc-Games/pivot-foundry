import { describe, expect, it } from "vitest";

import {
  applyLongRestHpRecovery,
  applyLongRestMpRecovery,
  applyLongRestPoolRecovery,
  applyShortRestMpRecovery,
  applyShortRestPoolSpend,
  calculateMagicAbilityModifier,
  parsePoolSpends,
} from "../../src/rules/rest";

describe("applyShortRestPoolSpend", () => {
  it("spends 1 Pool from current", () => {
    const result = applyShortRestPoolSpend({
      die: "d8",
      poolCurrent: 5,
      conMod: 2,
    });
    expect(result.poolRemaining).toBe(4);
    expect(result.hpHealed).toBe(0);
  });

  it("throws if Pool current is 0", () => {
    expect(() =>
      applyShortRestPoolSpend({
        die: "d8",
        poolCurrent: 0,
        conMod: 0,
      }),
    ).toThrow(RangeError);
  });

  it("throws if die format is invalid", () => {
    expect(() =>
      applyShortRestPoolSpend({
        die: "8",
        poolCurrent: 3,
        conMod: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("applyShortRestMpRecovery", () => {
  it("recovers magic ability mod MP when awakened and not in danger", () => {
    const result = applyShortRestMpRecovery({
      awakened: true,
      magicAbilityMod: 3,
      mpCurrent: 2,
      mpMax: 10,
      inDanger: false,
    });
    expect(result.mpRecovered).toBe(3);
    expect(result.mpFinal).toBe(5);
  });

  it("recovers 0 MP when not awakened", () => {
    const result = applyShortRestMpRecovery({
      awakened: false,
      magicAbilityMod: 3,
      mpCurrent: 2,
      mpMax: 10,
      inDanger: false,
    });
    expect(result.mpRecovered).toBe(0);
    expect(result.mpFinal).toBe(2);
  });

  it("recovers 0 MP when in danger", () => {
    const result = applyShortRestMpRecovery({
      awakened: true,
      magicAbilityMod: 3,
      mpCurrent: 2,
      mpMax: 10,
      inDanger: true,
    });
    expect(result.mpRecovered).toBe(0);
    expect(result.mpFinal).toBe(2);
  });

  it("caps MP at max", () => {
    const result = applyShortRestMpRecovery({
      awakened: true,
      magicAbilityMod: 5,
      mpCurrent: 8,
      mpMax: 10,
      inDanger: false,
    });
    expect(result.mpRecovered).toBe(2);
    expect(result.mpFinal).toBe(10);
  });

  it("treats negative magic ability mod as 0", () => {
    const result = applyShortRestMpRecovery({
      awakened: true,
      magicAbilityMod: -2,
      mpCurrent: 5,
      mpMax: 10,
      inDanger: false,
    });
    expect(result.mpRecovered).toBe(0);
    expect(result.mpFinal).toBe(5);
  });
});

describe("applyLongRestHpRecovery", () => {
  it("recovers all HP", () => {
    const result = applyLongRestHpRecovery({
      hpCurrent: 5,
      hpMax: 20,
    });
    expect(result.hpRecovered).toBe(15);
    expect(result.hpFinal).toBe(20);
  });

  it("returns 0 recovery when already at max", () => {
    const result = applyLongRestHpRecovery({
      hpCurrent: 10,
      hpMax: 10,
    });
    expect(result.hpRecovered).toBe(0);
    expect(result.hpFinal).toBe(10);
  });
});

describe("applyLongRestPoolRecovery", () => {
  it.each([
    [0, 4, 2, 2],
    [1, 5, 2, 3],
    [4, 5, 1, 5],
    [5, 5, 0, 5],
    [0, 1, 1, 1],
    [0, 2, 1, 1],
    [0, 3, 1, 1],
  ])(
    "Pool current %i max %i recovers %i to final %i",
    (poolCurrent, poolMax, expectedRecovered, expectedFinal) => {
      const result = applyLongRestPoolRecovery({ poolCurrent, poolMax });
      expect(result.poolRecovered).toBe(expectedRecovered);
      expect(result.poolFinal).toBe(expectedFinal);
    },
  );
});

describe("applyLongRestMpRecovery", () => {
  it("recovers all MP when awakened and safe/comfortable", () => {
    const result = applyLongRestMpRecovery({
      awakened: true,
      mpCurrent: 3,
      mpMax: 10,
      safeAndComfortable: true,
      controlMagicRoll: null,
    });
    expect(result.mpRecovered).toBe(7);
    expect(result.mpFinal).toBe(10);
    expect(result.recoveredFull).toBe(true);
  });

  it("recovers half MP when not safe and Control Magic fails", () => {
    const result = applyLongRestMpRecovery({
      awakened: true,
      mpCurrent: 0,
      mpMax: 10,
      safeAndComfortable: false,
      controlMagicRoll: 14,
    });
    expect(result.mpRecovered).toBe(5);
    expect(result.mpFinal).toBe(5);
    expect(result.recoveredFull).toBe(false);
  });

  it("recovers all MP when not safe but Control Magic succeeds", () => {
    const result = applyLongRestMpRecovery({
      awakened: true,
      mpCurrent: 2,
      mpMax: 10,
      safeAndComfortable: false,
      controlMagicRoll: 15,
    });
    expect(result.mpRecovered).toBe(8);
    expect(result.mpFinal).toBe(10);
    expect(result.recoveredFull).toBe(true);
  });

  it("recovers half MP when not safe and no Control Magic roll", () => {
    const result = applyLongRestMpRecovery({
      awakened: true,
      mpCurrent: 0,
      mpMax: 10,
      safeAndComfortable: false,
      controlMagicRoll: null,
    });
    expect(result.mpRecovered).toBe(5);
    expect(result.mpFinal).toBe(5);
    expect(result.recoveredFull).toBe(false);
  });

  it("recovers 0 MP when not awakened", () => {
    const result = applyLongRestMpRecovery({
      awakened: false,
      mpCurrent: 5,
      mpMax: 10,
      safeAndComfortable: true,
      controlMagicRoll: null,
    });
    expect(result.mpRecovered).toBe(0);
    expect(result.mpFinal).toBe(5);
    expect(result.recoveredFull).toBe(false);
  });

  it("handles odd MP max correctly for half recovery", () => {
    const result = applyLongRestMpRecovery({
      awakened: true,
      mpCurrent: 0,
      mpMax: 9,
      safeAndComfortable: false,
      controlMagicRoll: 10,
    });
    expect(result.mpRecovered).toBe(4);
    expect(result.mpFinal).toBe(4);
    expect(result.recoveredFull).toBe(false);
  });
});

describe("calculateMagicAbilityModifier", () => {
  it("returns ability modifier when awakened", () => {
    expect(calculateMagicAbilityModifier(true, 16)).toBe(3);
    expect(calculateMagicAbilityModifier(true, 10)).toBe(0);
    expect(calculateMagicAbilityModifier(true, 8)).toBe(-1);
  });

  it("returns 0 when not awakened", () => {
    expect(calculateMagicAbilityModifier(false, 16)).toBe(0);
  });

  it("returns 0 when magic ability is null", () => {
    expect(calculateMagicAbilityModifier(true, null)).toBe(0);
  });
});

describe("parsePoolSpends", () => {
  it("returns null for empty string", () => {
    expect(parsePoolSpends("", 3)).toBe(null);
  });

  it("returns null for whitespace", () => {
    expect(parsePoolSpends("   ", 3)).toBe(null);
  });

  it("returns null for non-integer", () => {
    expect(parsePoolSpends("1.5", 3)).toBe(null);
  });

  it("returns null for zero", () => {
    expect(parsePoolSpends("0", 3)).toBe(null);
  });

  it("returns null for negative", () => {
    expect(parsePoolSpends("-1", 3)).toBe(null);
  });

  it("returns parsed value when valid and below max", () => {
    expect(parsePoolSpends("2", 3)).toBe(2);
  });

  it("caps value at max", () => {
    expect(parsePoolSpends("9", 3)).toBe(3);
  });

  it("returns null for non-finite", () => {
    expect(parsePoolSpends("Infinity", 3)).toBe(null);
    expect(parsePoolSpends("NaN", 3)).toBe(null);
  });
});
