import type { AbilityKey } from "./rules/character-derived";

export const SYSTEM_ID = "pivot-fantasy";

export const abilities: Array<{ key: AbilityKey; label: string; short: string }> = [
  { key: "str", label: "Strength", short: "STR" },
  { key: "dex", label: "Dexterity", short: "DEX" },
  { key: "con", label: "Constitution", short: "CON" },
  { key: "int", label: "Intelligence", short: "INT" },
  { key: "wis", label: "Wisdom", short: "WIS" },
  { key: "cha", label: "Charisma", short: "CHA" },
];

export const canonicalSkills: Array<{
  id: string;
  label: string;
  ability: AbilityKey | "varies";
}> = [
  { id: "acrobatics", label: "Acrobatics", ability: "dex" },
  { id: "alchemy", label: "Alchemy", ability: "int" },
  { id: "animalHandling", label: "Animal Handling", ability: "wis" },
  { id: "athletics", label: "Athletics", ability: "str" },
  { id: "controlMagic", label: "Control Magic", ability: "varies" },
  { id: "deception", label: "Deception", ability: "cha" },
  { id: "insight", label: "Insight", ability: "wis" },
  { id: "intimidation", label: "Intimidation", ability: "cha" },
  { id: "investigation", label: "Investigation", ability: "int" },
  { id: "medicine", label: "Medicine", ability: "int" },
  { id: "medicineHolistic", label: "Medicine: Holistic", ability: "wis" },
  { id: "nature", label: "Nature", ability: "int" },
  { id: "navigation", label: "Navigation", ability: "int" },
  { id: "perception", label: "Perception", ability: "wis" },
  { id: "performance", label: "Performance", ability: "cha" },
  { id: "persuasion", label: "Persuasion", ability: "cha" },
  { id: "religion", label: "Religion", ability: "wis" },
  { id: "sleightOfHand", label: "Sleight of Hand", ability: "dex" },
  { id: "stealth", label: "Stealth", ability: "dex" },
  { id: "survival", label: "Survival", ability: "wis" },
  { id: "thievery", label: "Thievery", ability: "dex" },
];

export const itemTypes = [
  "weapon",
  "armour",
  "equipment",
  "feature",
  "magicStream",
  "magicAbility",
] as const;

export const featureCategories = [
  "feat",
  "flaw",
  "background",
  "species",
  "bodyModification",
  "other",
];

export const weaponCategories = [
  "meleeLight",
  "meleeMedium",
  "meleeHeavy",
  "meleeTwoHandedHeavy",
  "bows",
  "crossbows",
  "thrown",
  "improvised",
] as const;

export const armourCategories = ["light", "medium", "heavy", "shield", "helmet", "other"] as const;

export const hitDice = ["d4", "d6", "d8", "d10", "d12"] as const;
