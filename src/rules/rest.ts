import { abilityModifier } from "./modifiers";

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (got ${value})`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer (got ${value})`);
  }
}

export interface ShortRestPoolSpend {
  die: string;
  poolCurrent: number;
  conMod: number;
}

export interface ShortRestPoolSpendResult {
  poolRemaining: number;
  hpHealed: number;
}

/**
 * Short Rest: spend 1 Pool, roll exploding HD + Con mod, heal that HP.
 * Pool must be at least 1. Negative con mod can't reduce healing below 0.
 */
export function applyShortRestPoolSpend(input: ShortRestPoolSpend): ShortRestPoolSpendResult {
  assertPositiveInteger(input.poolCurrent, "poolCurrent");
  if (!input.die.match(/^d\d+$/)) {
    throw new RangeError(`die must be in format dN (got ${input.die})`);
  }

  return {
    poolRemaining: input.poolCurrent - 1,
    hpHealed: 0,
  };
}

export interface ShortRestMpRecovery {
  awakened: boolean;
  magicAbilityMod: number;
  mpCurrent: number;
  mpMax: number;
  inDanger: boolean;
}

export interface ShortRestMpRecoveryResult {
  mpRecovered: number;
  mpFinal: number;
}

/**
 * Short Rest MP: awakened characters recover magic ability mod MP (no roll) when not in immediate danger.
 * Non-awakened recover 0. MP capped at max.
 */
export function applyShortRestMpRecovery(input: ShortRestMpRecovery): ShortRestMpRecoveryResult {
  assertNonNegativeInteger(input.mpCurrent, "mpCurrent");
  assertNonNegativeInteger(input.mpMax, "mpMax");

  if (!input.awakened || input.inDanger) {
    return { mpRecovered: 0, mpFinal: input.mpCurrent };
  }

  const recovery = Math.max(0, input.magicAbilityMod);
  const mpFinal = Math.min(input.mpMax, input.mpCurrent + recovery);

  return { mpRecovered: mpFinal - input.mpCurrent, mpFinal };
}

export interface LongRestHpRecovery {
  hpCurrent: number;
  hpMax: number;
}

export interface LongRestHpRecoveryResult {
  hpRecovered: number;
  hpFinal: number;
}

/**
 * Long Rest HP: full HP recovery.
 */
export function applyLongRestHpRecovery(input: LongRestHpRecovery): LongRestHpRecoveryResult {
  assertNonNegativeInteger(input.hpCurrent, "hpCurrent");
  assertNonNegativeInteger(input.hpMax, "hpMax");

  return {
    hpRecovered: input.hpMax - input.hpCurrent,
    hpFinal: input.hpMax,
  };
}

export interface LongRestPoolRecovery {
  poolCurrent: number;
  poolMax: number;
}

export interface LongRestPoolRecoveryResult {
  poolRecovered: number;
  poolFinal: number;
}

/**
 * Long Rest Pool: recover half Pool max (floor, min 1).
 */
export function applyLongRestPoolRecovery(input: LongRestPoolRecovery): LongRestPoolRecoveryResult {
  assertNonNegativeInteger(input.poolCurrent, "poolCurrent");
  assertPositiveInteger(input.poolMax, "poolMax");

  const recovery = Math.max(1, Math.floor(input.poolMax / 2));
  const poolFinal = Math.min(input.poolMax, input.poolCurrent + recovery);

  return { poolRecovered: poolFinal - input.poolCurrent, poolFinal };
}

export interface LongRestMpRecovery {
  awakened: boolean;
  mpCurrent: number;
  mpMax: number;
  safeAndComfortable: boolean;
  controlMagicRoll: number | null;
}

export interface LongRestMpRecoveryResult {
  mpRecovered: number;
  mpFinal: number;
  recoveredFull: boolean;
}

/**
 * Long Rest MP:
 * - All MP if safe/comfortable
 * - Half MP otherwise, unless Control Magic DC 15 succeeds (roll >= 15)
 * - Non-awakened recover 0
 */
export function applyLongRestMpRecovery(input: LongRestMpRecovery): LongRestMpRecoveryResult {
  assertNonNegativeInteger(input.mpCurrent, "mpCurrent");
  assertNonNegativeInteger(input.mpMax, "mpMax");

  if (!input.awakened) {
    return { mpRecovered: 0, mpFinal: input.mpCurrent, recoveredFull: false };
  }

  let recovery: number;
  let recoveredFull: boolean;

  if (input.safeAndComfortable) {
    recovery = input.mpMax - input.mpCurrent;
    recoveredFull = true;
  } else {
    const halfRecovery = Math.floor(input.mpMax / 2);
    const controlMagicSuccess = input.controlMagicRoll !== null && input.controlMagicRoll >= 15;

    if (controlMagicSuccess) {
      recovery = input.mpMax - input.mpCurrent;
      recoveredFull = true;
    } else {
      recovery = halfRecovery;
      recoveredFull = false;
    }
  }

  const mpFinal = Math.min(input.mpMax, input.mpCurrent + recovery);

  return { mpRecovered: mpFinal - input.mpCurrent, mpFinal, recoveredFull };
}

/**
 * Calculate magic ability modifier for awakened characters.
 * Returns 0 if not awakened or ability is null.
 */
export function calculateMagicAbilityModifier(
  awakened: boolean,
  magicAbilityScore: number | null,
): number {
  if (!awakened || magicAbilityScore === null) {
    return 0;
  }
  return abilityModifier(magicAbilityScore);
}

/**
 * Parse and validate Pool spend input from a form field.
 * Returns null for empty, whitespace, non-finite, non-integer, or spend below 1.
 * Caps valid spend at current Pool max.
 */
export function parsePoolSpends(raw: string, max: number): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1) return null;

  return Math.min(parsed, max);
}
