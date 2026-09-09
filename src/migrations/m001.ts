import { parseStoredEffect } from "../rules/effects";
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  SCHEMA_MIGRATION_ID,
} from "../rules/schema-version";

export { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION, SCHEMA_MIGRATION_ID };

export type MigrationPlan =
  | { ok: true; changed: false }
  | { ok: true; changed: true; update: Record<string, unknown> }
  | { ok: false; error: string };

export function planActorMigration(storedSystem: unknown): MigrationPlan {
  return planDocumentMigration(storedSystem, "actor");
}

export function planItemMigration(storedSystem: unknown): MigrationPlan {
  return planDocumentMigration(storedSystem, "item");
}

function planDocumentMigration(storedSystem: unknown, kind: "actor" | "item"): MigrationPlan {
  if (storedSystem === undefined || storedSystem === null) {
    return migrateFromLegacy(kind, {});
  }
  if (!isPlainObject(storedSystem)) {
    return { ok: false, error: "system data is not an object" };
  }

  const version = readStoredSchemaVersion(storedSystem.schemaVersion);
  if (version === "invalid") {
    return { ok: false, error: "schemaVersion is not a finite integer >= 0" };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `schemaVersion ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    };
  }

  if (kind === "item") {
    const effectsResult = inspectStoredEffects(storedSystem.effects);
    if (!effectsResult.ok) return effectsResult;
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return { ok: true, changed: false };
  }

  return migrateFromLegacy(kind, storedSystem);
}

function migrateFromLegacy(
  kind: "actor" | "item",
  storedSystem: Record<string, unknown>,
): MigrationPlan {
  if (kind === "item") {
    const effectsResult = inspectStoredEffects(storedSystem.effects);
    if (!effectsResult.ok) return effectsResult;
    const update: Record<string, unknown> = {
      "system.schemaVersion": CURRENT_SCHEMA_VERSION,
    };
    if (storedSystem.effects === undefined) {
      update["system.effects"] = [];
    }
    return { ok: true, changed: true, update };
  }

  return {
    ok: true,
    changed: true,
    update: { "system.schemaVersion": CURRENT_SCHEMA_VERSION },
  };
}

function inspectStoredEffects(effects: unknown): MigrationPlan {
  if (effects === undefined) return { ok: true, changed: false };
  if (!Array.isArray(effects)) {
    return { ok: false, error: "effects must be an array" };
  }

  for (const [index, effect] of effects.entries()) {
    if (!parseStoredEffect(effect)) {
      return { ok: false, error: `effects[${index}] is not a supported EffectRule` };
    }
  }

  return { ok: true, changed: false };
}

function readStoredSchemaVersion(value: unknown): number | "invalid" {
  if (value === undefined || value === null) return LEGACY_SCHEMA_VERSION;
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  ) {
    return value;
  }
  return "invalid";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
