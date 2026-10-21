import type { MigrationPlan } from "./m001";

export const SCHEMA_V2_MIGRATION_ID = "M003";

/**
 * M003: Schema version 1 → 2
 * - Adds identity.concept, identity.focus, identity.backgroundTier to character actors
 * - Adds cost.bp to feature items
 */

export function planSchemaV2ActorMigration(storedSystem: unknown): MigrationPlan {
  if (!isPlainObject(storedSystem)) {
    return { ok: true, changed: false };
  }

  const version = typeof storedSystem.schemaVersion === "number" ? storedSystem.schemaVersion : 0;

  // Only migrate if we're at version 0 or 1 (legacy versions before these fields existed)
  if (version > 1) {
    return { ok: true, changed: false };
  }

  // Check if identity exists and needs migration
  const identity = storedSystem.identity;
  if (!isPlainObject(identity)) {
    return { ok: true, changed: false };
  }

  const update: Record<string, unknown> = {};
  let changed = false;

  // Add concept if missing
  if (!("concept" in identity)) {
    update["system.identity.concept"] = "";
    changed = true;
  }

  // Add focus if missing
  if (!("focus" in identity)) {
    update["system.identity.focus"] = "";
    changed = true;
  }

  // Add backgroundTier if missing
  if (!("backgroundTier" in identity)) {
    update["system.identity.backgroundTier"] = 0;
    changed = true;
  }

  if (!changed) {
    return { ok: true, changed: false };
  }

  return { ok: true, changed: true, update };
}

export function planSchemaV2ItemMigration(storedSystem: unknown): MigrationPlan {
  if (!isPlainObject(storedSystem)) {
    return { ok: true, changed: false };
  }

  const version = typeof storedSystem.schemaVersion === "number" ? storedSystem.schemaVersion : 0;

  // Only migrate if we're at version 0 or 1 (legacy versions before this field existed)
  if (version > 1) {
    return { ok: true, changed: false };
  }

  // Check if this is a feature item with a cost field
  const cost = storedSystem.cost;
  if (!isPlainObject(cost)) {
    return { ok: true, changed: false };
  }

  // Add bp field if missing
  if ("bp" in cost) {
    return { ok: true, changed: false };
  }

  return {
    ok: true,
    changed: true,
    update: { "system.cost.bp": 0 },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
