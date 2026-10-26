import {
  hasLegacyEchelon,
  migrateStoredEchelon,
  peekLegacyEchelon,
  takeLegacyEchelon,
} from "../rules/echelon";
import type { MigrationPlan } from "./m001";

export const MAGIC_ECHELON_MIGRATION_ID = "M006";

export const M006_CORE_REVIEW_NOTICE =
  "These magic abilities were stored as echelon 1. The old sheet could not save Core, so switch any Core abilities to Core by hand.";

export function planMagicEchelonMigration(
  storedSystem: unknown,
  rawSystem?: object,
): MigrationPlan {
  if (rawSystem && hasLegacyEchelon(rawSystem)) {
    const original = takeLegacyEchelon(rawSystem);
    return {
      ok: true,
      changed: true,
      diff: false,
      update: { "system.echelon": migrateStoredEchelon(original) },
    };
  }

  if (!isPlainObject(storedSystem) || !Object.hasOwn(storedSystem, "echelon")) {
    return { ok: true, changed: false };
  }

  const next = migrateStoredEchelon(storedSystem.echelon);
  if (next === storedSystem.echelon) return { ok: true, changed: false };
  return { ok: true, changed: true, update: { "system.echelon": next } };
}

export function coreReviewLine(
  document: { type?: string; name?: string; id?: string },
  storedSystem: unknown,
  actorName?: string,
  rawSystem?: object,
): string | undefined {
  const remembered = rawSystem ? peekLegacyEchelon(rawSystem) : undefined;
  const echelon =
    remembered !== undefined
      ? remembered
      : isPlainObject(storedSystem)
        ? storedSystem.echelon
        : undefined;
  if (document.type !== "magicAbility" || echelon !== 1) return undefined;
  const itemName = document.name ?? document.id ?? "unknown";
  return actorName ? `${actorName}: ${itemName}` : itemName;
}

export function formatM006CoreReview(lines: readonly string[]): string {
  return [M006_CORE_REVIEW_NOTICE, ...lines].join("\n");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
