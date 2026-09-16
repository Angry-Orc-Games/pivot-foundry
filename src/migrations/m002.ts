import { SURVIVAL_STATUSES, validAmount } from "../rules/survival";
import type { MigrationPlan } from "./m001";
export const SURVIVAL_MIGRATION_ID = "M002";
export const SURVIVAL_VERSION = 1;
export function planSurvivalMigration(source: unknown): MigrationPlan {
  if (
    source !== null &&
    source !== undefined &&
    (typeof source !== "object" || Array.isArray(source))
  )
    return { ok: false, error: "M002: system data is not an object" };
  const system = (source ?? {}) as Record<string, unknown>;
  const version = system.survivalVersion ?? 0;
  if (!validAmount(version) || version > SURVIVAL_VERSION)
    return { ok: false, error: "M002: invalid or newer survivalVersion" };
  if (version === SURVIVAL_VERSION) return { ok: true, changed: false };
  const attributes = system.attributes as
    { hp?: { value?: unknown; temp?: unknown }; deathSaves?: { status?: unknown } } | undefined;
  const hp = attributes?.hp;
  const status = attributes?.deathSaves?.status;
  if (hp?.temp !== undefined && !validAmount(hp.temp))
    return { ok: false, error: "M002: invalid temporary HP" };
  if (
    status !== undefined &&
    !SURVIVAL_STATUSES.includes(status as (typeof SURVIVAL_STATUSES)[number])
  )
    return { ok: false, error: "M002: invalid survival status" };
  const update: Record<string, unknown> = { "system.survivalVersion": SURVIVAL_VERSION };
  if (hp?.temp === undefined) update["system.attributes.hp.temp"] = 0;
  if (status === undefined || status === "unconfirmed")
    update["system.attributes.deathSaves.status"] =
      typeof hp?.value === "number" && hp.value > 0 ? "alive" : "unconfirmed";
  return { ok: true, changed: true, update };
}

/** Defaults stay legacy-safe; initialize only genuinely new Character documents. */
export function initializeSurvival(actor: {
  type?: string;
  system?: unknown;
  updateSource?: (data: Record<string, unknown>) => unknown;
}): void {
  if (actor.type !== "character" || !actor.updateSource) return;
  const system = actor.system as
    | {
        survivalVersion?: number;
        attributes?: { hp?: { value?: number }; deathSaves?: { status?: string } };
      }
    | undefined;
  if (system?.survivalVersion === SURVIVAL_VERSION) return;
  actor.updateSource({
    "system.survivalVersion": SURVIVAL_VERSION,
    "system.attributes.deathSaves.status":
      (system?.attributes?.hp?.value ?? 0) > 0 ? "alive" : "dying",
  });
}
