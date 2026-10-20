import { judgeStoredChoice, type ChoiceListId } from "../rules/item-choices";
import type { MigrationNotice, MigrationPlan } from "./m001";

export const FIELD_MIGRATION_ID = "M004";

export function planWeaponFieldItemMigration(storedSystem: unknown, type?: string): MigrationPlan {
  if (type !== undefined && type !== "weapon") return { ok: true, changed: false };
  if (!isPlainObject(storedSystem)) return { ok: true, changed: false };
  if (type !== "weapon" && !isPlainObject(storedSystem.attack)) {
    return { ok: true, changed: false };
  }

  const update: Record<string, unknown> = {};
  const notices: MigrationNotice[] = [];
  recordChoice(storedSystem.category, "weaponCategory", "system.category", update, notices);
  if (isPlainObject(storedSystem.damage)) {
    recordChoice(storedSystem.damage.type, "damageType", "system.damage.type", update, notices);
  }
  return finishPlan(update, notices);
}

export function planSlingsProficiencyMigration(storedSystem: unknown): MigrationPlan {
  if (!isPlainObject(storedSystem)) return { ok: true, changed: false };
  const proficiencies = storedSystem.proficiencies;
  const weapons = isPlainObject(proficiencies) ? proficiencies.weapons : undefined;
  if (isPlainObject(weapons) && typeof weapons.slings === "boolean") {
    return { ok: true, changed: false };
  }
  return {
    ok: true,
    changed: true,
    update: { "system.proficiencies.weapons.slings": false },
  };
}

function recordChoice(
  stored: unknown,
  list: ChoiceListId,
  field: string,
  update: Record<string, unknown>,
  notices: MigrationNotice[],
): void {
  const verdict = judgeStoredChoice(list, stored);
  if (verdict.kind === "repair" && typeof stored === "string") {
    update[field] = verdict.to;
    notices.push({
      key: "PIVOT.Migration.FieldRepaired",
      field,
      from: stored,
      to: verdict.to,
    });
    return;
  }
  if (verdict.kind === "invalid") {
    notices.push({ key: "PIVOT.Migration.FieldInvalid", field, from: verdict.stored });
  }
}

function finishPlan(update: Record<string, unknown>, notices: MigrationNotice[]): MigrationPlan {
  const changed = Object.keys(update).length > 0;
  if (!changed && notices.length === 0) return { ok: true, changed: false };
  if (!changed) return { ok: true, changed: false, notices };
  if (notices.length === 0) return { ok: true, changed: true, update };
  return { ok: true, changed: true, update, notices };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
