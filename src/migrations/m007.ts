import { SYSTEM_ID } from "../config";
import type { MigrationPlan } from "./m001";

export const WEAPON_EQUIPPED_MIGRATION_ID = "M007";
export const M007_EQUIPPED_FLAG = `flags.${SYSTEM_ID}.m007`;

export function planWeaponEquippedMigration(
  storedSystem: unknown,
  itemType?: string,
  storedFlags?: unknown,
): MigrationPlan {
  if (!isPlainObject(storedSystem)) return { ok: true, changed: false };

  if (hasGearEquipMarker(storedFlags)) return { ok: true, changed: false };

  if (itemType === "equipment") {
    return planEquipmentEquippedMigration(storedSystem);
  }

  if (itemType !== "weapon") return { ok: true, changed: false };
  return planUnmarkedWeaponMigration(storedSystem);
}

export function weaponEquippedMigrationNotice(
  itemName: string,
  actorName: string | undefined,
  equipped: boolean,
  itemType: "weapon" | "equipment" = "weapon",
): string {
  const actor = actorName ? ` on '${actorName}'` : "";
  if (equipped) {
    return `M007: equipped ${itemType} '${itemName}'${actor} so its bonuses keep applying`;
  }
  return `M007: set weapon '${itemName}'${actor} unequipped because it has no effect bonuses`;
}

export function initializeEquippedMarker(item: {
  type?: string;
  flags?: unknown;
  updateSource?: (data: Record<string, unknown>) => unknown;
}): void {
  if (item.type !== "weapon" && item.type !== "equipment") return;
  if (!item.updateSource || hasGearEquipMarker(item.flags)) return;
  item.updateSource({ [M007_EQUIPPED_FLAG]: true });
}

function planUnmarkedWeaponMigration(storedSystem: Record<string, unknown>): MigrationPlan {
  const hasEffects = Array.isArray(storedSystem.effects) && storedSystem.effects.length > 0;
  const equipped = hasEffects || storedSystem.equipped === true;
  const update: Record<string, unknown> = { [M007_EQUIPPED_FLAG]: true };
  if (storedSystem.equipped !== equipped) update["system.equipped"] = equipped;
  return { ok: true, changed: true, update };
}

function planEquipmentEquippedMigration(storedSystem: Record<string, unknown>): MigrationPlan {
  const hasEffects = Array.isArray(storedSystem.effects) && storedSystem.effects.length > 0;
  const update: Record<string, unknown> = { [M007_EQUIPPED_FLAG]: true };
  if (hasEffects && storedSystem.equipped === false) update["system.equipped"] = true;
  return { ok: true, changed: true, update };
}

function hasGearEquipMarker(storedFlags: unknown): boolean {
  if (!isPlainObject(storedFlags)) return false;
  const scope = storedFlags[SYSTEM_ID];
  if (!isPlainObject(scope)) return false;
  return scope.m007 === true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
