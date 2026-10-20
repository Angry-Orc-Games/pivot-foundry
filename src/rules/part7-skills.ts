import { canonicalSkills } from "../config";
import type { AbilityKey } from "./character-derived";

const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const academiaDisciplines = [
  "Arcane",
  "Commerce",
  "Dungeoneering",
  "Engineering",
  "Geography",
  "Geology",
  "History",
  "Languages",
  "Local",
  "Nobility and Royalty",
  "Realms",
  "Religion",
] as const;

export const craftingSpecializations: Record<string, AbilityKey> = {
  Armourer: "str",
  Bowyer: "dex",
  Cooking: "wis",
  "Fine Arts": "dex",
  Fletching: "dex",
  Leatherworking: "dex",
  Metalworking: "str",
  Prose: "int",
  "Rune Etching": "int",
  Stoneworking: "str",
  Tattooing: "dex",
  "Textile Craft": "dex",
  Tinkering: "dex",
  Woodworking: "str",
};

export function craftingAbility(name: string): AbilityKey | null {
  return craftingSpecializations[name] ?? null;
}

export function part7SkillCatalog(): Record<string, unknown> {
  const base = new Map(canonicalSkills.map((skill) => [skill.label, skill.ability]));
  const labelFor = (name: string): string => {
    const ability = base.get(name);
    if (ability === "varies") {
      return "Magic Ability Score (Intelligence, Wisdom, or Charisma)";
    }
    return ability ? ABILITY_LABEL[ability] : "";
  };
  const disciplines = Object.fromEntries(academiaDisciplines.map((name) => [name, "Intelligence"]));
  const specialisations = Object.fromEntries(
    Object.entries(craftingSpecializations).map(([name, ability]) => [
      name,
      ABILITY_LABEL[ability],
    ]),
  );

  return {
    Academia: { ability: "Intelligence", disciplines },
    Acrobatics: labelFor("Acrobatics"),
    Alchemy: labelFor("Alchemy"),
    "Animal Handling": labelFor("Animal Handling"),
    Athletics: labelFor("Athletics"),
    "Control Magic": labelFor("Control Magic"),
    Crafting: { ability: "Varies by specialisation", specialisations },
    Deception: labelFor("Deception"),
    Insight: labelFor("Insight"),
    Intimidation: labelFor("Intimidation"),
    Investigation: labelFor("Investigation"),
    Medicine: labelFor("Medicine"),
    "Medicine: Holistic": labelFor("Medicine: Holistic"),
    Nature: labelFor("Nature"),
    Navigation: labelFor("Navigation"),
    Perception: labelFor("Perception"),
    Performance: labelFor("Performance"),
    Persuasion: labelFor("Persuasion"),
    Religion: labelFor("Religion"),
    "Sleight of Hand": labelFor("Sleight of Hand"),
    Stealth: labelFor("Stealth"),
    Survival: labelFor("Survival"),
    Thievery: labelFor("Thievery"),
  };
}
