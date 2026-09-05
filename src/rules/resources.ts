function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (got ${value})`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be an integer >= 1 (got ${value})`);
  }
}

export function spendBoundedResource(current: number, amount: number): number {
  assertNonNegativeInteger(current, "current");
  assertNonNegativeInteger(amount, "amount");
  return Math.max(0, current - amount);
}

export function recoverBoundedResource(current: number, max: number, amount: number): number {
  assertNonNegativeInteger(current, "current");
  assertPositiveInteger(max, "max");
  assertNonNegativeInteger(amount, "amount");
  return Math.min(max, current + amount);
}

/** Long-rest Pool recovery amount: half of Pool max, rounded down, minimum 1. */
export function poolRecoveryForLongRest(poolMax: number): number {
  assertPositiveInteger(poolMax, "poolMax");
  return Math.max(1, Math.floor(poolMax / 2));
}

export function recoverPoolOnLongRest(current: number, poolMax: number): number {
  return recoverBoundedResource(current, poolMax, poolRecoveryForLongRest(poolMax));
}
