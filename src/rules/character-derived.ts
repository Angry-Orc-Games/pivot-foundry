import { bonusStackMode, exclusionGroupId, stackIdenticalBonuses } from "./ac-stacking";
import { abilityModifier, proficiencyBonusForLevel } from "./modifiers";
import { baseSpeedForSpecies, unknownSpeciesSpeedMessage } from "./species-speed";

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
  category: "light" | "medium" | "heavy" | "shield" | "helmet" | "other" | "natural";
  acBonus: number;
  equipped: boolean;
  stackKey?: string;
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
  mpBonus?: number;
  species?: string;
  speed?: {
    value: number;
    bonus: number;
  };
  proficiencies?: {
    armour?: { light?: boolean; medium?: boolean; heavy?: boolean };
    shields?: boolean;
    weapons?: WeaponProficiencyMap;
  };
}

export interface DerivedEffectBonuses {
  abilityScoreBonuses?: Partial<Record<AbilityKey, number>>;
  skillBonuses?: Partial<Record<string, number>>;
  armourProficiencies?: { light?: boolean; medium?: boolean; heavy?: boolean };
  shieldProficiency?: boolean;
  weaponProficiencies?: WeaponProficiencyMap;
  acBonus?: number;
  initiativeBonus?: number;
  speedBonus?: number;
  poolMaxBonus?: number;
  mpMaxBonus?: number;
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
  speed: number;
  totalWeight: number;
  proficiencies: {
    armour: { light: boolean; medium: boolean; heavy: boolean };
    shields: boolean;
    weapons: WeaponProficiencyMap;
  };
}

export function calculateCharacterDerived(
  input: CharacterDerivedInput,
  effects: DerivedEffectBonuses = {},
): CharacterDerived {
  const proficiencyBonus = proficiencyBonusForLevel(input.level);
  const effectiveScores = abilityKeys.reduce<Record<AbilityKey, number>>(
    (scores, key) => {
      const source = input.abilities[key];
      const bonus = effects.abilityScoreBonuses?.[key] ?? 0;
      scores[key] = clampAbilityScore(source.score + bonus);
      return scores;
    },
    {} as Record<AbilityKey, number>,
  );
  const abilities = abilityKeys.reduce<Record<AbilityKey, AbilityDerived>>(
    (derived, key) => {
      const source = input.abilities[key];
      derived[key] = { ...source, mod: abilityModifier(effectiveScores[key]) };
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
          bonus: (skill.bonus ?? 0) + (effects.skillBonuses?.[id] ?? 0),
          excludesDeepening: id === "controlMagic",
        }),
      },
    ]),
  );

  const perceptionTotal = skills.perception?.total ?? abilities.wis.mod;
  const magicAbilityKey = input.magic.ability;
  const magicAbilityScore = magicAbilityKey ? effectiveScores[magicAbilityKey] : 0;
  const proficiencies = {
    armour: {
      light: Boolean(input.proficiencies?.armour?.light || effects.armourProficiencies?.light),
      medium: Boolean(input.proficiencies?.armour?.medium || effects.armourProficiencies?.medium),
      heavy: Boolean(input.proficiencies?.armour?.heavy || effects.armourProficiencies?.heavy),
    },
    shields: Boolean(input.proficiencies?.shields || effects.shieldProficiency),
    weapons: mergeWeaponProficiencies(input.proficiencies?.weapons, effects.weaponProficiencies),
  };

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
      max: Math.max(1, input.level + (input.poolBonus ?? 0) + (effects.poolMaxBonus ?? 0)),
    },
    magic: {
      mp: {
        max: Math.max(
          0,
          calculateManaMaximum({
            awakened: input.magic.awakened,
            level: input.level,
            abilityScore: magicAbilityScore,
          }) +
            (input.mpBonus ?? 0) +
            (effects.mpMaxBonus ?? 0),
        ),
      },
    },
    armourClass: calculateArmourClass({
      dexterityModifier: abilities.dex.mod,
      armour: input.armour ?? [],
      manualBonus: input.manualArmourBonus ?? 0,
      effectBonus: effects.acBonus ?? 0,
    }),
    initiative: abilities.dex.mod + (input.initiativeBonus ?? 0) + (effects.initiativeBonus ?? 0),
    speed: Math.max(0, resolveSpeed(input) + (effects.speedBonus ?? 0)),
    totalWeight: calculateTotalWeight(input.equipment),
    proficiencies,
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
  effectBonus = 0,
}: {
  dexterityModifier: number;
  armour: ArmourSource[];
  manualBonus?: number;
  effectBonus?: number;
}): ArmourClassDerived {
  const equipped = armour.filter((item) => item.equipped);
  const keyed = equipped.filter((item) => item.stackKey);
  const open = equipped.filter((item) => !item.stackKey);
  const bestBody = bestWornSuit(open, dexterityModifier);
  const bestNatural = highestBonus(open.filter((item) => item.category === "natural"));
  const dexBonus = dexterityModifierForArmour(dexterityModifier, bestBody?.category);
  const wornTotal = 10 + dexBonus + (bestBody?.acBonus ?? 0);
  const lines: Array<{ text: string; amount: number; worn?: string }> = [];

  if (bestNatural && bestNatural.acBonus > wornTotal) {
    lines.push({
      text: `${bestNatural.name} ${bestNatural.acBonus}`,
      amount: bestNatural.acBonus,
      worn: bestNatural.name,
    });
  } else {
    lines.push({ text: "Base 10", amount: 10 });
    if (dexBonus !== 0) lines.push({ text: formatSigned("Dex", dexBonus), amount: dexBonus });
    if (bestBody && bestBody.acBonus !== 0) {
      lines.push({
        text: formatSigned(bestBody.name, bestBody.acBonus),
        amount: bestBody.acBonus,
        worn: bestBody.name,
      });
    }
  }

  const bestShield = highestBonus(open.filter((item) => item.category === "shield"));
  const bestHelmet = highestBonus(open.filter((item) => item.category === "helmet"));
  pushBonus(lines, bestShield);
  pushBonus(lines, bestHelmet);
  for (const item of open.filter((entry) => entry.category === "other")) pushBonus(lines, item);
  for (const winner of exclusionWinners(keyed)) pushBonus(lines, winner);

  if (manualBonus !== 0)
    lines.push({ text: formatSigned("Manual", manualBonus), amount: manualBonus });
  if (effectBonus !== 0)
    lines.push({ text: formatSigned("Effects", effectBonus), amount: effectBonus });

  return {
    value: lines.reduce((total, line) => total + line.amount, 0),
    armourWorn: lines.flatMap((line) => (line.worn ? [line.worn] : [])).join(", "),
    breakdown: lines.map((line) => line.text),
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

function mergeWeaponProficiencies(
  source: WeaponProficiencyMap | undefined,
  granted: WeaponProficiencyMap | undefined,
): WeaponProficiencyMap {
  const merged: WeaponProficiencyMap = { ...source };
  for (const [category, value] of Object.entries(granted ?? {})) {
    if (value) merged[category] = true;
  }
  return merged;
}

function resolveSpeed(input: CharacterDerivedInput): number {
  const bonus = input.speed?.bonus ?? 0;
  const stored = input.speed?.value;
  const species = input.species?.trim() ?? "";
  const speciesBase = species ? baseSpeedForSpecies(species) : null;
  if (species && speciesBase === null) {
    console.info(unknownSpeciesSpeedMessage(species));
  }
  const base =
    speciesBase === null
      ? (stored ?? 0)
      : stored === undefined || stored === 10
        ? speciesBase
        : stored;
  return base + bonus;
}

function clampAbilityScore(score: number): number {
  return Math.min(30, Math.max(1, score));
}

function bestWornSuit(items: ArmourSource[], dexterityModifier: number): ArmourSource | undefined {
  let best: ArmourSource | undefined;
  let bestFinished = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    if (item.category !== "light" && item.category !== "medium" && item.category !== "heavy") {
      continue;
    }
    const finished = item.acBonus + dexterityModifierForArmour(dexterityModifier, item.category);
    if (!best || finished > bestFinished) {
      best = item;
      bestFinished = finished;
    }
  }
  return best;
}

function highestBonus(items: ArmourSource[]): ArmourSource | undefined {
  if (items.length === 0) return undefined;
  const best = stackIdenticalBonuses(
    bonusStackMode.ac,
    items.map((item) => item.acBonus),
  );
  return items.find((item) => item.acBonus === best);
}

function exclusionWinners(items: ArmourSource[]): ArmourSource[] {
  const groups = new Map<string, ArmourSource[]>();
  for (const item of items) {
    const id = exclusionGroupId(item.stackKey ?? item.name);
    const group = groups.get(id) ?? [];
    group.push(item);
    groups.set(id, group);
  }
  return [...groups.values()].flatMap((group) => {
    const best = stackIdenticalBonuses(
      bonusStackMode.ac,
      group.map((item) => item.acBonus),
    );
    const winner = group.find((item) => item.acBonus === best);
    return winner ? [winner] : [];
  });
}

function pushBonus(
  lines: Array<{ text: string; amount: number; worn?: string }>,
  item: ArmourSource | undefined,
): void {
  if (!item || item.acBonus === 0) return;
  lines.push({
    text: formatSigned(item.name, item.acBonus),
    amount: item.acBonus,
    worn: item.name,
  });
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
