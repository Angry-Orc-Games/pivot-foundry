import { validAmount } from "../rules/survival";
import { warn } from "./ui";

const DELETED_MAX = "-=max";

export function guardHpMaximum(
  actor: { system?: unknown; sheet?: { render?: (force?: boolean) => void } },
  changes: Record<string, unknown>,
): undefined {
  const max = submittedMax(changes);
  if (!max.present) return;
  const hp = comparedHp(actor, changes);
  if (validAmount(max.value) && max.value >= hp) return;
  stripSubmittedMax(changes);
  warn("InvalidMaximum");
  if (Object.keys(changes).length === 0) actor.sheet?.render?.(false);
}

function submittedMax(changes: Record<string, unknown>): { present: boolean; value: unknown } {
  if (Object.hasOwn(changes, "system.attributes.hp.max")) {
    return { present: true, value: changes["system.attributes.hp.max"] };
  }
  const grouped = maxOnHp(asRecord(changes["system.attributes.hp"]));
  if (grouped) return grouped;
  return maxOnHp(nestedHp(changes)) ?? { present: false, value: undefined };
}

function maxOnHp(
  hp: Record<string, unknown> | undefined,
): { present: boolean; value: unknown } | undefined {
  if (!hp) return undefined;
  if (Object.hasOwn(hp, "max")) return { present: true, value: hp.max };
  if (Object.hasOwn(hp, DELETED_MAX)) return { present: true, value: undefined };
  return undefined;
}

function comparedHp(actor: { system?: unknown }, changes: Record<string, unknown>): number {
  if (
    Object.hasOwn(changes, "system.attributes.hp.value") &&
    validAmount(changes["system.attributes.hp.value"])
  ) {
    return changes["system.attributes.hp.value"];
  }
  const grouped = asRecord(changes["system.attributes.hp"]);
  if (grouped && validAmount(grouped.value)) return grouped.value;
  const hp = nestedHp(changes);
  if (hp && Object.hasOwn(hp, "value") && validAmount(hp.value)) return hp.value;
  return storedHp(actor);
}

function storedHp(actor: { system?: unknown }): number {
  const system = asRecord(actor.system);
  const attributes = asRecord(system?.attributes);
  const hp = asRecord(attributes?.hp);
  return hp && validAmount(hp.value) ? hp.value : 0;
}

function nestedHp(changes: Record<string, unknown>): Record<string, unknown> | undefined {
  const system = asRecord(changes.system);
  const attributes = asRecord(system?.attributes);
  return asRecord(attributes?.hp);
}

function stripSubmittedMax(changes: Record<string, unknown>): void {
  if (Object.hasOwn(changes, "system.attributes.hp.max")) {
    delete changes["system.attributes.hp.max"];
  }
  const grouped = asRecord(changes["system.attributes.hp"]);
  if (grouped) {
    delete grouped.max;
    Reflect.deleteProperty(grouped, DELETED_MAX);
    if (Object.keys(grouped).length === 0) delete changes["system.attributes.hp"];
  }
  const system = asRecord(changes.system);
  const attributes = asRecord(system?.attributes);
  const hp = asRecord(attributes?.hp);
  if (hp) {
    delete hp.max;
    Reflect.deleteProperty(hp, DELETED_MAX);
    if (attributes && Object.keys(hp).length === 0) delete attributes.hp;
  }
  pruneEmpty(changes, system, attributes);
}

function pruneEmpty(
  changes: Record<string, unknown>,
  system: Record<string, unknown> | undefined,
  attributes: Record<string, unknown> | undefined,
): void {
  if (attributes && Object.keys(attributes).length === 0 && system) delete system.attributes;
  if (system && Object.keys(system).length === 0) delete changes.system;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
