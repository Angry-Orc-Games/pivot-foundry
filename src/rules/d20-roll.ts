export interface DicePoolResolution {
  dieCount: number;
  pick: "highest" | "lowest" | "single";
}

export const ROLL_MODES = ["normal", "advantage", "disadvantage", "superAdvantage"] as const;

export type RollMode = (typeof ROLL_MODES)[number];

const ROLL_MODE_SOURCES: Record<
  RollMode,
  readonly [advantageSources: number, disadvantageSources: number]
> = {
  normal: [0, 0],
  advantage: [1, 0],
  disadvantage: [0, 1],
  superAdvantage: [2, 0],
};

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

export function isRollMode(value: unknown): value is RollMode {
  return typeof value === "string" && (ROLL_MODES as readonly string[]).includes(value);
}

export function dicePoolForRollMode(mode: RollMode): DicePoolResolution {
  if (!isRollMode(mode)) {
    throw new RangeError(`dicePoolForRollMode: unknown roll mode (${String(mode)})`);
  }

  const [advantageSources, disadvantageSources] = ROLL_MODE_SOURCES[mode];
  return resolveDicePool(advantageSources, disadvantageSources);
}

/**
 * Selects the kept natural d20 after Foundry has produced the raw faces.
 * Rulebook: Core Rules advantage/disadvantage; Combat natural 20/1 uses this kept face.
 */
export function selectKeptD20(
  naturalResults: readonly number[],
  resolution: DicePoolResolution,
): number {
  const expectedCount = resolution.pick === "single" ? 1 : resolution.dieCount;
  if (naturalResults.length !== expectedCount) {
    throw new RangeError(
      `selectKeptD20: expected ${expectedCount} d20 results (got ${naturalResults.length})`,
    );
  }

  for (const result of naturalResults) {
    if (!Number.isInteger(result) || result < 1 || result > 20) {
      throw new RangeError(
        `selectKeptD20: natural results must be integers from 1 to 20 (got ${result})`,
      );
    }
  }

  if (resolution.pick === "highest") return Math.max(...naturalResults);
  if (resolution.pick === "lowest") return Math.min(...naturalResults);
  return naturalResults[0] ?? 0;
}

export function d20PoolFormula(dieCount: number): string {
  if (!Number.isInteger(dieCount) || dieCount < 1) {
    throw new RangeError(`d20PoolFormula: dieCount must be an integer >= 1 (got ${dieCount})`);
  }

  return `${dieCount}d20`;
}
