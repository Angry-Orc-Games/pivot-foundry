import { validAmount } from "../rules/survival";
import { warn } from "./ui";

export function guardHpMaximum(
  actor: { system?: unknown },
  changes: Record<string, unknown>,
): undefined {
  const max = submittedMax(changes);
  if (!max.present) return;
  const hp = comparedHp(actor, changes);
  if (validAmount(max.value) && max.value >= hp) return;
  stripSubmittedMax(changes);
  warn("InvalidMaximum");
}

function submittedMax(changes: Record<string, unknown>): { present: boolean; value: unknown } {
  if (Object.hasOwn(changes, "system.attributes.hp.max")) {
    return { present: true, value: changes["system.attributes.hp.max"] };
  }
  const hp = nestedHp(changes);
  if (hp && Object.hasOwn(hp, "max")) return { present: true, value: hp.max };
  return { present: false, value: undefined };
}

function comparedHp(actor: { system?: unknown }, changes: Record<string, unknown>): number {
  if (
    Object.hasOwn(changes, "system.attributes.hp.value") &&
    validAmount(changes["system.attributes.hp.value"])
  ) {
    return changes["system.attributes.hp.value"];
  }
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
  const system = asRecord(changes.system);
  const attributes = asRecord(system?.attributes);
  const hp = asRecord(attributes?.hp);
  if (!hp || !Object.hasOwn(hp, "max")) {
    pruneEmpty(changes, system, attributes);
    return;
  }
  delete hp.max;
  if (attributes && Object.keys(hp).length === 0) delete attributes.hp;
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
