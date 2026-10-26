import { validAmount } from "../rules/survival";
import type { MigrationPlan } from "./m001";

export const HP_LINK_MIGRATION_ID = "M003";

export function planHpLinkMigration(input: {
  type?: string;
  system: unknown;
  linkPrototype?: boolean;
  hasPrototypeToken?: boolean;
  actorLink?: unknown;
}): MigrationPlan {
  const update: Record<string, unknown> = {};
  const max = repairedHpMax(input.system);
  if (max !== undefined) update["system.attributes.hp.max"] = max;
  if (
    input.linkPrototype === true &&
    input.type === "character" &&
    input.hasPrototypeToken === true &&
    input.actorLink !== true
  ) {
    update["prototypeToken.actorLink"] = true;
  }
  if (Object.keys(update).length === 0) return { ok: true, changed: false };
  return { ok: true, changed: true, update };
}

export function planTokenDeltaHp(input: {
  deltaSystem: unknown;
  baseSystem: unknown;
}): MigrationPlan {
  const max = tokenDeltaMax(input.deltaSystem, input.baseSystem);
  if (max === undefined) return { ok: true, changed: false };
  return { ok: true, changed: true, update: { "system.attributes.hp.max": max } };
}

function repairedHpMax(system: unknown): number | undefined {
  const hp = storedHp(system);
  if (!hp || !Object.hasOwn(hp, "max")) return undefined;
  if (!validAmount(hp.value)) return undefined;
  if (validAmount(hp.max) && hp.max >= hp.value) return undefined;
  return hp.value;
}

function repairedBaseMax(system: unknown): number | undefined {
  const hp = storedHp(system);
  if (!hp || !validAmount(hp.value) || !Object.hasOwn(hp, "max")) return undefined;
  if (validAmount(hp.max) && hp.max >= hp.value) return hp.max;
  return hp.value;
}

function tokenDeltaMax(deltaSystem: unknown, baseSystem: unknown): number | undefined {
  const deltaHp = storedHp(deltaSystem);
  if (!deltaHp) return undefined;
  const hasValue = Object.hasOwn(deltaHp, "value");
  if (hasValue && !validAmount(deltaHp.value)) return undefined;
  const ownValue = hasValue && validAmount(deltaHp.value) ? deltaHp.value : undefined;
  const baseHp = storedHp(baseSystem);
  const baseValue = baseHp && validAmount(baseHp.value) ? baseHp.value : undefined;
  if (Object.hasOwn(deltaHp, "max")) {
    const compared = ownValue ?? baseValue;
    if (compared === undefined) return undefined;
    if (validAmount(deltaHp.max) && deltaHp.max >= compared) return undefined;
    return compared;
  }
  const baseMax = repairedBaseMax(baseSystem);
  if (ownValue !== undefined && baseMax !== undefined && ownValue > baseMax) return ownValue;
  return undefined;
}

function storedHp(system: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(system)) return undefined;
  const attributes = system.attributes;
  if (!isPlainObject(attributes)) return undefined;
  const hp = attributes.hp;
  return isPlainObject(hp) ? hp : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
