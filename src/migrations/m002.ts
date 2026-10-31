import {
  effectiveSurvival,
  SURVIVAL_STATUSES,
  validAmount,
  type SurvivalState,
  type SurvivalStatus,
} from "../rules/survival";
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
  const attributes = system.attributes as
    | {
        hp?: { value?: unknown; max?: unknown; temp?: unknown };
        deathSaves?: { status?: unknown; successes?: unknown; failures?: unknown };
      }
    | undefined;
  const hp = attributes?.hp;
  const status = attributes?.deathSaves?.status;
  if (hp?.temp !== undefined && !validAmount(hp.temp))
    return { ok: false, error: "M002: invalid temporary HP" };
  if (
    status !== undefined &&
    !SURVIVAL_STATUSES.includes(status as (typeof SURVIVAL_STATUSES)[number])
  )
    return { ok: false, error: "M002: invalid survival status" };
  const update: Record<string, unknown> = {};
  if (version !== SURVIVAL_VERSION) {
    update["system.survivalVersion"] = SURVIVAL_VERSION;
    if (hp?.temp === undefined) update["system.attributes.hp.temp"] = 0;
    if (status === undefined || status === "unconfirmed")
      update["system.attributes.deathSaves.status"] =
        typeof hp?.value === "number" && hp.value > 0 ? "alive" : "unconfirmed";
  }
  const stored = readStoredSurvival(system);
  const reconciled = effectiveSurvival(stored);
  if (
    reconciled.status !== stored.status ||
    reconciled.successes !== stored.successes ||
    reconciled.failures !== stored.failures
  ) {
    update["system.attributes.deathSaves.status"] = reconciled.status;
    update["system.attributes.deathSaves.successes"] = reconciled.successes;
    update["system.attributes.deathSaves.failures"] = reconciled.failures;
  }
  if (Object.keys(update).length === 0) return { ok: true, changed: false };
  return { ok: true, changed: true, update };
}

function readStoredSurvival(system: Record<string, unknown>): SurvivalState {
  const attributes = system.attributes as
    | {
        hp?: { value?: unknown; max?: unknown; temp?: unknown };
        deathSaves?: { status?: unknown; successes?: unknown; failures?: unknown };
      }
    | undefined;
  const hp = attributes?.hp;
  const saves = attributes?.deathSaves;
  const status = saves?.status;
  return {
    hp: typeof hp?.value === "number" ? hp.value : 0,
    max: typeof hp?.max === "number" ? hp.max : 0,
    temp: typeof hp?.temp === "number" ? hp.temp : 0,
    successes: typeof saves?.successes === "number" ? saves.successes : 0,
    failures: typeof saves?.failures === "number" ? saves.failures : 0,
    status: SURVIVAL_STATUSES.includes(status as SurvivalStatus)
      ? (status as SurvivalStatus)
      : "unconfirmed",
  };
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
