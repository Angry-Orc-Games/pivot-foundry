import { validAmount } from "../rules/survival";
import { warn } from "./ui";
export function guardHpMaximum(
  actor: { system?: unknown },
  changes: Record<string, unknown>,
): false | undefined {
  const system = actor.system as
    { attributes?: { hp?: { value?: number; max?: number } } } | undefined;
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
  if (max === undefined) return;
  const hp = changes["system.attributes.hp.value"] ?? nestedHp?.value ?? currentValue;
  if (!validAmount(max) || !validAmount(hp) || max < hp) {
    warn("InvalidMaximum");
    return false;
  }
}
