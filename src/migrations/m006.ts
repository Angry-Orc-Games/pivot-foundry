import { migrateStoredEchelon } from "../rules/echelon";
import type { MigrationPlan } from "./m001";

export const MAGIC_ECHELON_MIGRATION_ID = "M006";

export const M006_CORE_REVIEW_NOTICE =
  "These magic abilities were stored as echelon 1. The old sheet could not save Core, so switch any Core abilities to Core by hand.";

export function planMagicEchelonMigration(storedSystem: unknown): MigrationPlan {
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
): string | undefined {
  if (!isPlainObject(storedSystem)) return undefined;
  if (document.type !== "magicAbility" || storedSystem.echelon !== 1) return undefined;
  const itemName = document.name ?? document.id ?? "unknown";
  return actorName ? `${actorName}: ${itemName}` : itemName;
}

export function formatM006CoreReview(lines: readonly string[]): string {
  return [M006_CORE_REVIEW_NOTICE, ...lines].join("\n");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
