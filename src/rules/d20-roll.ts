export interface DicePoolResolution {
  dieCount: number;
  pick: "highest" | "lowest" | "single";
}

/**
 * Resolves d20 count and kept result for Advantage, Disadvantage, and
 * Super-Advantage sources, rulebook line 236-263.
 */
export function resolveDicePool(
  advantageSources: number,
  disadvantageSources: number,
): DicePoolResolution {
  if (!Number.isInteger(advantageSources) || advantageSources < 0) {
    throw new RangeError(
      `resolveDicePool: advantageSources must be a non-negative integer (got ${advantageSources})`,
    );
  }

  if (!Number.isInteger(disadvantageSources) || disadvantageSources < 0) {
    throw new RangeError(
      `resolveDicePool: disadvantageSources must be a non-negative integer (got ${disadvantageSources})`,
    );
  }

  if (advantageSources === 0 && disadvantageSources === 0) {
    return { dieCount: 1, pick: "single" };
  }

  if (advantageSources > 1 && disadvantageSources > 0) {
    if (disadvantageSources > advantageSources) {
      return { dieCount: 2, pick: "lowest" };
    }

    return { dieCount: 2, pick: "highest" };
  }

  if (advantageSources > 0 && disadvantageSources > 0) {
    return { dieCount: 1, pick: "single" };
  }

  if (advantageSources > 1) {
    return { dieCount: advantageSources, pick: "highest" };
  }

  if (advantageSources === 1) {
    return { dieCount: 2, pick: "highest" };
  }

  return { dieCount: 2, pick: "lowest" };
}

/** Natural 20/1 rule for attack rolls only, rulebook line 242-246. */
export function applyAttackCrit(naturalD20Result: number): "hit" | "miss" | null {
  if (!Number.isInteger(naturalD20Result) || naturalD20Result < 1 || naturalD20Result > 20) {
    throw new RangeError(
      `applyAttackCrit: naturalD20Result must be an integer between 1 and 20 (got ${naturalD20Result})`,
    );
  }

  if (naturalD20Result === 20) return "hit";
  if (naturalD20Result === 1) return "miss";
  return null;
}
