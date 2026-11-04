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

type CountedEffect = EffectRule | { source: "gear"; effect: EffectRule };

const gearItemTypes = new Set(["weapon", "armour", "equipment"]);
const sameKeyWarned = new WeakSet<object>();

export interface AbilityScoreSource {
  ability: AbilityKey;
  name: string;
  amount: number;
}

export function aggregateCharacterEffects(
  effects: readonly CountedEffect[],
): CharacterEffectSummary {
  const summary = emptyCharacterEffectSummary();
  const gearGroups = new Map<string, EffectRule[]>();

  for (const counted of effects) {
    const fromGear = isGearCounted(counted);
    const effect = fromGear ? counted.effect : counted;
    const key = numericEffectKey(effect);
    if (key === null) {
      applyProficiency(summary, effect);
      continue;
    }
    if (fromGear) {
      const group = gearGroups.get(key) ?? [];
      group.push(effect);
      gearGroups.set(key, group);
      continue;
    }
    addNumericEffect(summary, effect);
  }

  for (const group of gearGroups.values()) {
    const combined = combineGear(group, numericAmount);
    if (!combined.sample || !hasAmount(combined.sample)) continue;
    addNumericEffect(summary, {
      ...combined.sample,
      amount: combined.total,
    });
  }
  return summary;
}

// Best bonus plus every penalty. https://github.com/Angry-Orc-Games/pivot-foundry/pull/109#issuecomment-6640416282
// Change the next line to the worst penalty only if Ken rules that way.
function gearStatTotal(bestBonus: number, penalties: readonly number[]): number {
  const penaltyTotal = penalties.reduce((sum, amount) => sum + amount, 0);
  return bestBonus + penaltyTotal;
}

function hasAmount(effect: EffectRule): effect is Extract<EffectRule, { amount: number }> {
  return "amount" in effect;
}

export function collectEmbeddedItemEffects(
  items: readonly { type?: unknown; system?: unknown }[],
): CountedEffect[] {
  const effects: CountedEffect[] = [];
  for (const item of items) {
    const counted = countedItemEffects(item);
    if (!counted) continue;
    for (const effect of counted.effects) {
      effects.push(counted.gear ? { source: "gear", effect } : effect);
    }
  }
  return effects;
}

export function abilityScoreSources(
  items: readonly { name?: unknown; type?: unknown; system?: unknown }[],
): AbilityScoreSource[] {
  const tagged: Array<AbilityScoreSource & { gear: boolean }> = [];
  for (const item of items) {
    const counted = countedItemEffects(item);
    if (!counted) continue;
    const name = typeof item.name === "string" && item.name ? item.name : "Item";
    for (const effect of counted.effects) {
      if (effect.type !== "abilityScoreBonus") continue;
      tagged.push({ ability: effect.ability, name, amount: effect.amount, gear: counted.gear });
    }
  }

  const gearByAbility = new Map<AbilityKey, Array<AbilityScoreSource & { gear: boolean }>>();
  for (const source of tagged) {
    if (!source.gear) continue;
    const group = gearByAbility.get(source.ability) ?? [];
    group.push(source);
    gearByAbility.set(source.ability, group);
  }

  const kept = new Set<AbilityScoreSource>();
  for (const group of gearByAbility.values()) {
    for (const source of combineGear(group, (source) => source.amount).sources) kept.add(source);
  }

  return tagged
    .filter((source) => !source.gear || kept.has(source))
    .map(({ ability, name, amount }) => ({ ability, name, amount }));
}

function countedItemEffects(
  item: { name?: unknown; type?: unknown; system?: unknown } | null | undefined,
):
  | { gear: boolean; effects: EffectRule[] }
  | undefined {
  if (!item || typeof item !== "object") return undefined;
  const system = item.system;
  if (!isPlainObject(system) || !Array.isArray(system.effects)) return undefined;
  const gear = typeof item.type === "string" && gearItemTypes.has(item.type);
  const effects: EffectRule[] = [];
  for (const entry of system.effects) {
    const parsed = parseStoredEffect(entry);
    if (parsed) effects.push(parsed);
  }
  if (effects.length === 0) return undefined;
  const collapsed = collapseSameKeyEffects(item, effects, itemLabel(item));
  if (gear && system.equipped !== true) return undefined;
  return { gear, effects: collapsed };
}

function itemLabel(item: { name?: unknown }): string {
  return typeof item.name === "string" && item.name ? item.name : "Item";
}

function collapseSameKeyEffects(
  item: object,
  effects: readonly EffectRule[],
  itemName: string,
): EffectRule[] {
  const groups = new Map<string, EffectRule[]>();
  const order: string[] = [];
  const rest: EffectRule[] = [];
  let duplicated = false;
  for (const effect of effects) {
    const key = numericEffectKey(effect);
    if (key === null) {
      rest.push(effect);
      continue;
    }
    const group = groups.get(key);
    if (!group) {
      groups.set(key, [effect]);
      order.push(key);
      continue;
    }
    group.push(effect);
    duplicated = true;
  }
  if (duplicated && !sameKeyWarned.has(item)) {
    sameKeyWarned.add(item);
    console.warn(
      `Pivot Fantasy: ${itemName} lists more than one effect for the same stat. Only the best bonus and every penalty count.`,
    );
  }
  const collapsed = [...rest];
  for (const key of order) {
    const group = groups.get(key) ?? [];
    collapsed.push(...(group.length < 2 ? group : combineGear(group, numericAmount).sources));
  }
  return collapsed;
}

function pickGear<T>(
  entries: readonly T[],
  amountOf: (entry: T) => number,
): { best?: T; penalties: T[] } {
  let best: T | undefined;
  let bestAmount = 0;
  const penalties: T[] = [];
  for (const entry of entries) {
    const amount = amountOf(entry);
    if (amount < 0) penalties.push(entry);
    else if (amount > bestAmount) {
      best = entry;
      bestAmount = amount;
    }
  }
  return { best: bestAmount > 0 ? best : undefined, penalties };
}

function combineGear<T>(
  entries: readonly T[],
  amountOf: (entry: T) => number,
): { total: number; sources: T[]; sample?: T } {
  const picked = pickGear(entries, amountOf);
  const bestBonus = picked.best ? amountOf(picked.best) : 0;
  const penalties = picked.penalties.map(amountOf);
  const sources = entries.filter(
    (entry) => entry === picked.best || picked.penalties.includes(entry),
  );
  return {
    total: gearStatTotal(bestBonus, penalties),
    sources,
    sample: picked.best ?? picked.penalties[0] ?? entries[0],
  };
}

function isGearCounted(value: CountedEffect): value is { source: "gear"; effect: EffectRule } {
  return "source" in value && value.source === "gear";
}

function numericEffectKey(effect: EffectRule): string | null {
  switch (effect.type) {
    case "abilityScoreBonus":
      return `abilityScoreBonus:${effect.ability}`;
    case "skillBonus":
      return `skillBonus:${effect.skill}`;
    case "acBonus":
    case "initiativeBonus":
    case "speedBonus":
    case "poolMaxBonus":
    case "mpMaxBonus":
      return effect.type;
    case "armourProficiency":
    case "weaponProficiency":
      return null;
  }
}

function numericAmount(effect: EffectRule): number {
  switch (effect.type) {
    case "abilityScoreBonus":
    case "skillBonus":
    case "acBonus":
    case "initiativeBonus":
    case "speedBonus":
    case "poolMaxBonus":
    case "mpMaxBonus":
      return effect.amount;
    case "armourProficiency":
    case "weaponProficiency":
      return 0;
  }
}

function addNumericEffect(summary: CharacterEffectSummary, effect: EffectRule): void {
  switch (effect.type) {
    case "abilityScoreBonus":
      summary.abilityScoreBonuses[effect.ability] += effect.amount;
      break;
    case "skillBonus":
      summary.skillBonuses[effect.skill] =
        (summary.skillBonuses[effect.skill] ?? 0) + effect.amount;
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
    case "armourProficiency":
    case "weaponProficiency":
      break;
  }
}

function applyProficiency(summary: CharacterEffectSummary, effect: EffectRule): void {
  switch (effect.type) {
    case "armourProficiency":
      if (effect.category === "shield") summary.shieldProficiency = true;
      else summary.armourProficiencies[effect.category] = true;
      break;
    case "weaponProficiency":
      summary.weaponProficiencies[effect.category] = true;
      break;
    case "abilityScoreBonus":
    case "skillBonus":
    case "acBonus":
    case "initiativeBonus":
    case "speedBonus":
    case "poolMaxBonus":
    case "mpMaxBonus":
      break;
  }
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
