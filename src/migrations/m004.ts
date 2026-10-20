import { baseSpeedForSpecies } from "../rules/species-speed";
import type { MigrationPlan } from "./m001";

export const SPECIES_SPEED_MIGRATION_ID = "M004";

export function planSpeciesSpeedMigration(storedSystem: unknown): MigrationPlan {
  if (!isPlainObject(storedSystem)) return { ok: true, changed: false };
  const attributes = storedSystem.attributes;
  if (!isPlainObject(attributes) || !isPlainObject(attributes.speed)) {
    return { ok: true, changed: false };
  }
  if (!Object.hasOwn(attributes.speed, "value") || attributes.speed.value !== 10) {
    return { ok: true, changed: false };
  }

  const identity = storedSystem.identity;
  const species =
    isPlainObject(identity) && typeof identity.speciesText === "string"
      ? identity.speciesText.trim()
      : "";
  if (!species) return { ok: true, changed: false };

  const base = baseSpeedForSpecies(species);
  if (base === null) {
    return {
      ok: true,
      changed: false,
      log: `unknown species "${species}"; base speed left at 10.`,
    };
  }
  if (base === 10) return { ok: true, changed: false };
  return {
    ok: true,
    changed: true,
    update: { "system.attributes.speed.value": base },
    log: `base speed 10 -> ${base} (${species}).`,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
