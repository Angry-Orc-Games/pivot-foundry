import { abilities, canonicalSkills, weaponCategories } from "../config";
import { type AbilityKey, abilityKeys, type DerivedEffectBonuses } from "./character-derived";

export const armourProficiencyCategories = ["light", "medium", "heavy", "shield"] as const;
export const effectRuleTypes = [
  "abilityScoreBonus",
  "skillBonus",
  "armourProficiency",
  "weaponProficiency",
  "acBonus",
  "initiativeBonus",
  "speedBonus",
  "poolMaxBonus",
  "mpMaxBonus",
] as const;

export type ArmourProficiencyCategory = (typeof armourProficiencyCategories)[number];
export type WeaponCategory = (typeof weaponCategories)[number];
export type EffectRuleType = (typeof effectRuleTypes)[number];

export type EffectRule =
  | { type: "abilityScoreBonus"; ability: AbilityKey; amount: number }
  | { type: "skillBonus"; skill: string; amount: number }
  | { type: "armourProficiency"; category: ArmourProficiencyCategory }
  | { type: "weaponProficiency"; category: WeaponCategory }
  | { type: "acBonus"; amount: number }
  | { type: "initiativeBonus"; amount: number }
  | { type: "speedBonus"; amount: number }
  | { type: "poolMaxBonus"; amount: number }
  | { type: "mpMaxBonus"; amount: number };

export interface CharacterEffectSummary extends Required<DerivedEffectBonuses> {
  abilityScoreBonuses: Record<AbilityKey, number>;
  skillBonuses: Record<string, number>;
  armourProficiencies: { light: boolean; medium: boolean; heavy: boolean };
  shieldProficiency: boolean;
  weaponProficiencies: Record<WeaponCategory, boolean>;
  acBonus: number;
  initiativeBonus: number;
  speedBonus: number;
  poolMaxBonus: number;
  mpMaxBonus: number;
}

export const EFFECT_TYPE_LABEL_KEYS: Record<EffectRuleType, string> = {
  abilityScoreBonus: "PIVOT.Effects.AbilityScoreBonus",
  skillBonus: "PIVOT.Effects.SkillBonus",
  armourProficiency: "PIVOT.Effects.ArmourProficiency",
  weaponProficiency: "PIVOT.Effects.WeaponProficiency",
  acBonus: "PIVOT.Effects.AcBonus",
  initiativeBonus: "PIVOT.Effects.InitiativeBonus",
  speedBonus: "PIVOT.Effects.SpeedBonus",
  poolMaxBonus: "PIVOT.Effects.PoolMaxBonus",
  mpMaxBonus: "PIVOT.Effects.MpMaxBonus",
};

const canonicalSkillIds = new Set(canonicalSkills.map((skill) => skill.id));
const weaponCategorySet = new Set<string>(weaponCategories);
const armourProficiencySet = new Set<string>(armourProficiencyCategories);
const abilityKeySet = new Set<string>(abilityKeys);

export function emptyCharacterEffectSummary(): CharacterEffectSummary {
  return {
    abilityScoreBonuses: {
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
    },
    skillBonuses: {},
    armourProficiencies: { light: false, medium: false, heavy: false },
    shieldProficiency: false,
    weaponProficiencies: {
      meleeLight: false,
      meleeMedium: false,
      meleeHeavy: false,
      meleeTwoHandedHeavy: false,
      bows: false,
      crossbows: false,
      thrown: false,
      improvised: false,
    },
    acBonus: 0,
    initiativeBonus: 0,
    speedBonus: 0,
    poolMaxBonus: 0,
    mpMaxBonus: 0,
  };
}

export function validateEffectRule(value: unknown): EffectRule {
  if (!isPlainObject(value)) {
    throw new Error("Effect rule must be a plain object.");
  }

  const type = value.type;
  switch (type) {
    case "abilityScoreBonus":
      assertExactKeys(value, ["type", "ability", "amount"]);
      return {
        type,
        ability: requireAbilityKey(value.ability),
        amount: requireFiniteInteger(value.amount, "amount"),
      };
    case "skillBonus":
      assertExactKeys(value, ["type", "skill", "amount"]);
      return {
        type,
        skill: requireCanonicalSkillId(value.skill),
        amount: requireFiniteInteger(value.amount, "amount"),
      };
    case "armourProficiency":
      assertExactKeys(value, ["type", "category"]);
      return {
        type,
        category: requireArmourProficiencyCategory(value.category),
      };
    case "weaponProficiency":
      assertExactKeys(value, ["type", "category"]);
      return {
        type,
        category: requireWeaponCategory(value.category),
      };
    case "acBonus":
    case "initiativeBonus":
    case "speedBonus":
    case "poolMaxBonus":
    case "mpMaxBonus":
      assertExactKeys(value, ["type", "amount"]);
      return {
        type,
        amount: requireFiniteInteger(value.amount, "amount"),
      };
    default:
      throw new Error(`Unsupported effect type: ${String(type)}`);
  }
}

export function parseStoredEffect(value: unknown): EffectRule | null {
  if (!isPlainObject(value) || typeof value.type !== "string") return null;

  try {
    switch (value.type) {
      case "abilityScoreBonus":
        return {
          type: value.type,
          ability: requireAbilityKey(value.ability),
          amount: requireFiniteInteger(value.amount, "amount"),
        };
      case "skillBonus":
        return {
          type: value.type,
          skill: requireCanonicalSkillId(value.skill),
          amount: requireFiniteInteger(value.amount, "amount"),
        };
      case "armourProficiency":
        return {
          type: value.type,
          category: requireArmourProficiencyCategory(value.category),
        };
      case "weaponProficiency":
        return {
          type: value.type,
          category: requireWeaponCategory(value.category),
        };
      case "acBonus":
      case "initiativeBonus":
      case "speedBonus":
      case "poolMaxBonus":
      case "mpMaxBonus":
        return {
          type: value.type,
          amount: requireFiniteInteger(value.amount, "amount"),
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function aggregateCharacterEffects(effects: readonly EffectRule[]): CharacterEffectSummary {
  const summary = emptyCharacterEffectSummary();

  for (const effect of effects) {
    switch (effect.type) {
      case "abilityScoreBonus":
        summary.abilityScoreBonuses[effect.ability] += effect.amount;
        break;
      case "skillBonus":
        summary.skillBonuses[effect.skill] =
          (summary.skillBonuses[effect.skill] ?? 0) + effect.amount;
        break;
      case "armourProficiency":
        if (effect.category === "shield") summary.shieldProficiency = true;
        else summary.armourProficiencies[effect.category] = true;
        break;
      case "weaponProficiency":
        summary.weaponProficiencies[effect.category] = true;
        break;
      case "acBonus":
        summary.acBonus += effect.amount;
        break;
      case "initiativeBonus":
        summary.initiativeBonus += effect.amount;
        break;
      case "speedBonus":
        summary.speedBonus += effect.amount;
        break;
      case "poolMaxBonus":
        summary.poolMaxBonus += effect.amount;
        break;
      case "mpMaxBonus":
        summary.mpMaxBonus += effect.amount;
        break;
    }
  }

  return summary;
}

export function collectEmbeddedItemEffects(items: readonly { system?: unknown }[]): EffectRule[] {
  const effects: EffectRule[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const system = item.system;
    if (!isPlainObject(system) || !Array.isArray(system.effects)) continue;
    for (const entry of system.effects) {
      const parsed = parseStoredEffect(entry);
      if (parsed) effects.push(parsed);
    }
  }

  return effects;
}

export function describeEffectRule(effect: EffectRule): { typeLabelKey: string; detail: string } {
  const typeLabelKey = EFFECT_TYPE_LABEL_KEYS[effect.type];

  switch (effect.type) {
    case "abilityScoreBonus": {
      const ability = abilities.find((entry) => entry.key === effect.ability);
      return {
        typeLabelKey,
        detail: `${ability?.short ?? effect.ability} ${formatSigned(effect.amount)}`,
      };
    }
    case "skillBonus": {
      const skill = canonicalSkills.find((entry) => entry.id === effect.skill);
      return {
        typeLabelKey,
        detail: `${skill?.label ?? effect.skill} ${formatSigned(effect.amount)}`,
      };
    }
    case "armourProficiency":
      return { typeLabelKey, detail: armourProficiencyLabel(effect.category) };
    case "weaponProficiency":
      return { typeLabelKey, detail: weaponProficiencyLabel(effect.category) };
    case "acBonus":
    case "initiativeBonus":
    case "speedBonus":
    case "poolMaxBonus":
    case "mpMaxBonus":
      return { typeLabelKey, detail: formatSigned(effect.amount) };
  }
}

function armourProficiencyLabel(category: ArmourProficiencyCategory): string {
  switch (category) {
    case "light":
      return "Light";
    case "medium":
      return "Medium";
    case "heavy":
      return "Heavy";
    case "shield":
      return "Shields";
  }
}

function weaponProficiencyLabel(category: WeaponCategory): string {
  switch (category) {
    case "meleeLight":
      return "Melee: Light";
    case "meleeMedium":
      return "Melee: Medium";
    case "meleeHeavy":
      return "Melee: Heavy";
    case "meleeTwoHandedHeavy":
      return "Melee: 2-Handed";
    case "bows":
      return "Bows";
    case "crossbows":
      return "Crossbows";
    case "thrown":
      return "Thrown Weapons";
    case "improvised":
      return "Improvised";
  }
}

function requireAbilityKey(value: unknown): AbilityKey {
  if (typeof value === "string" && abilityKeySet.has(value)) return value as AbilityKey;
  throw new Error(`Unknown ability: ${String(value)}`);
}

function requireCanonicalSkillId(value: unknown): string {
  if (typeof value === "string" && canonicalSkillIds.has(value)) return value;
  throw new Error(`Unknown skill: ${String(value)}`);
}

function requireArmourProficiencyCategory(value: unknown): ArmourProficiencyCategory {
  if (typeof value === "string" && armourProficiencySet.has(value)) {
    return value as ArmourProficiencyCategory;
  }
  throw new Error(`Unknown armour proficiency category: ${String(value)}`);
}

function requireWeaponCategory(value: unknown): WeaponCategory {
  if (typeof value === "string" && weaponCategorySet.has(value)) return value as WeaponCategory;
  throw new Error(`Unknown weapon category: ${String(value)}`);
}

function requireFiniteInteger(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value) && Number.isFinite(value)) return value;
  throw new Error(`${field} must be a finite integer.`);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`Unexpected keys in effect rule: ${actual.join(", ")}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
