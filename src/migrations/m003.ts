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

function repairedHpMax(system: unknown): number | undefined {
  const hp = storedHp(system);
  if (!hp || !Object.hasOwn(hp, "max")) return undefined;
  const compared = validAmount(hp.value) ? hp.value : 0;
  if (validAmount(hp.max) && hp.max >= compared) return undefined;
  return compared;
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
