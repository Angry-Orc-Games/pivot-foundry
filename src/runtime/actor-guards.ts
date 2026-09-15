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
  const max = changes["system.attributes.hp.max"] ?? nested?.attributes?.hp?.max;
  if (max === undefined) return;
  const hp =
    changes["system.attributes.hp.value"] ??
    nested?.attributes?.hp?.value ??
    system?.attributes?.hp?.value ??
    0;
  if (!validAmount(max) || !validAmount(hp) || max < hp) {
    warn("InvalidMaximum");
    return false;
  }
}
