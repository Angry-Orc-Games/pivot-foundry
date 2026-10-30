import { parseStoredEffect } from "../rules/effects";
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  SCHEMA_MIGRATION_ID,
  SHEET_V2_SCHEMA_VERSION,
} from "../rules/schema-version";

export { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION, SCHEMA_MIGRATION_ID };

export type MigrationPlan =
  | { ok: true; changed: false }
  | { ok: true; changed: true; update: Record<string, unknown> }
  | { ok: false; error: string };

export interface SchemaMigrationOptions {
  currentVersion?: number;
}

export function planActorMigration(
  storedSystem: unknown,
  options?: SchemaMigrationOptions,
): MigrationPlan {
  return planDocumentMigration(storedSystem, "actor", currentVersion(options));
}

export function planItemMigration(
  storedSystem: unknown,
  options?: SchemaMigrationOptions,
): MigrationPlan {
  return planDocumentMigration(storedSystem, "item", currentVersion(options));
}

function currentVersion(options?: SchemaMigrationOptions): number {
  return options?.currentVersion ?? CURRENT_SCHEMA_VERSION;
}

function planDocumentMigration(
  storedSystem: unknown,
  kind: "actor" | "item",
  current: number,
): MigrationPlan {
  if (storedSystem === undefined || storedSystem === null) {
    return migrateFromLegacy(kind, {}, current);
  }
  if (!isPlainObject(storedSystem)) {
    return { ok: false, error: "system data is not an object" };
  }

  const version = readStoredSchemaVersion(storedSystem.schemaVersion);
  if (version === "invalid") {
    return { ok: false, error: "schemaVersion is not a finite integer >= 0" };
  }
  if (version > current && version !== SHEET_V2_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `schemaVersion ${version} is newer than supported version ${current}`,
    };
  }

  if (kind === "item") {
    const effectsResult = inspectStoredEffects(storedSystem.effects);
    if (!effectsResult.ok) return effectsResult;
  }

  if (
    version === current ||
    (version === SHEET_V2_SCHEMA_VERSION && current < SHEET_V2_SCHEMA_VERSION)
  ) {
    return { ok: true, changed: false };
  }

  return migrateFromLegacy(kind, storedSystem, current);
}

function migrateFromLegacy(
  kind: "actor" | "item",
  storedSystem: Record<string, unknown>,
  current: number,
): MigrationPlan {
  if (kind === "item") {
    const effectsResult = inspectStoredEffects(storedSystem.effects);
    if (!effectsResult.ok) return effectsResult;
    const update: Record<string, unknown> = {
      "system.schemaVersion": current,
    };
    if (storedSystem.effects === undefined) {
      update["system.effects"] = [];
    }
    return { ok: true, changed: true, update };
  }

  return {
    ok: true,
    changed: true,
    update: { "system.schemaVersion": current },
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

/** Foundry copies `initial` into source before M001 reads it. Stamp only a new document. */
export function initializeSchemaVersion(document: {
  system?: unknown;
  updateSource?: (data: Record<string, unknown>) => unknown;
}): void {
  if (!document.updateSource) return;
  const version = isPlainObject(document.system) ? document.system.schemaVersion : undefined;
  if (version !== undefined && version !== null && version !== LEGACY_SCHEMA_VERSION) return;
  document.updateSource({ "system.schemaVersion": CURRENT_SCHEMA_VERSION });
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
