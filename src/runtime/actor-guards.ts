import { survivalStatusForHpEdit, validAmount } from "../rules/survival";
import { warn } from "./ui";

function submittedStatus(changes: Record<string, unknown>): string | undefined {
  const dotted = changes["system.attributes.deathSaves.status"];
  if (typeof dotted === "string") return dotted;
  const nested = changes.system as
    { attributes?: { deathSaves?: { status?: unknown } } } | undefined;
  const status = nested?.attributes?.deathSaves?.status;
  return typeof status === "string" ? status : undefined;
}

function persistedHp(
  changes: Record<string, unknown>,
  nestedHp: { value?: unknown } | undefined,
): number | undefined {
  if (typeof changes["system.attributes.hp.value"] === "number") {
    return changes["system.attributes.hp.value"];
  }
  if (typeof nestedHp?.value === "number") return nestedHp.value;
  return undefined;
}

function writeHpEditStatus(changes: Record<string, unknown>, status: "alive" | "dying"): void {
  const fields = {
    "system.attributes.deathSaves.status": status,
    "system.attributes.deathSaves.successes": 0,
    "system.attributes.deathSaves.failures": 0,
  };
  const nested = changes.system;
  if (nested && typeof nested === "object") {
    const system = nested as { attributes?: Record<string, unknown> };
    const attributes = (system.attributes ??= {});
    const deathSaves = (attributes.deathSaves ??= {}) as Record<string, unknown>;
    deathSaves.status = status;
    deathSaves.successes = 0;
    deathSaves.failures = 0;
  }
  if (typeof changes["system.attributes.hp.value"] === "number" || !nested) {
    Object.assign(changes, fields);
  }
}

export function guardHpMaximum(
  actor: { system?: unknown },
  changes: Record<string, unknown>,
): false | undefined {
  const system = actor.system as
    | {
        attributes?: {
          hp?: { value?: number; max?: number };
          deathSaves?: { status?: string };
        };
      }
    | undefined;
  const nested = changes.system as
    { attributes?: { hp?: { value?: unknown; max?: unknown } } } | undefined;
  const currentValue = system?.attributes?.hp?.value ?? 0;
  const currentMax = system?.attributes?.hp?.max ?? 0;
  const nestedHp = nested?.attributes?.hp;
  const rawValue = changes["system.attributes.hp.value"] ?? nestedHp?.value;
  const rawMax = changes["system.attributes.hp.max"] ?? nestedHp?.max;
  const nextMax = rawMax === undefined ? currentMax : rawMax;
  if (
    rawValue !== undefined &&
    validAmount(nextMax) &&
    validAmount(rawValue) &&
    rawValue > nextMax
  ) {
    if (typeof changes["system.attributes.hp.value"] === "number") {
      changes["system.attributes.hp.value"] = nextMax;
    }
    if (nestedHp && typeof nestedHp.value === "number") nestedHp.value = nextMax;
  }

  const max = changes["system.attributes.hp.max"] ?? nestedHp?.max;
  if (max !== undefined) {
    const hp = changes["system.attributes.hp.value"] ?? nestedHp?.value ?? currentValue;
    if (!validAmount(max) || !validAmount(hp) || max < hp) {
      warn("InvalidMaximum");
      return false;
    }
  }

  const nextHp = persistedHp(changes, nestedHp);
  if (nextHp === undefined || !validAmount(nextHp) || !validAmount(nextMax)) return;
  const nextStatus = survivalStatusForHpEdit(
    submittedStatus(changes) ?? system?.attributes?.deathSaves?.status,
    nextHp,
    nextMax,
  );
  if (nextStatus) writeHpEditStatus(changes, nextStatus);
}
