import { canonicalSkills } from "../config";
import { calculateManaMaximum } from "../rules/character-derived";
import { CURRENT_SCHEMA_VERSION } from "../rules/schema-version";

const pivotCharacterBrand = Symbol("pivot-character");

export type PivotCharacter = { readonly [pivotCharacterBrand]: true };

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type PivotImportCode =
  "malformed" | "wrong-system" | "unknown-format" | "schema" | "forbidden" | "incomplete";

export type ImportWarningCode = "tampered" | "unverifiable";

export interface PivotImportError {
  readonly code: PivotImportCode;
  readonly message: string;
  readonly field?: string;
}

export interface ImportWarning {
  readonly code: ImportWarningCode;
  readonly message: string;
  readonly field?: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T; readonly warnings?: readonly ImportWarning[] }
  | { readonly ok: false; readonly error: PivotImportError };

export const IMPORT_MESSAGES = {
  malformed: "This file is not a Pivot character JSON object.",
  wrongSystem: "This file is not a Pivot character.",
  unknownFormat:
    "This file is not a format 2 Pivot character. Export it again from the character generator.",
  v1: "This file is a version 1 generator save. Export a format 2 file from the character generator.",
  forbidden: "Only a GM can import a character.",
  choosePlayer: "Choose a player.",
  incomplete: "Import did not finish, so no character was kept.",
  cleanupFailed: "Import did not finish, and the character could not be removed.",
  unknownPlayer: "Choose a player in this world.",
  notChecked: "Not checked against the character generator.",
} as const;

export function schemaMessage(field: string): string {
  return `This file has a problem at ${field}.`;
}

export interface SkillDraft {
  readonly ability: AbilityKey;
  readonly proficient: boolean;
  readonly deepening: 0;
  readonly expertise: boolean;
  readonly bonus: number;
}

export interface SpecializationDraft {
  readonly name: string;
  readonly ability: AbilityKey;
  readonly proficient: boolean;
  readonly deepening: 0;
  readonly expertise: boolean;
  readonly bonus: number;
}

export interface CharacterIdentityDraft {
  readonly concept: string;
  readonly focus: string;
  readonly backgroundTier: 0;
  readonly backgroundText: string;
  readonly speciesText: string;
  readonly languages: readonly string[];
  readonly loyalty: string;
}

export interface WeaponProficiencyDraft {
  readonly meleeLight: boolean;
  readonly meleeMedium: boolean;
  readonly meleeHeavy: boolean;
  readonly meleeTwoHandedHeavy: boolean;
  readonly bows: boolean;
  readonly crossbows: boolean;
  readonly thrown: boolean;
  readonly improvised: boolean;
  readonly slings: boolean;
}

export interface CharacterSystemDraft {
  readonly survivalVersion: 1;
  readonly schemaVersion: number;
  readonly identity: CharacterIdentityDraft;
  readonly progression: {
    readonly level: 1;
    readonly xp: 0;
    readonly buildPoints: number;
    readonly progressionPoints: 0;
  };
  readonly abilities: Readonly<
    Record<AbilityKey, { readonly score: number; readonly primary: boolean }>
  >;
  readonly attributes: {
    readonly hp: { readonly temp: 0; readonly value: number; readonly max: number };
    readonly hitDie: "d4" | "d6" | "d8" | "d10" | "d12";
    readonly speed: { readonly value: number; readonly bonus: 0 };
    readonly ac: { readonly bonus: number };
    readonly initiative: { readonly bonus: 0 };
    readonly passivePerception: { readonly mode: "normal" };
    readonly deathSaves: {
      readonly status: "alive" | "dying";
      readonly successes: 0;
      readonly failures: 0;
    };
  };
  readonly resources: { readonly pool: { readonly value: number; readonly maxBonus: number } };
  readonly skills: Readonly<Record<string, SkillDraft>>;
  readonly skillSpecializations: {
    readonly academia: readonly SpecializationDraft[];
    readonly crafting: readonly SpecializationDraft[];
  };
  readonly proficiencies: {
    readonly armour: { readonly light: boolean; readonly medium: boolean; readonly heavy: boolean };
    readonly shields: boolean;
    readonly instruments: readonly [];
    readonly weapons: WeaponProficiencyDraft;
  };
  readonly currency: {
    readonly gp: number;
    readonly sp: 0;
    readonly cp: 0;
    readonly other: string;
  };
  readonly magic: {
    readonly awakened: boolean;
    readonly ability: AbilityKey | null;
    readonly mp: { readonly value: number; readonly maxBonus: number };
  };
  readonly notes: { readonly runesThaumaturgy: ""; readonly special: string };
}

export interface CharacterImportDraft {
  readonly actor: {
    readonly name: string;
    readonly type: "character";
    readonly system: CharacterSystemDraft;
    readonly flags: {
      readonly "pivot-chargen": {
        readonly source: Readonly<Record<string, unknown>>;
      };
    };
  };
  readonly items: readonly ImportItem[];
}

export type ImportItem =
  | { readonly type: "weapon"; readonly name: string; readonly system: WeaponSystemDraft }
  | { readonly type: "armour"; readonly name: string; readonly system: ArmourSystemDraft }
  | { readonly type: "equipment"; readonly name: string; readonly system: EquipmentSystemDraft }
  | { readonly type: "feature"; readonly name: string; readonly system: FeatureSystemDraft }
  | {
      readonly type: "magicStream";
      readonly name: string;
      readonly system: MagicStreamSystemDraft;
    };

export interface WeaponSystemDraft {
  readonly schemaVersion: number;
  readonly effects: readonly [];
  readonly category: string;
  readonly attack: { readonly ability: AbilityKey; readonly bonus: number };
  readonly damage: {
    readonly formula: string;
    readonly type: string;
    readonly ability: AbilityKey | null;
    readonly bonus: number;
  };
  readonly range: { readonly normal: number; readonly long: number };
  readonly weight: number;
  readonly quantity: number;
  readonly carried: boolean;
  readonly notes: string;
}

export interface ArmourSystemDraft {
  readonly schemaVersion: number;
  readonly effects: readonly [];
  readonly category: "light" | "medium" | "heavy";
  readonly acBonus: number;
  readonly equipped: boolean;
  readonly weight: number;
  readonly quantity: number;
  readonly carried: boolean;
  readonly notes: string;
}

export interface EquipmentSystemDraft {
  readonly schemaVersion: number;
  readonly effects: readonly [];
  readonly quantity: number;
  readonly weight: number;
  readonly carried: boolean;
  readonly equipped: boolean;
  readonly notes: string;
  readonly category?: string;
}

export interface FeatureSystemDraft {
  readonly schemaVersion: number;
  readonly effects: readonly [];
  readonly category: string;
  readonly source: string;
  readonly cost: { readonly pool: number; readonly mp: number; readonly bp: number };
  readonly uses: { readonly value: number; readonly max: number };
  readonly notes: string;
}

export interface MagicStreamSystemDraft {
  readonly schemaVersion: number;
  readonly effects: readonly [];
  readonly ability: AbilityKey;
  readonly echelon: number;
  readonly notes: string;
  readonly category?: string;
}

export interface PreparedSnapshot {
  readonly ac: number;
  readonly poolMax: number;
  readonly mpMax: number;
  readonly speed: number;
}

export interface DriftLine {
  readonly field: "ac" | "pool" | "mp" | "speed";
  readonly file: number;
  readonly sheet: number;
}

export interface ValidateOptions {
  rederive?: (choices: unknown) => unknown;
}

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

const SPECIES_LABEL: Record<ChoiceFile["species"], string> = {
  "": "",
  human: "Human",
  dwarf: "Dwarf",
  elf: "Elf",
  halfling: "Halfling",
  gnome: "Gnome",
  custom: "Custom Humanoid",
};

const ATTACK_CATEGORY_TO_KEY = {
  "Light Melee": "meleeLight",
  "Medium Melee": "meleeMedium",
  "Heavy Melee": "meleeHeavy",
  "Two-Handed Heavy Melee": "meleeTwoHandedHeavy",
  Improvised: "improvised",
  Bows: "bows",
  Crossbows: "crossbows",
  Thrown: "thrown",
  Slings: "slings",
} as const;

type AttackCategory = keyof typeof ATTACK_CATEGORY_TO_KEY;
type WeaponKey = (typeof ATTACK_CATEGORY_TO_KEY)[AttackCategory];

// The file total already includes this level-1 proficiency term. The sheet adds it again.
const LEVEL_ONE_PROFICIENCY = 2;

const ACADEMIA_PREFIX = "Academia: ";
const CRAFTING_PREFIX = "Crafting: ";

type Check = (value: unknown, path: string) => string | null;

export function validate(file: unknown, options?: ValidateOptions): Result<PivotCharacter> {
  const early = earlyError(file);
  if (early) return { ok: false, error: early };

  const problem = fileShape(file, "");
  if (problem) {
    return {
      ok: false,
      error: { code: "schema", field: problem, message: schemaMessage(problem) },
    };
  }

  const copy = structuredClone(file) as Record<string, unknown>;
  const warnings = witnessWarnings(copy.computed, options?.rederive, copy.choices);

  Object.defineProperty(copy, pivotCharacterBrand, { value: true });
  return { ok: true, value: copy as PivotCharacter, warnings };
}

const MISMATCH_KEY = "PIVOT.Import.Mismatch";
const NOT_CHECKED_KEY = "PIVOT.Import.NotChecked";
const FIELD_LABELS: Record<string, { key: string; fallback: string }> = {
  ac: { key: "PIVOT.Import.Field.AC", fallback: "AC" },
  hp: { key: "PIVOT.Import.Field.HP", fallback: "HP" },
  pool: { key: "PIVOT.Import.Field.Pool", fallback: "Pool" },
  mp: { key: "PIVOT.Import.Field.MP", fallback: "MP max" },
  speed: { key: "PIVOT.Import.Field.Speed", fallback: "Speed" },
  hitDie: { key: "PIVOT.Import.Field.HitDie", fallback: "Hit die" },
  acArmour: { key: "PIVOT.Import.Field.Armour", fallback: "Armour" },
  armourProf: { key: "PIVOT.Import.Field.ArmourProficiency", fallback: "Armour proficiency" },
  shieldProf: { key: "PIVOT.Import.Field.ShieldProficiency", fallback: "Shield proficiency" },
  languages: { key: "PIVOT.Import.Field.Languages", fallback: "Languages" },
  attack: { key: "PIVOT.Import.Field.Attack", fallback: "attack" },
  total: { key: "PIVOT.Import.Field.Total", fallback: "total" },
  proficient: { key: "PIVOT.Import.Field.Proficient", fallback: "proficient" },
  expertise: { key: "PIVOT.Import.Field.Expertise", fallback: "expertise" },
  ability: { key: "PIVOT.Import.Field.Ability", fallback: "ability" },
  die: { key: "PIVOT.Import.Field.Die", fallback: "die" },
  melee: { key: "PIVOT.Import.Field.Melee", fallback: "melee" },
  score: { key: "PIVOT.Import.Field.Score", fallback: "score" },
  mod: { key: "PIVOT.Import.Field.Modifier", fallback: "modifier" },
  primary: { key: "PIVOT.Import.Field.Primary", fallback: "primary" },
  income: { key: "PIVOT.Import.Field.Income", fallback: "income" },
  spent: { key: "PIVOT.Import.Field.Spent", fallback: "spent" },
  remaining: { key: "PIVOT.Import.Field.Remaining", fallback: "remaining" },
};
const ABILITY_LABELS: Record<string, { key: string; fallback: string }> = {
  str: { key: "PIVOT.Import.Ability.Strength", fallback: "Strength" },
  dex: { key: "PIVOT.Import.Ability.Dexterity", fallback: "Dexterity" },
  con: { key: "PIVOT.Import.Ability.Constitution", fallback: "Constitution" },
  int: { key: "PIVOT.Import.Ability.Intelligence", fallback: "Intelligence" },
  wis: { key: "PIVOT.Import.Ability.Wisdom", fallback: "Wisdom" },
  cha: { key: "PIVOT.Import.Ability.Charisma", fallback: "Charisma" },
};
const FIELD_ORDER = ["ac", "hp", "pool", "mp", "speed"];
const SKILL_PROPS = ["ability", "proficient", "expertise", "total"] as const;
const ABILITY_PROPS = ["score", "mod", "primary"] as const;
const ATTACK_PROPS = ["proficient", "attack", "ability", "die", "melee"] as const;
const BUILD_POINT_PROPS = ["income", "spent", "remaining"] as const;

export function mismatchWarning(
  field: string,
  file: unknown,
  rules: unknown,
  label = fieldLabel(field),
): ImportWarning {
  return {
    code: "tampered",
    field,
    message: formatMessage(MISMATCH_KEY, "{field}: file {file}, rules {rules}", {
      field: label,
      file: formatWitnessValue(file),
      rules: formatWitnessValue(rules),
    }),
  };
}

export function notCheckedWarning(): ImportWarning {
  return {
    code: "unverifiable",
    message: formatMessage(NOT_CHECKED_KEY, IMPORT_MESSAGES.notChecked),
  };
}

function witnessWarnings(
  computed: unknown,
  rederive: ValidateOptions["rederive"],
  choices: unknown,
): ImportWarning[] {
  if (!rederive) return [];
  let derived: unknown;
  try {
    derived = rederive(structuredClone(choices));
  } catch {
    return [notCheckedWarning()];
  }
  return computedDiff(computed, derived);
}

function computedDiff(file: unknown, derived: unknown): ImportWarning[] {
  if (!isPlainObject(file) || !isPlainObject(derived)) {
    return [mismatchWarning("computed", file, derived)];
  }
  const keys = new Set([...Object.keys(file), ...Object.keys(derived)]);
  return [...keys]
    .filter((key) => key !== "exportedAt")
    .sort((left, right) => fieldRank(left) - fieldRank(right) || left.localeCompare(right))
    .flatMap((key) => diffField(key, file[key], derived[key]));
}

function diffField(field: string, file: unknown, rules: unknown): ImportWarning[] {
  if (sameCanonical(file, rules)) return [];
  if (field === "skills") return diffRows(field, file, rules, SKILL_PROPS, skillLabel);
  if (field === "abilities") return diffRows(field, file, rules, ABILITY_PROPS, abilityLabel);
  if (field === "attacks") return diffAttacks(file, rules);
  if (field === "buildPoints") return diffProps(field, file, rules, BUILD_POINT_PROPS);
  if (field === "languages") return [mismatchWarning(field, textList(file), textList(rules))];
  return [mismatchWarning(field, file, rules)];
}

function diffRows(
  field: string,
  file: unknown,
  rules: unknown,
  props: readonly string[],
  labelFor: (name: string, prop: string) => string,
): ImportWarning[] {
  if (!isPlainObject(file) || !isPlainObject(rules)) return [mismatchWarning(field, file, rules)];
  const names = [...new Set([...Object.keys(file), ...Object.keys(rules)])].sort((left, right) =>
    left.localeCompare(right),
  );
  const warnings: ImportWarning[] = [];
  for (const name of names) {
    const left = file[name];
    const right = rules[name];
    if (!isPlainObject(left) || !isPlainObject(right)) {
      warnings.push(
        mismatchWarning(`${field}.${name}`, left ?? "missing", right ?? "missing", name),
      );
      continue;
    }
    for (const prop of props) {
      if (sameCanonical(left[prop], right[prop])) continue;
      warnings.push(
        mismatchWarning(`${field}.${name}.${prop}`, left[prop], right[prop], labelFor(name, prop)),
      );
    }
  }
  return warnings;
}

function diffProps(
  field: string,
  file: unknown,
  rules: unknown,
  props: readonly string[],
): ImportWarning[] {
  if (!isPlainObject(file) || !isPlainObject(rules)) return [mismatchWarning(field, file, rules)];
  return props.flatMap((prop) =>
    sameCanonical(file[prop], rules[prop])
      ? []
      : [mismatchWarning(`${field}.${prop}`, file[prop], rules[prop], fieldLabel(prop))],
  );
}

function diffAttacks(file: unknown, rules: unknown): ImportWarning[] {
  const left = attackRows(file);
  const right = attackRows(rules);
  if (!left || !right) return [mismatchWarning("attacks", file, rules)];
  const names = [
    ...new Set([...left.map((row) => row.category), ...right.map((row) => row.category)]),
  ].sort((one, other) => one.localeCompare(other));
  const warnings: ImportWarning[] = [];
  for (const name of names) {
    const fileRow = left.find((row) => row.category === name);
    const rulesRow = right.find((row) => row.category === name);
    if (!fileRow || !rulesRow) {
      warnings.push(
        mismatchWarning(`attacks.${name}`, fileRow ?? "missing", rulesRow ?? "missing", name),
      );
      continue;
    }
    for (const prop of ATTACK_PROPS) {
      if (sameCanonical(fileRow[prop], rulesRow[prop])) continue;
      warnings.push(
        mismatchWarning(
          `attacks.${name}.${prop}`,
          fileRow[prop],
          rulesRow[prop],
          `${name} ${fieldLabel(prop)}`,
        ),
      );
    }
  }
  return warnings;
}

function attackRows(
  value: unknown,
): Array<Record<string, unknown> & { category: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: Array<Record<string, unknown> & { category: string }> = [];
  for (const item of value) {
    if (!isPlainObject(item) || typeof item.category !== "string") return undefined;
    rows.push({ ...item, category: item.category });
  }
  return rows;
}

function skillLabel(name: string, prop: string): string {
  return `${name} ${fieldLabel(prop)}`;
}

function abilityLabel(name: string, prop: string): string {
  return `${abilityName(name)} ${fieldLabel(prop)}`;
}

function abilityName(name: string): string {
  const known = ABILITY_LABELS[name];
  if (!known) return name;
  return formatMessage(known.key, known.fallback);
}

function textList(value: unknown): string {
  if (!Array.isArray(value)) return formatWitnessValue(value);
  return value.map((item) => formatWitnessValue(item)).join(", ");
}

function fieldRank(field: string): number {
  const index = FIELD_ORDER.indexOf(field);
  return index === -1 ? FIELD_ORDER.length : index;
}

function fieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (!known) return field;
  return formatMessage(known.key, known.fallback);
}

function formatWitnessValue(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (value === undefined) return "missing";
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) return value.join(", ");
    return `${value.length} values`;
  }
  if (isPlainObject(value)) return Object.keys(value).sort().join(", ");
  return "";
}

function formatMessage(key: string, fallback: string, data?: Record<string, string>): string {
  const i18n = (
    globalThis as {
      game?: {
        i18n?: {
          format?: (key: string, data?: Record<string, string>) => string;
          localize?: (key: string) => string;
        };
      };
    }
  ).game?.i18n;
  if (data && typeof i18n?.format === "function") {
    const formatted = i18n.format(key, data);
    if (formatted && formatted !== key) return formatted;
  }
  if (!data && typeof i18n?.localize === "function") {
    const localized = i18n.localize(key);
    if (localized && localized !== key) return localized;
  }
  if (!data) return fallback;
  return fallback.replace(/\{(\w+)\}/g, (_match, token: string) => data[token] ?? "");
}

export function toActorData(character: PivotCharacter): CharacterImportDraft {
  const file = stored(character);
  const { choices, computed } = file;
  const source = cloneFile(character);

  return {
    actor: {
      name: choices.name,
      type: "character",
      system: {
        survivalVersion: 1,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        identity: {
          concept: choices.concept,
          focus: choices.focus,
          backgroundTier: 0,
          backgroundText: choices.bg,
          speciesText: SPECIES_LABEL[choices.species],
          languages: [...computed.languages],
          loyalty: choices.loyalty,
        },
        progression: {
          level: 1,
          xp: 0,
          buildPoints: computed.buildPoints.remaining,
          progressionPoints: 0,
        },
        abilities: abilityDraft(computed),
        attributes: {
          hp: { temp: 0, value: computed.hp, max: computed.hp },
          hitDie: computed.hitDie,
          speed: { value: computed.speed, bonus: 0 },
          // Unequipped sheet AC is 10 + Dexterity modifier + this bonus.
          ac: { bonus: computed.ac - 10 - computed.abilities.dex.mod },
          initiative: { bonus: 0 },
          passivePerception: { mode: "normal" },
          deathSaves: {
            status: computed.hp > 0 ? "alive" : "dying",
            successes: 0,
            failures: 0,
          },
        },
        resources: {
          pool: {
            value: computed.pool,
            // Sheet pool max is level + this bonus. Level 1 starts at 1, and the file
            // pool already includes flaws such as Chronically Ill.
            maxBonus: computed.pool - 1,
          },
        },
        skills: skillDraft(computed),
        skillSpecializations: specializationDraft(computed),
        proficiencies: {
          armour: armourDraft(computed.armourProf),
          shields: computed.shieldProf,
          instruments: [],
          weapons: weaponDraft(computed.attacks),
        },
        currency: currencyDraft(choices.money),
        magic: {
          awakened: choices.aw,
          ability: choices.magicAb === "" ? null : choices.magicAb,
          mp: manaDraft(choices, computed),
        },
        notes: { runesThaumaturgy: "", special: specialNotes(choices) },
      },
      flags: { "pivot-chargen": { source } },
    },
    items: projectItems(file),
  };
}

export function compareDrift(character: PivotCharacter, prepared: PreparedSnapshot): DriftLine[] {
  const computed = stored(character).computed;
  const fileTotals = {
    ac: computed.ac,
    pool: computed.pool,
    mp: computed.mp ?? 0,
    speed: computed.speed,
  };
  const sheetTotals = {
    ac: prepared.ac,
    pool: prepared.poolMax,
    mp: prepared.mpMax,
    speed: prepared.speed,
  };
  const lines: DriftLine[] = [];
  for (const field of ["ac", "pool", "mp", "speed"] as const) {
    if (fileTotals[field] !== sheetTotals[field]) {
      lines.push({ field, file: fileTotals[field], sheet: sheetTotals[field] });
    }
  }
  return lines;
}

interface ChoiceFile {
  readonly name: string;
  readonly concept: string;
  readonly focus: string;
  readonly species: "" | "human" | "dwarf" | "elf" | "halfling" | "gnome" | "custom";
  readonly cust: { readonly size: "Small" | "Medium" | "Large" };
  readonly bg: string;
  readonly issue: string;
  readonly survFeat: string;
  readonly magicAb: "" | AbilityKey;
  readonly flaws: readonly { readonly n: string }[];
  readonly aw: boolean;
  readonly streams: readonly string[];
  readonly feats: readonly string[];
  readonly freeO: string;
  readonly freeG: string;
  readonly mods?: readonly string[];
  readonly habil: readonly string[];
  readonly roadWeapon: string;
  readonly roadType: string;
  readonly blocks: readonly string[];
  readonly armourBlock: "" | "Light" | "Medium" | "Heavy";
  readonly money: string;
  readonly loyalty: string;
  readonly look: string;
  readonly home: string;
  readonly notes: string;
}

interface SkillFile {
  readonly ability: AbilityKey | null;
  readonly proficient: boolean;
  readonly expertise: boolean;
  readonly total: number;
}

interface ComputedFile {
  readonly abilities: Readonly<
    Record<AbilityKey, { readonly score: number; readonly mod: number; readonly primary: boolean }>
  >;
  readonly hp: number;
  readonly hitDie: CharacterSystemDraft["attributes"]["hitDie"];
  readonly ac: number;
  readonly speed: number;
  readonly pool: number;
  readonly mp: number | null;
  readonly buildPoints: { readonly remaining: number };
  readonly skills: Readonly<Record<string, SkillFile>>;
  readonly acArmour: string;
  readonly attacks: readonly {
    readonly category: AttackCategory;
    readonly proficient: boolean;
    readonly attack: number;
    readonly ability: "str" | "dex";
    readonly die: string;
  }[];
  readonly armourProf: "None" | "Light" | "Medium" | "Heavy";
  readonly shieldProf: boolean;
  readonly languages: readonly string[];
  readonly items?: readonly ComputedItem[];
}

interface ComputedItem {
  readonly type: ImportItem["type"];
  readonly name: string;
  readonly system: Readonly<Record<string, unknown>>;
}

interface StoredCharacter extends PivotCharacter {
  readonly choices: ChoiceFile;
  readonly computed: ComputedFile;
}

function stored(character: PivotCharacter): StoredCharacter {
  return character as StoredCharacter;
}

function cloneFile(character: PivotCharacter): Record<string, unknown> {
  const plain: Record<string, unknown> = {};
  for (const key of Object.keys(character as object)) {
    plain[key] = (character as unknown as Record<string, unknown>)[key];
  }
  return structuredClone(plain);
}

function earlyError(file: unknown): PivotImportError | null {
  if (!isPlainObject(file)) return { code: "malformed", message: IMPORT_MESSAGES.malformed };
  if (Object.hasOwn(file, "system") && file.system !== "pivot") {
    return { code: "wrong-system", message: IMPORT_MESSAGES.wrongSystem };
  }
  if (Object.hasOwn(file, "v") && file.v === 1) {
    return { code: "unknown-format", message: IMPORT_MESSAGES.v1 };
  }
  if (Object.hasOwn(file, "v") || (Object.hasOwn(file, "format") && file.format !== 2)) {
    return { code: "unknown-format", message: IMPORT_MESSAGES.unknownFormat };
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function child(path: string, key: string): string {
  return path.length > 0 ? `${path}.${key}` : key;
}

function objectShape(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  const requiredKeys = Object.keys(required);
  const optionalKeys = Object.keys(optional);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  return (value, path) => {
    if (!isPlainObject(value)) return path;
    for (const key of requiredKeys) {
      const check = required[key];
      if (!Object.hasOwn(value, key)) return child(path, key);
      if (!check) return child(path, key);
      const problem = check(value[key], child(path, key));
      if (problem) return problem;
    }
    for (const key of optionalKeys) {
      if (!Object.hasOwn(value, key)) continue;
      const check = optional[key];
      if (!check) return child(path, key);
      const problem = check(value[key], child(path, key));
      if (problem) return problem;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) return child(path, key);
    }
    return null;
  };
}

function text(minLength = 0): Check {
  return (value, path) => (typeof value === "string" && value.length >= minLength ? null : path);
}

function integer(min?: number, max?: number): Check {
  return (value, path) => {
    if (typeof value !== "number" || !Number.isInteger(value)) return path;
    if (min !== undefined && value < min) return path;
    if (max !== undefined && value > max) return path;
    return null;
  };
}

function booleanValue(): Check {
  return (value, path) => (typeof value === "boolean" ? null : path);
}

function constant(expected: string | number): Check {
  return (value, path) => (value === expected ? null : path);
}

function oneOf(allowed: readonly string[]): Check {
  return (value, path) => (typeof value === "string" && allowed.includes(value) ? null : path);
}

function list(item: Check): Check {
  return (value, path) => {
    if (!Array.isArray(value)) return path;
    for (let index = 0; index < value.length; index += 1) {
      const problem = item(value[index], `${path}.${index}`);
      if (problem) return problem;
    }
    return null;
  };
}

function stringMap(): Check {
  return (value, path) => {
    if (!isPlainObject(value)) return path;
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry !== "string") return child(path, key);
    }
    return null;
  };
}

function blockPickMap(): Check {
  return (value, path) => {
    if (!isPlainObject(value)) return path;
    for (const [key, entry] of Object.entries(value)) {
      const whole = typeof entry === "number" && Number.isInteger(entry);
      if (typeof entry !== "boolean" && !whole) return child(path, key);
    }
    return null;
  };
}

function abilityOrBlank(): Check {
  return (value, path) => {
    if (value === "") return null;
    return oneOf(ABILITY_KEYS)(value, path);
  };
}

function abilityOrNull(): Check {
  return (value, path) => {
    if (value === null) return null;
    return oneOf(ABILITY_KEYS)(value, path);
  };
}

function integerOrNull(): Check {
  const whole = integer();
  return (value, path) => (value === null ? null : whole(value, path));
}

function freeObject(): Check {
  return (value, path) => (isPlainObject(value) ? null : path);
}

const abilityRow = objectShape({
  score: integer(1, 30),
  mod: integer(),
  primary: booleanValue(),
});

const skillRow = objectShape({
  ability: abilityOrNull(),
  proficient: booleanValue(),
  expertise: booleanValue(),
  total: integer(),
});

const canonicalLabels = new Set(canonicalSkills.map((skill) => skill.label));

const skillsShape: Check = (value, path) => {
  if (!isPlainObject(value)) return path;
  for (const [key, entry] of Object.entries(value)) {
    const keyPath = child(path, key);
    const specialization = key.startsWith(ACADEMIA_PREFIX) || key.startsWith(CRAFTING_PREFIX);
    if (!canonicalLabels.has(key) && !specialization) return keyPath;
    const problem = skillRow(entry, keyPath);
    if (problem) return problem;
  }
  for (const skill of canonicalSkills) {
    if (!Object.hasOwn(value, skill.label)) return child(path, skill.label);
  }
  return null;
};

const attackShape = objectShape({
  category: (value, path) =>
    typeof value === "string" && value in ATTACK_CATEGORY_TO_KEY ? null : path,
  proficient: booleanValue(),
  attack: integer(),
  ability: oneOf(["str", "dex"]),
  die: text(),
  melee: booleanValue(),
});

const bgpSlot = objectShape({}, { o: integer(), v: text(), v2: text() });

const bgpShape: Check = (value, path) => {
  if (!isPlainObject(value)) return path;
  for (const [key, entry] of Object.entries(value)) {
    const problem = bgpSlot(entry, child(path, key));
    if (problem) return problem;
  }
  return null;
};

const computedItemShape = objectShape({
  type: oneOf(["weapon", "armour", "equipment", "feature", "magicStream"]),
  name: text(),
  system: freeObject(),
});

const fileShape = objectShape(
  {
    system: constant("pivot"),
    format: constant(2),
    schemaVersion: constant(2),
    generatorVersion: text(1),
    exportedAt: text(1),
    choices: objectShape(
      {
        name: text(),
        concept: text(),
        focus: text(),
        species: oneOf(["", "human", "dwarf", "elf", "halfling", "gnome", "custom"]),
        cust: objectShape(
          {
            mode: constant("p21"),
            plus2: oneOf(ABILITY_KEYS),
            plus1: oneOf(ABILITY_KEYS),
            size: oneOf(["Small", "Medium", "Large"]),
            nativeLang: text(),
          },
          { largeAb: text() },
        ),
        sp: objectShape({
          skType: oneOf(["skill", "weapon"]),
          skVal: text(),
          vOrigin: text(),
          vGeneral: text(),
          lang: text(),
          craft: text(),
          grade: text(),
          elfGrade: text(),
        }),
        bg: text(),
        bgp: bgpShape,
        issue: text(),
        survFeat: text(),
        scores: objectShape({
          str: text(),
          dex: text(),
          con: text(),
          int: text(),
          wis: text(),
          cha: text(),
        }),
        adj: objectShape({
          str: integer(),
          dex: integer(),
          con: integer(),
          int: integer(),
          wis: integer(),
          cha: integer(),
        }),
        prim: list(oneOf(ABILITY_KEYS)),
        magicAb: abilityOrBlank(),
        flaws: list(objectShape({ n: text(), bp: integer() })),
        hd: integer(0, 4),
        hpRoll: text(),
        aw: booleanValue(),
        streams: list(text()),
        wprof: list(text()),
        aprof: oneOf(["None", "Light", "Medium", "Heavy"]),
        shield: booleanValue(),
        feats: list(text()),
        asiPicks: stringMap(),
        freeO: text(),
        freeG: text(),
        skills: list(text()),
        habil: list(text()),
        gearBP: booleanValue(),
        roadWeapon: text(),
        roadType: text(),
        blocks: list(text()),
        blockPicks: blockPickMap(),
        armourBlock: oneOf(["", "Light", "Medium", "Heavy"]),
        money: text(),
        moneyRolls: list(integer()),
        look: text(),
        home: text(),
        loyalty: text(),
        notes: text(),
      },
      { mods: list(text()), modPicks: stringMap() },
    ),
    computed: objectShape(
      {
        abilities: objectShape({
          str: abilityRow,
          dex: abilityRow,
          con: abilityRow,
          int: abilityRow,
          wis: abilityRow,
          cha: abilityRow,
        }),
        hp: integer(0),
        hitDie: oneOf(["d4", "d6", "d8", "d10", "d12"]),
        ac: integer(),
        acArmour: text(),
        speed: integer(),
        pool: integer(),
        mp: integerOrNull(),
        buildPoints: objectShape({
          income: integer(),
          spent: integer(),
          remaining: integer(),
        }),
        skills: skillsShape,
        attacks: list(attackShape),
        armourProf: oneOf(["None", "Light", "Medium", "Heavy"]),
        shieldProf: booleanValue(),
        languages: list(text()),
      },
      { items: list(computedItemShape) },
    ),
  },
  { notices: list(text()) },
);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "exportedAt") continue;
    sorted[key] = canonicalize(value[key]);
  }
  return sorted;
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function abilityDraft(computed: ComputedFile): CharacterSystemDraft["abilities"] {
  return {
    str: { score: computed.abilities.str.score, primary: computed.abilities.str.primary },
    dex: { score: computed.abilities.dex.score, primary: computed.abilities.dex.primary },
    con: { score: computed.abilities.con.score, primary: computed.abilities.con.primary },
    int: { score: computed.abilities.int.score, primary: computed.abilities.int.primary },
    wis: { score: computed.abilities.wis.score, primary: computed.abilities.wis.primary },
    cha: { score: computed.abilities.cha.score, primary: computed.abilities.cha.primary },
  };
}

function skillBonus(row: SkillFile, fileMod: number): number {
  const trained = row.proficient ? LEVEL_ONE_PROFICIENCY : 0;
  const expert = row.proficient && row.expertise ? LEVEL_ONE_PROFICIENCY : 0;
  return row.total - fileMod - trained - expert;
}

function storedAbility(row: SkillFile, canonical: AbilityKey | "varies"): AbilityKey {
  if (row.ability) return row.ability;
  return canonical === "varies" ? "int" : canonical;
}

function skillDraft(computed: ComputedFile): Record<string, SkillDraft> {
  const skills: Record<string, SkillDraft> = {};
  for (const skill of canonicalSkills) {
    const row = computed.skills[skill.label];
    if (!row) continue;
    const ability = storedAbility(row, skill.ability);
    skills[skill.id] = {
      ability,
      proficient: row.proficient,
      deepening: 0,
      expertise: row.expertise,
      bonus: skillBonus(row, computed.abilities[ability].mod),
    };
  }
  return skills;
}

function specializationDraft(computed: ComputedFile): CharacterSystemDraft["skillSpecializations"] {
  const academia: SpecializationDraft[] = [];
  const crafting: SpecializationDraft[] = [];
  for (const [label, row] of Object.entries(computed.skills)) {
    const academiaName = label.startsWith(ACADEMIA_PREFIX)
      ? label.slice(ACADEMIA_PREFIX.length)
      : "";
    const craftingName = label.startsWith(CRAFTING_PREFIX)
      ? label.slice(CRAFTING_PREFIX.length)
      : "";
    if (canonicalLabels.has(label) || (!academiaName && !craftingName)) continue;
    const ability = row.ability ?? "int";
    const draft: SpecializationDraft = {
      name: academiaName || craftingName,
      ability,
      proficient: row.proficient,
      deepening: 0,
      expertise: row.expertise,
      bonus: skillBonus(row, computed.abilities[ability].mod),
    };
    if (academiaName) academia.push(draft);
    else crafting.push(draft);
  }
  return { academia, crafting };
}

function armourDraft(grade: ComputedFile["armourProf"]): {
  light: boolean;
  medium: boolean;
  heavy: boolean;
} {
  const rank = { None: 0, Light: 1, Medium: 2, Heavy: 3 }[grade];
  return { light: rank >= 1, medium: rank >= 2, heavy: rank >= 3 };
}

function weaponDraft(attacks: ComputedFile["attacks"]): WeaponProficiencyDraft {
  const weapons: Record<WeaponKey, boolean> = {
    meleeLight: false,
    meleeMedium: false,
    meleeHeavy: false,
    meleeTwoHandedHeavy: false,
    bows: false,
    crossbows: false,
    thrown: false,
    improvised: false,
    slings: false,
  };
  for (const attack of attacks) {
    if (!attack.proficient) continue;
    weapons[ATTACK_CATEGORY_TO_KEY[attack.category]] = true;
  }
  return weapons;
}

function currencyDraft(money: string): CharacterSystemDraft["currency"] {
  if (/^[0-9]+$/.test(money)) return { gp: Number(money), sp: 0, cp: 0, other: "" };
  return { gp: 0, sp: 0, cp: 0, other: money };
}

function specialNotes(choices: ChoiceFile): string {
  const lines: string[] = [];
  if (choices.species === "custom") lines.push(`Size: ${choices.cust.size}`);
  if (choices.look) lines.push(`Look: ${choices.look}`);
  if (choices.home) lines.push(`Home: ${choices.home}`);
  if (choices.notes) lines.push(`Notes: ${choices.notes}`);
  return lines.join("\n");
}

function manaDraft(
  choices: ChoiceFile,
  computed: ComputedFile,
): { value: number; maxBonus: number } {
  if (computed.mp === null) return { value: 0, maxBonus: 0 };
  const ability = choices.magicAb === "" ? null : choices.magicAb;
  const score = ability ? computed.abilities[ability].score : 0;
  const base = calculateManaMaximum({
    awakened: choices.aw,
    level: 1,
    abilityScore: score,
  });
  return { value: computed.mp, maxBonus: computed.mp - base };
}

function projectItems(file: StoredCharacter): ImportItem[] {
  if (file.computed.items) return file.computed.items.map(overlayItem);
  return choiceItems(file);
}

function fileItemName(shell: string, acArmour: string): string {
  if (
    (shell === "Light" || shell === "Medium" || shell === "Heavy") &&
    acArmour.startsWith(`${shell} `)
  ) {
    return acArmour;
  }
  return shell;
}

function roadCategoryNames(roadType: string): AttackCategory[] {
  if (roadType.includes("Light or Medium")) return ["Light Melee", "Medium Melee"];
  if (roadType.includes("Two-Handed")) return ["Two-Handed Heavy Melee"];
  const names: AttackCategory[] = [];
  if (roadType.includes("Heavy Melee")) names.push("Heavy Melee");
  if (roadType.includes("Light Melee")) names.push("Light Melee");
  if (roadType.includes("Medium Melee")) names.push("Medium Melee");
  return names.length > 0 ? names : ["Light Melee", "Medium Melee"];
}

function roadAttack(file: StoredCharacter): ComputedFile["attacks"][number] | undefined {
  const wanted = roadCategoryNames(file.choices.roadType);
  const pool = file.computed.attacks.filter((attack) => wanted.includes(attack.category));
  const proficient = pool.filter((attack) => attack.proficient);
  const candidates = proficient.length > 0 ? proficient : pool;
  return candidates.slice().sort((left, right) => right.attack - left.attack)[0];
}

function roadDamage(die: string): { formula: string; versatile: string } {
  const match = /^(\d*d\d+)(?:\s*\(([^)]*)\))?\s*$/.exec(die.trim());
  if (!match?.[1]) return { formula: die.trim(), versatile: "" };
  return { formula: match[1], versatile: match[2]?.trim() ?? "" };
}

function roadWeaponSystem(file: StoredCharacter): Record<string, unknown> {
  const row = roadAttack(file);
  if (!row) return {};
  const trained = row.proficient ? LEVEL_ONE_PROFICIENCY : 0;
  const bonus = row.attack - file.computed.abilities[row.ability].mod - trained;
  const damage = roadDamage(row.die);
  const notes = damage.versatile ? `${file.choices.roadType} (${damage.versatile})` : undefined;
  return {
    category: ATTACK_CATEGORY_TO_KEY[row.category],
    attack: { ability: row.ability, bonus },
    damage: { formula: damage.formula, ability: row.ability },
    ...(notes ? { notes } : {}),
  };
}

function choiceItems(file: StoredCharacter): ImportItem[] {
  const choices = file.choices;
  const acArmour = file.computed.acArmour;
  const items: ImportItem[] = [];
  const species = SPECIES_LABEL[choices.species];
  if (species) items.push(featureItem(species, "species"));
  if (choices.bg) items.push(featureItem(choices.bg, "background"));
  for (const flaw of choices.flaws) {
    if (flaw.n) items.push(featureItem(flaw.n, "flaw"));
  }
  for (const name of choices.feats) {
    if (name) items.push(featureItem(name, "feat"));
  }
  if (choices.freeO) items.push(featureItem(choices.freeO, "feat"));
  if (choices.freeG) items.push(featureItem(choices.freeG, "feat"));
  if (choices.survFeat) items.push(featureItem(choices.survFeat, "feat"));
  for (const name of choices.mods ?? []) {
    if (name) items.push(featureItem(name, "bodyModification"));
  }
  for (const name of choices.habil) {
    if (name) items.push(featureItem(name, "humanoidAbility"));
  }
  if (choices.aw) items.push(featureItem("Awakened", "feat"));
  const streamAbility = choices.magicAb === "" ? "int" : choices.magicAb;
  for (const name of choices.streams) {
    if (name) items.push(streamItem(name, streamAbility));
  }
  if (choices.roadWeapon) {
    items.push(weaponItem(choices.roadWeapon, choices.roadType, roadWeaponSystem(file)));
  }
  if (choices.armourBlock) {
    const armour = armourItem(choices.armourBlock);
    items.push({ ...armour, name: fileItemName(armour.name, acArmour) });
  }
  for (const name of choices.blocks) {
    if (!name) continue;
    const item = equipmentItem(name);
    items.push({ ...item, name: fileItemName(item.name, acArmour) });
  }
  if (choices.issue) {
    const item = equipmentItem(choices.issue);
    items.push({ ...item, name: fileItemName(item.name, acArmour) });
  }
  return items;
}

function featureItem(
  name: string,
  category: string,
  system: Record<string, unknown> = {},
): ImportItem {
  const cost = asRecord(system.cost);
  const uses = asRecord(system.uses);
  return {
    type: "feature",
    name,
    system: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
      category: stringOr(system.category, category),
      source: stringOr(system.source, "pivot-chargen"),
      cost: { pool: numberOr(cost?.pool, 0), mp: numberOr(cost?.mp, 0), bp: numberOr(cost?.bp, 0) },
      uses: { value: numberOr(uses?.value, 0), max: numberOr(uses?.max, 0) },
      notes: stringOr(system.notes, ""),
    },
  };
}

function weaponItem(name: string, notes: string, system: Record<string, unknown> = {}): ImportItem {
  const attack = asRecord(system.attack);
  const damage = asRecord(system.damage);
  const range = asRecord(system.range);
  return {
    type: "weapon",
    name,
    system: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
      category: stringOr(system.category, "meleeLight"),
      attack: { ability: abilityOr(attack?.ability, "str"), bonus: numberOr(attack?.bonus, 0) },
      damage: {
        formula: stringOr(damage?.formula, ""),
        type: stringOr(damage?.type, ""),
        ability: nullableAbility(damage?.ability),
        bonus: numberOr(damage?.bonus, 0),
      },
      range: { normal: numberOr(range?.normal, 0), long: numberOr(range?.long, 0) },
      weight: numberOr(system.weight, 0),
      quantity: numberOr(system.quantity, 1),
      carried: booleanOr(system.carried, true),
      notes: stringOr(system.notes, notes),
    },
  };
}

function armourItem(
  grade: "Light" | "Medium" | "Heavy",
  system: Record<string, unknown> = {},
): ImportItem {
  const category = grade.toLowerCase();
  const stored = stringOr(system.category, category);
  const resolved =
    stored === "light" || stored === "medium" || stored === "heavy" ? stored : "light";
  return {
    type: "armour",
    name: stringOr(system.name, grade),
    system: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
      category: resolved,
      acBonus: numberOr(system.acBonus, 0),
      equipped: booleanOr(system.equipped, false),
      weight: numberOr(system.weight, 0),
      quantity: numberOr(system.quantity, 1),
      carried: booleanOr(system.carried, true),
      notes: stringOr(system.notes, ""),
    },
  };
}

function equipmentItem(name: string, system: Record<string, unknown> = {}): ImportItem {
  return {
    type: "equipment",
    name,
    system: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
      quantity: numberOr(system.quantity, 1),
      weight: numberOr(system.weight, 0),
      carried: booleanOr(system.carried, true),
      equipped: booleanOr(system.equipped, false),
      notes: stringOr(system.notes, ""),
    },
  };
}

function streamItem(
  name: string,
  ability: AbilityKey,
  system: Record<string, unknown> = {},
): ImportItem {
  return {
    type: "magicStream",
    name,
    system: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      effects: [],
      ability: abilityOr(system.ability, ability),
      echelon: numberOr(system.echelon, 1),
      notes: stringOr(system.notes, ""),
    },
  };
}

function overlayItem(item: ComputedItem): ImportItem {
  const system = { ...item.system };
  if (item.type === "feature") return featureItem(item.name, "feat", system);
  if (item.type === "weapon") return weaponItem(item.name, "", system);
  if (item.type === "armour") {
    const grade = armourGrade(stringOr(system.category, "light"));
    return { ...armourItem(grade, system), name: item.name };
  }
  if (item.type === "magicStream") return streamItem(item.name, "int", system);
  return equipmentItem(item.name, system);
}

function armourGrade(category: string): "Light" | "Medium" | "Heavy" {
  if (category === "medium" || category === "Medium") return "Medium";
  if (category === "heavy" || category === "Heavy") return "Heavy";
  return "Light";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) return undefined;
  return value;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isAbility(value: unknown): value is AbilityKey {
  return typeof value === "string" && (ABILITY_KEYS as readonly string[]).includes(value);
}

function abilityOr(value: unknown, fallback: AbilityKey): AbilityKey {
  return isAbility(value) ? value : fallback;
}

function nullableAbility(value: unknown): AbilityKey | null {
  if (value === null || value === undefined) return null;
  return isAbility(value) ? value : null;
}
