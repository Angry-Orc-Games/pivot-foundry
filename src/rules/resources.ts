import {
  abilityKeys,
  type AbilityKey,
  type AbilitySourceMap,
  calculateCharacterDerived,
} from "./character-derived";
import { aggregateCharacterEffects, collectEmbeddedItemEffects } from "./effects";

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

export function clampMp(value: number, max: number): number {
  const current = Number.isFinite(value) ? value : 0;
  const ceiling = Number.isFinite(max) ? Math.max(0, max) : 0;
  return Math.min(ceiling, Math.max(0, current));
}

const abilityKeySet = new Set<string>(abilityKeys);

export function characterMpMaximum(
  system: unknown,
  items: readonly { system?: unknown }[] = [],
): number {
  const root = isRecord(system) ? system : {};
  const abilities = isRecord(root.abilities) ? root.abilities : {};
  const progression = isRecord(root.progression) ? root.progression : {};
  const magic = isRecord(root.magic) ? root.magic : {};
  const mp = isRecord(magic.mp) ? magic.mp : {};
  const level = Math.max(1, Math.trunc(readNumber(progression.level, 1)));
  const ability =
    typeof magic.ability === "string" && abilityKeySet.has(magic.ability)
      ? (magic.ability as AbilityKey)
      : null;
  const derived = calculateCharacterDerived(
    {
      level,
      abilities: Object.fromEntries(
        abilityKeys.map((key) => {
          const entry = isRecord(abilities[key]) ? abilities[key] : {};
          return [key, { score: abilityScore(entry.score), primary: false }];
        }),
      ) as AbilitySourceMap,
      skills: {},
      magic: {
        awakened: magic.awakened === true,
        ability,
      },
      equipment: [],
      mpBonus: readNumber(mp.maxBonus, 0),
    },
    aggregateCharacterEffects(collectEmbeddedItemEffects(items)),
  );
  return derived.magic.mp.max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function abilityScore(value: unknown): number {
  return Math.min(30, Math.max(1, Math.trunc(readNumber(value, 10))));
}
