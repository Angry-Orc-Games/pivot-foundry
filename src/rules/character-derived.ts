import { abilityModifier, proficiencyBonusForLevel } from "./modifiers";

export const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type AbilityKey = (typeof abilityKeys)[number];

export type PassivePerceptionMode = "normal" | "advantage" | "disadvantage";

export interface AbilitySource {
  score: number;
  primary: boolean;
}

export type AbilitySourceMap = Record<AbilityKey, AbilitySource>;

export interface SkillSource {
  ability: AbilityKey;
  proficient: boolean;
  deepening?: number;
  expertise?: boolean;
  bonus?: number;
}

export type SkillSourceMap = Record<string, SkillSource>;

export interface ArmourSource {
  name: string;
  category: "light" | "medium" | "heavy" | "shield" | "helmet" | "other";
  acBonus: number;
  equipped: boolean;
}

export interface WeightSource {
  weight: number;
  quantity: number;
  carried: boolean;
}

export type WeaponProficiencyMap = Partial<Record<string, boolean>>;

export interface WeaponAttackSource {
  category: string;
  attackAbility: AbilityKey;
  damageAbility: AbilityKey | null;
  attackBonus: number;
  damageBonus: number;
  damageFormula: string;
  range: {
    normal: number;
    long: number;
  };
}

export interface CharacterDerivedInput {
  level: number;
  abilities: AbilitySourceMap;
  skills: SkillSourceMap;
  magic: {
    awakened: boolean;
    ability: AbilityKey | null;
  };
  equipment: WeightSource[];
  armour?: ArmourSource[];
  manualArmourBonus?: number;
  initiativeBonus?: number;
  passivePerceptionMode?: PassivePerceptionMode;
  poolBonus?: number;
}

export interface AbilityDerived extends AbilitySource {
  mod: number;
}

export interface SkillDerived extends SkillSource {
  total: number;
}

export interface ArmourClassDerived {
  value: number;
  armourWorn: string;
  breakdown: string[];
}

export interface AttackSummary {
  bth: number;
  btd: number;
  damageFormula: string;
  range: {
    normal: number;
    long: number;
  };
  proficient: boolean;
}

export interface CharacterDerived {
  abilities: Record<AbilityKey, AbilityDerived>;
  saves: Record<AbilityKey, number>;
  skills: Record<string, SkillDerived>;
  proficiencyBonus: number;
  passivePerception: number;
  pool: {
    max: number;
  };
  magic: {
    mp: {
      max: number;
    };
  };
  armourClass: ArmourClassDerived;
  initiative: number;
  totalWeight: number;
}

export function calculateCharacterDerived(input: CharacterDerivedInput): CharacterDerived {
  const proficiencyBonus = proficiencyBonusForLevel(input.level);
  const abilities = abilityKeys.reduce<Record<AbilityKey, AbilityDerived>>(
    (derived, key) => {
      const source = input.abilities[key];
      derived[key] = { ...source, mod: abilityModifier(source.score) };
      return derived;
    },
    {} as Record<AbilityKey, AbilityDerived>,
  );

  const saves = abilityKeys.reduce<Record<AbilityKey, number>>(
    (derived, key) => {
      const ability = abilities[key];
      derived[key] = ability.mod + (ability.primary ? proficiencyBonus : 0);
      return derived;
    },
    {} as Record<AbilityKey, number>,
  );

  const skills = Object.fromEntries(
    Object.entries(input.skills).map(([id, skill]) => [
      id,
      {
        ...skill,
        total: calculateSkillTotal({
          abilityModifier: abilities[skill.ability].mod,
          proficiencyBonus,
          proficient: skill.proficient,
          deepening: skill.deepening,
          expertise: skill.expertise,
          bonus: skill.bonus,
          excludesDeepening: id === "controlMagic",
        }),
      },
    ]),
  );

  const perceptionTotal = skills.perception?.total ?? abilities.wis.mod;
  const magicAbility = input.magic.ability ? abilities[input.magic.ability] : null;

  return {
    abilities,
    saves,
    skills,
    proficiencyBonus,
    passivePerception: calculatePassivePerception({
      perceptionTotal,
      mode: input.passivePerceptionMode,
    }),
    pool: {
      max: Math.max(1, input.level + (input.poolBonus ?? 0)),
    },
    magic: {
      mp: {
        max: calculateManaMaximum({
          awakened: input.magic.awakened,
          level: input.level,
          abilityScore: magicAbility?.score ?? 0,
        }),
      },
    },
    armourClass: calculateArmourClass({
      dexterityModifier: abilities.dex.mod,
      armour: input.armour ?? [],
      manualBonus: input.manualArmourBonus ?? 0,
    }),
    initiative: abilities.dex.mod + (input.initiativeBonus ?? 0),
    totalWeight: calculateTotalWeight(input.equipment),
  };
}

export function calculateSkillTotal({
  abilityModifier: abilityBonus,
  proficiencyBonus,
  proficient,
  deepening = 0,
  expertise = false,
  bonus = 0,
  excludesDeepening = false,
}: {
  abilityModifier: number;
  proficiencyBonus: number;
  proficient: boolean;
  deepening?: number;
  expertise?: boolean;
  bonus?: number;
  excludesDeepening?: boolean;
}): number {
  const trainingBonus = proficient ? proficiencyBonus : 0;
  const expertiseBonus = proficient && expertise ? proficiencyBonus : 0;
  const deepeningBonus = excludesDeepening ? 0 : Math.min(Math.max(0, deepening), proficiencyBonus);
  return abilityBonus + trainingBonus + expertiseBonus + deepeningBonus + bonus;
}

export function calculatePassivePerception({
  perceptionTotal,
  mode = "normal",
}: {
  perceptionTotal: number;
  mode?: PassivePerceptionMode;
}): number {
  if (mode === "advantage") return 10 + perceptionTotal + 5;
  if (mode === "disadvantage") return 10 + perceptionTotal - 5;
  return 10 + perceptionTotal;
}

export function calculateManaMaximum({
  awakened,
  level,
  abilityScore,
}: {
  awakened: boolean;
  level: number;
  abilityScore: number;
}): number {
  if (!awakened || abilityScore < 1) return 0;
  return Math.max(0, Math.floor(abilityScore / 2) + abilityModifier(abilityScore) * level);
}

export function calculateArmourClass({
  dexterityModifier,
  armour,
  manualBonus = 0,
}: {
  dexterityModifier: number;
  armour: ArmourSource[];
  manualBonus?: number;
}): ArmourClassDerived {
  const equipped = armour.filter((item) => item.equipped);
  const wornArmour = equipped.find((item) => ["light", "medium", "heavy"].includes(item.category));
  const dexBonus = dexterityModifierForArmour(dexterityModifier, wornArmour?.category);
  const breakdown = [`Base 10`, formatSigned("Dex", dexBonus)];
  let value = 10 + dexBonus;

  for (const item of equipped) {
    value += item.acBonus;
    breakdown.push(formatSigned(item.name, item.acBonus));
  }

  if (manualBonus !== 0) {
    value += manualBonus;
    breakdown.push(formatSigned("Manual", manualBonus));
  }

  return {
    value,
    armourWorn: equipped.map((item) => item.name).join(", "),
    breakdown,
  };
}

export function calculateTotalWeight(items: WeightSource[]): number {
  return items.reduce((total, item) => {
    if (!item.carried) return total;
    return total + item.weight * item.quantity;
  }, 0);
}

export function calculateAttackSummary({
  proficiencyBonus,
  abilityModifiers,
  weaponProficiencies,
  weapon,
}: {
  proficiencyBonus: number;
  abilityModifiers: Record<AbilityKey, number>;
  weaponProficiencies: WeaponProficiencyMap;
  weapon: WeaponAttackSource;
}): AttackSummary {
  const proficient = Boolean(weaponProficiencies[weapon.category]);
  return {
    bth:
      abilityModifiers[weapon.attackAbility] +
      (proficient ? proficiencyBonus : 0) +
      weapon.attackBonus,
    btd: (weapon.damageAbility ? abilityModifiers[weapon.damageAbility] : 0) + weapon.damageBonus,
    damageFormula: weapon.damageFormula,
    range: weapon.range,
    proficient,
  };
}

function dexterityModifierForArmour(
  dexterityModifier: number,
  category: ArmourSource["category"] | undefined,
): number {
  if (category === "heavy") return 0;
  if (category === "medium") return Math.min(dexterityModifier, 2);
  return dexterityModifier;
}

function formatSigned(label: string, value: number): string {
  return `${label} ${value >= 0 ? "+" : ""}${value}`;
}
