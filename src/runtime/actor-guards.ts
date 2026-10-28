import { validAmount } from "../rules/survival";
import { warn } from "./ui";

const DELETED_MAX = "-=max";

export function correctCreatedHp(actor: {
  system?: unknown;
  updateSource?: (data: Record<string, unknown>) => unknown;
}): void {
  if (!actor.updateSource) return;
  const patch = createdHpPatch(actor.system);
  if (patch) actor.updateSource(patch);
}

function createdHpPatch(system: unknown): Record<string, unknown> | undefined {
  const attributes = asRecord(asRecord(system)?.attributes);
  const hp = asRecord(attributes?.hp);
  if (!hp) return undefined;
  const value = validAmount(hp.value) ? hp.value : 0;
  const max = validAmount(hp.max) && hp.max > 0 ? hp.max : value;
  const clamped = Math.min(value, max);
  const patch: Record<string, unknown> = {};
  if (hp.value !== clamped) patch["system.attributes.hp.value"] = clamped;
  if (hp.max !== max) patch["system.attributes.hp.max"] = max;
  return Object.keys(patch).length > 0 ? patch : undefined;
}

export function guardHpMaximum(
  actor: { system?: unknown; sheet?: { render?: (force?: boolean) => void } },
  changes: Record<string, unknown>,
): undefined {
  const max = submittedMax(changes);
  if (max.present && !validAmount(max.value)) {
    stripSubmittedMax(changes);
    warn("InvalidMaximum");
    if (updateIsEmpty(changes, true)) actor.sheet?.render?.(false);
  }
  const submitted = submittedHp(changes);
  const ceiling = numericMax(changes) ?? storedMax(actor);
  if (!validAmount(ceiling)) return;
  const hp = submitted.present && validAmount(submitted.value) ? submitted.value : storedHp(actor);
  const touchesHp =
    (max.present && validAmount(max.value)) || (submitted.present && validAmount(submitted.value));
  if (touchesHp && hp > ceiling) setSubmittedHp(changes, ceiling);
}

function updateIsEmpty(value: unknown, ignoreId = false): boolean {
  if (Array.isArray(value)) return false;
  const record = asRecord(value);
  if (!record) return false;
  return Object.entries(record).every(
    ([key, child]) => (ignoreId && key === "_id") || updateIsEmpty(child),
  );
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

function storedHp(actor: { system?: unknown }): number {
  const hp = storedHpRecord(actor);
  return hp && validAmount(hp.value) ? hp.value : 0;
}

function storedMax(actor: { system?: unknown }): number | undefined {
  const hp = storedHpRecord(actor);
  return hp && validAmount(hp.max) ? hp.max : undefined;
}

function storedHpRecord(actor: { system?: unknown }): Record<string, unknown> | undefined {
  const system = asRecord(actor.system);
  const attributes = asRecord(system?.attributes);
  return asRecord(attributes?.hp);
}

function numericMax(changes: Record<string, unknown>): number | undefined {
  const max = submittedMax(changes);
  return max.present && validAmount(max.value) ? max.value : undefined;
}

function submittedHp(changes: Record<string, unknown>): { present: boolean; value: unknown } {
  if (Object.hasOwn(changes, "system.attributes.hp.value")) {
    return { present: true, value: changes["system.attributes.hp.value"] };
  }
  const grouped = asRecord(changes["system.attributes.hp"]);
  if (grouped && Object.hasOwn(grouped, "value")) return { present: true, value: grouped.value };
  const hp = nestedHp(changes);
  if (hp && Object.hasOwn(hp, "value")) return { present: true, value: hp.value };
  return { present: false, value: undefined };
}

function setSubmittedHp(changes: Record<string, unknown>, value: number): void {
  if (Object.hasOwn(changes, "system.attributes.hp.value")) {
    changes["system.attributes.hp.value"] = value;
    return;
  }
  const grouped = asRecord(changes["system.attributes.hp"]);
  if (grouped) {
    grouped.value = value;
    return;
  }
  const hp = nestedHp(changes);
  if (hp) {
    hp.value = value;
    return;
  }
  changes["system.attributes.hp.value"] = value;
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
