import type { MigrationPlan } from "./m001";

export const WEAPON_EQUIPPED_MIGRATION_ID = "M004";

export function planWeaponEquippedMigration(
  storedSystem: unknown,
  itemType?: string,
): MigrationPlan {
  if (itemType !== "weapon" || !isPlainObject(storedSystem) || "equipped" in storedSystem) {
    return { ok: true, changed: false };
  }

  const equipped = Array.isArray(storedSystem.effects) && storedSystem.effects.length > 0;
  return {
    ok: true,
    changed: true,
    update: { "system.equipped": equipped },
  };
}

export function weaponEquippedMigrationNotice(
  itemName: string,
  actorName: string | undefined,
  equipped: boolean,
): string {
  const actor = actorName ? ` on '${actorName}'` : "";
  if (equipped) {
    return `M004: equipped weapon '${itemName}'${actor} so its bonuses keep applying`;
  }
  return `M004: set weapon '${itemName}'${actor} unequipped because it has no effect bonuses`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
