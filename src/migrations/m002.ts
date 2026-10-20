import { startingHitPoints } from "../rules/hit-points";
import {
  reconcileSurvival,
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
  const reconciled = reconcileSurvival(stored);
  if (
    reconciled.status !== stored.status ||
    reconciled.successes !== stored.successes ||
    reconciled.failures !== stored.failures
  ) {
    update["system.attributes.deathSaves.status"] = reconciled.status;
    update["system.attributes.deathSaves.successes"] = reconciled.successes;
    update["system.attributes.deathSaves.failures"] = reconciled.failures;
  }
  if (hp?.max === 0) fillUnsetHitPoints(system, hp, update);
  if (Object.keys(update).length === 0) return { ok: true, changed: false };
  return { ok: true, changed: true, update };
}

function fillUnsetHitPoints(
  system: Record<string, unknown>,
  hp: { value?: unknown; max?: unknown },
  update: Record<string, unknown>,
): void {
  const value = typeof hp.value === "number" ? hp.value : 0;
  const total = Math.max(startingHitPoints(readHitDie(system), readConstitution(system)), value);
  update["system.attributes.hp.max"] = total;
  const saves = (
    system.attributes as
      { deathSaves?: { status?: unknown; successes?: unknown; failures?: unknown } } | undefined
  )?.deathSaves;
  const successes = typeof saves?.successes === "number" ? saves.successes : 0;
  const failures = typeof saves?.failures === "number" ? saves.failures : 0;
  const status = update["system.attributes.deathSaves.status"] ?? saves?.status;
  const blank =
    value === 0 &&
    successes === 0 &&
    failures === 0 &&
    (status === undefined || status === "unconfirmed" || status === "dying" || status === "alive");
  if (!blank) return;
  update["system.attributes.hp.value"] = total;
  update["system.attributes.deathSaves.status"] = "alive";
}

function readHitDie(system: Record<string, unknown>): string {
  const hitDie = (system.attributes as { hitDie?: unknown } | undefined)?.hitDie;
  return typeof hitDie === "string" ? hitDie : "d8";
}

function readConstitution(system: Record<string, unknown>): number {
  const score = (system.abilities as { con?: { score?: unknown } } | undefined)?.con?.score;
  return typeof score === "number" ? score : 10;
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

export function initializeSurvival(actor: {
  type?: string;
  system?: unknown;
  updateSource?: (data: Record<string, unknown>) => unknown;
}): void {
  if (actor.type !== "character" || !actor.updateSource) return;
  const system = actor.system as
    | {
        survivalVersion?: number;
        abilities?: { con?: { score?: number } };
        attributes?: {
          hitDie?: string;
          hp?: { value?: number; max?: number };
          deathSaves?: { status?: string };
        };
      }
    | undefined;
  if (system?.survivalVersion === SURVIVAL_VERSION) return;
  const hp = system?.attributes?.hp;
  const value = hp?.value ?? 0;
  const max = hp?.max ?? 0;
  const update: Record<string, unknown> = { "system.survivalVersion": SURVIVAL_VERSION };
  if (value === 0 && max === 0) {
    const total = startingHitPoints(
      system?.attributes?.hitDie ?? "d8",
      system?.abilities?.con?.score ?? 10,
    );
    update["system.attributes.hp.value"] = total;
    update["system.attributes.hp.max"] = total;
    update["system.attributes.deathSaves.status"] = "alive";
  } else {
    update["system.attributes.deathSaves.status"] = value > 0 ? "alive" : "dying";
  }
  actor.updateSource(update);
}
