export interface ChoiceEntry<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
}

export const INVALID_CHOICE_LABEL = "Invalid, pick one";

export const weaponCategories = [
  { id: "meleeLight", label: "Light Melee" },
  { id: "meleeMedium", label: "Medium Melee" },
  { id: "meleeHeavy", label: "Heavy Melee" },
  { id: "meleeTwoHandedHeavy", label: "Two-Handed Heavy Melee" },
  { id: "improvised", label: "Improvised" },
  { id: "bows", label: "Bows" },
  { id: "crossbows", label: "Crossbows" },
  { id: "slings", label: "Slings" },
  { id: "thrown", label: "Thrown Weapons" },
] as const satisfies readonly ChoiceEntry[];

export type WeaponCategoryId = (typeof weaponCategories)[number]["id"];

export const attackAbilities = [
  { id: "str", label: "Str" },
  { id: "dex", label: "Dex" },
  { id: "int", label: "Int" },
  { id: "wis", label: "Wis" },
  { id: "cha", label: "Cha" },
] as const satisfies readonly ChoiceEntry[];

export type AttackAbilityId = (typeof attackAbilities)[number]["id"];

export const damageAbilities = [
  { id: "str", label: "Str" },
  { id: "dex", label: "Dex" },
  { id: "none", label: "None" },
] as const satisfies readonly ChoiceEntry[];

export type DamageAbilityId = (typeof damageAbilities)[number]["id"];

export const armourCategories = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
  { id: "shield", label: "Shield" },
  { id: "helmet", label: "Helmet" },
  { id: "other", label: "Other" },
] as const satisfies readonly ChoiceEntry[];

export type ArmourCategoryId = (typeof armourCategories)[number]["id"];

export const damageTypes = [
  "Acid",
  "Bludgeoning",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Thunder",
] as const;

export type DamageTypeId = (typeof damageTypes)[number];

export type ChoiceListId =
  "weaponCategory" | "attackAbility" | "damageAbility" | "armourCategory" | "damageType";

export type ChoiceVerdict =
  { kind: "keep" } | { kind: "repair"; to: string } | { kind: "invalid"; stored: string };

export interface SelectBinding {
  options: Record<string, string>;
  selected: string;
}

interface ChoiceListSpec {
  entries: readonly ChoiceEntry[];
  repairs: Readonly<Record<string, string>>;
  blank: "silent-invalid" | "invalid";
  caseFoldLabels: boolean;
  nullSelects?: DamageAbilityId;
}

const damageTypeEntries: readonly ChoiceEntry<DamageTypeId>[] = damageTypes.map((label) => ({
  id: label,
  label,
}));

const weaponCategoryRepairs = {
  rangedLight: "bows",
} as const satisfies Record<string, WeaponCategoryId>;

const choiceLists: Record<ChoiceListId, ChoiceListSpec> = {
  weaponCategory: {
    entries: weaponCategories,
    repairs: weaponCategoryRepairs,
    blank: "invalid",
    caseFoldLabels: false,
  },
  attackAbility: {
    entries: attackAbilities,
    repairs: {},
    blank: "invalid",
    caseFoldLabels: false,
  },
  damageAbility: {
    entries: damageAbilities,
    repairs: {},
    blank: "invalid",
    caseFoldLabels: false,
    nullSelects: "none",
  },
  armourCategory: {
    entries: armourCategories,
    repairs: {},
    blank: "invalid",
    caseFoldLabels: false,
  },
  damageType: {
    entries: damageTypeEntries,
    repairs: {},
    blank: "silent-invalid",
    caseFoldLabels: true,
  },
};

export function judgeStoredChoice(list: ChoiceListId, stored: unknown): ChoiceVerdict {
  const spec = choiceLists[list];
  if (stored === "") {
    return spec.blank === "silent-invalid" ? { kind: "keep" } : { kind: "invalid", stored: "" };
  }
  if (stored === null && spec.nullSelects) return { kind: "keep" };
  if (typeof stored !== "string") return { kind: "keep" };
  if (spec.entries.some((entry) => entry.id === stored)) return { kind: "keep" };
  if (spec.caseFoldLabels) {
    const folded = stored.toLowerCase();
    const match = spec.entries.find((entry) => entry.label.toLowerCase() === folded);
    if (match && stored !== match.label) return { kind: "repair", to: match.label };
  }
  const repaired = spec.repairs[stored];
  if (repaired) return { kind: "repair", to: repaired };
  return { kind: "invalid", stored };
}

export function selectOptionRecord(
  list: ChoiceListId,
  stored: unknown,
  invalidLabel: string,
): SelectBinding {
  const spec = choiceLists[list];
  const options: Record<string, string> = {};
  if (typeof stored === "string" && !spec.entries.some((entry) => entry.id === stored)) {
    options[stored] = invalidLabel;
  }
  for (const entry of spec.entries) options[entry.id] = entry.label;
  if (stored === null && spec.nullSelects) return { options, selected: spec.nullSelects };
  return { options, selected: typeof stored === "string" ? stored : "" };
}

export function isWeaponCategoryId(value: unknown): value is WeaponCategoryId {
  return hasChoiceId(weaponCategories, value);
}

export function isAttackAbilityId(value: unknown): value is AttackAbilityId {
  return hasChoiceId(attackAbilities, value);
}

export function isDamageAbilityId(value: unknown): value is DamageAbilityId {
  return hasChoiceId(damageAbilities, value);
}

export function isArmourCategoryId(value: unknown): value is ArmourCategoryId {
  return hasChoiceId(armourCategories, value);
}

export function isDamageTypeId(value: unknown): value is DamageTypeId {
  return typeof value === "string" && damageTypes.some((label) => label === value);
}

export function emptyWeaponTraining(): { [K in WeaponCategoryId]: false } {
  return Object.fromEntries(weaponCategories.map((entry) => [entry.id, false])) as {
    [K in WeaponCategoryId]: false;
  };
}

function hasChoiceId(entries: readonly ChoiceEntry[], value: unknown): boolean {
  return typeof value === "string" && entries.some((entry) => entry.id === value);
}
