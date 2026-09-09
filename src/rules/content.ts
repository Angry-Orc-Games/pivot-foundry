import { itemTypes, SYSTEM_ID } from "../config";
import { validateEffectRule, type EffectRule } from "./effects";
import { CURRENT_SCHEMA_VERSION } from "./schema-version";

export const CONTENT_PACK_ITEM_IMG = "icons/svg/item-bag.svg";

export type PivotItemType = (typeof itemTypes)[number];

export interface ContentRecord {
  contentId: string;
  name: string;
  type: PivotItemType;
  img?: string;
  system: ContentItemSystem;
}

export interface ContentItemSystem {
  schemaVersion: number;
  effects: EffectRule[];
  notes?: string;
  category?: string;
  source?: string;
  cost?: { pool?: number; mp?: number };
  uses?: { value?: number; max?: number };
  attack?: { ability?: string; bonus?: number };
  damage?: string | { formula?: string; type?: string; ability?: string | null; bonus?: number };
  range?: { normal?: number; long?: number };
  acBonus?: number;
  equipped?: boolean;
  quantity?: number;
  weight?: number;
  carried?: boolean;
  ability?: string;
  stream?: string;
  echelon?: number;
  mpCost?: number;
  roll?: string;
  damageFormula?: string;
}

export interface FoundryPackItemDocument {
  _id: string;
  name: string;
  type: PivotItemType;
  img: string;
  system: ContentItemSystem;
  flags: {
    "pivot-fantasy": {
      contentId: string;
    };
  };
}

const itemTypeSet = new Set<string>(itemTypes);
const contentRecordKeys = new Set(["contentId", "name", "type", "img", "system"]);
const sharedSystemKeys = new Set(["schemaVersion", "effects", "notes"]);
const allowedSystemKeys: Record<PivotItemType, Set<string>> = {
  weapon: new Set([
    ...sharedSystemKeys,
    "category",
    "attack",
    "damage",
    "range",
    "weight",
    "quantity",
    "carried",
  ]),
  armour: new Set([
    ...sharedSystemKeys,
    "category",
    "acBonus",
    "equipped",
    "weight",
    "quantity",
    "carried",
  ]),
  equipment: new Set([...sharedSystemKeys, "quantity", "weight", "carried", "equipped"]),
  feature: new Set([...sharedSystemKeys, "category", "source", "cost", "uses"]),
  magicStream: new Set([...sharedSystemKeys, "ability", "echelon"]),
  magicAbility: new Set([...sharedSystemKeys, "stream", "echelon", "mpCost", "roll", "damage"]),
};

export function validateContentRecord(value: unknown): ContentRecord {
  if (!isPlainObject(value)) {
    throw new Error("Content record must be a plain object.");
  }

  assertAllowedKeys(value, contentRecordKeys, "content record");
  const contentId = requireContentId(value.contentId);
  const name = requirePlainString(value.name, "name");
  const type = requireItemType(value.type);
  const img = value.img === undefined ? undefined : requireIconPath(value.img);
  const system = validateItemSystem(value.system, type);

  return img === undefined
    ? { contentId, name, type, system }
    : { contentId, name, type, img, system };
}

export function validateContentCatalog(values: readonly unknown[]): ContentRecord[] {
  const records = values.map((value, index) => {
    try {
      return validateContentRecord(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Content record ${index} is invalid: ${message}`, { cause: error });
    }
  });

  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.contentId)) {
      throw new Error(`Duplicate contentId: ${record.contentId}`);
    }
    seen.add(record.contentId);
  }

  return records;
}

export function generateContentPackDocuments(
  records: readonly ContentRecord[],
): FoundryPackItemDocument[] {
  return [...records]
    .sort((left, right) => left.contentId.localeCompare(right.contentId))
    .map((record) => ({
      _id: stableDocumentId(record.contentId),
      name: record.name,
      type: record.type,
      img: record.img ?? CONTENT_PACK_ITEM_IMG,
      system: record.system,
      flags: {
        [SYSTEM_ID]: {
          contentId: record.contentId,
        },
      },
    }));
}

export function stableDocumentId(contentId: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(contentId)) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

function validateItemSystem(value: unknown, type: PivotItemType): ContentItemSystem {
  if (!isPlainObject(value)) {
    throw new Error("system must be a plain object.");
  }

  assertAllowedKeys(value, allowedSystemKeys[type], `${type} system`);

  const schemaVersion = requireFiniteInteger(value.schemaVersion, "schemaVersion");
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`system.schemaVersion must be ${CURRENT_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(value.effects)) {
    throw new Error("system.effects must be an array.");
  }

  const system: ContentItemSystem = {
    schemaVersion,
    effects: value.effects.map((effect, index) => {
      try {
        return validateEffectRule(effect);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`system.effects[${index}] is invalid: ${message}`, { cause: error });
      }
    }),
  };

  if (value.notes !== undefined) system.notes = requirePlainString(value.notes, "notes");
  if (value.category !== undefined)
    system.category = requirePlainString(value.category, "category");
  if (value.source !== undefined) system.source = requirePlainString(value.source, "source");
  if (value.ability !== undefined) system.ability = requirePlainString(value.ability, "ability");
  if (value.stream !== undefined) system.stream = requirePlainString(value.stream, "stream");
  if (value.roll !== undefined) system.roll = requirePlainString(value.roll, "roll");
  if (value.damage !== undefined && type === "magicAbility") {
    system.damage = requirePlainString(value.damage, "damage");
  }
  if (value.cost !== undefined) system.cost = requireCost(value.cost);
  if (value.uses !== undefined) system.uses = requireUses(value.uses);
  if (value.attack !== undefined) system.attack = requireAttack(value.attack);
  if (value.damage !== undefined && type === "weapon") system.damage = requireDamage(value.damage);
  if (value.range !== undefined) system.range = requireRange(value.range);
  if (value.acBonus !== undefined) system.acBonus = requireFiniteInteger(value.acBonus, "acBonus");
  if (value.echelon !== undefined) system.echelon = requireFiniteInteger(value.echelon, "echelon");
  if (value.mpCost !== undefined) system.mpCost = requireNonNegativeInteger(value.mpCost, "mpCost");
  if (value.quantity !== undefined) {
    system.quantity = requireNonNegativeInteger(value.quantity, "quantity");
  }
  if (value.weight !== undefined) system.weight = requireNonNegativeNumber(value.weight, "weight");
  if (value.equipped !== undefined) system.equipped = requireBoolean(value.equipped, "equipped");
  if (value.carried !== undefined) system.carried = requireBoolean(value.carried, "carried");

  return system;
}

function requireContentId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("contentId must be kebab-case.");
  }
  return value;
}

function requireItemType(value: unknown): PivotItemType {
  if (typeof value === "string" && itemTypeSet.has(value)) return value as PivotItemType;
  throw new Error(`Unknown item type: ${String(value)}`);
}

function requireIconPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("img must be a Foundry icon path.");
  }
  if (
    value.includes("..") ||
    value.includes("://") ||
    value.startsWith("/") ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.(svg|webp|png|jpg|jpeg)$/.test(value)
  ) {
    throw new Error("img must be a relative Foundry icon path.");
  }
  return value;
}

function requirePlainString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  if (value.includes("<") || value.includes(">") || value.includes("://")) {
    throw new Error(`${field} must not contain HTML or URLs.`);
  }
  return value;
}

function requireCost(value: unknown): { pool?: number; mp?: number } {
  if (!isPlainObject(value)) throw new Error("cost must be a plain object.");
  assertAllowedKeys(value, new Set(["pool", "mp"]), "cost");
  const cost: { pool?: number; mp?: number } = {};
  if (value.pool !== undefined) cost.pool = requireNonNegativeInteger(value.pool, "cost.pool");
  if (value.mp !== undefined) cost.mp = requireNonNegativeInteger(value.mp, "cost.mp");
  return cost;
}

function requireUses(value: unknown): { value?: number; max?: number } {
  if (!isPlainObject(value)) throw new Error("uses must be a plain object.");
  assertAllowedKeys(value, new Set(["value", "max"]), "uses");
  const uses: { value?: number; max?: number } = {};
  if (value.value !== undefined) uses.value = requireNonNegativeInteger(value.value, "uses.value");
  if (value.max !== undefined) uses.max = requireNonNegativeInteger(value.max, "uses.max");
  return uses;
}

function requireAttack(value: unknown): { ability?: string; bonus?: number } {
  if (!isPlainObject(value)) throw new Error("attack must be a plain object.");
  assertAllowedKeys(value, new Set(["ability", "bonus"]), "attack");
  const attack: { ability?: string; bonus?: number } = {};
  if (value.ability !== undefined)
    attack.ability = requirePlainString(value.ability, "attack.ability");
  if (value.bonus !== undefined) attack.bonus = requireFiniteInteger(value.bonus, "attack.bonus");
  return attack;
}

function requireDamage(value: unknown): {
  formula?: string;
  type?: string;
  ability?: string | null;
  bonus?: number;
} {
  if (!isPlainObject(value)) throw new Error("damage must be a plain object.");
  assertAllowedKeys(value, new Set(["formula", "type", "ability", "bonus"]), "damage");
  const damage: {
    formula?: string;
    type?: string;
    ability?: string | null;
    bonus?: number;
  } = {};
  if (value.formula !== undefined) {
    damage.formula = requirePlainString(value.formula, "damage.formula");
  }
  if (value.type !== undefined) damage.type = requirePlainString(value.type, "damage.type");
  if (value.ability === null) damage.ability = null;
  else if (value.ability !== undefined) {
    damage.ability = requirePlainString(value.ability, "damage.ability");
  }
  if (value.bonus !== undefined) damage.bonus = requireFiniteInteger(value.bonus, "damage.bonus");
  return damage;
}

function requireRange(value: unknown): { normal?: number; long?: number } {
  if (!isPlainObject(value)) throw new Error("range must be a plain object.");
  assertAllowedKeys(value, new Set(["normal", "long"]), "range");
  const range: { normal?: number; long?: number } = {};
  if (value.normal !== undefined) {
    range.normal = requireNonNegativeInteger(value.normal, "range.normal");
  }
  if (value.long !== undefined) range.long = requireNonNegativeInteger(value.long, "range.long");
  return range;
}

function requireFiniteInteger(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value) && Number.isFinite(value)) return value;
  throw new Error(`${field} must be a finite integer.`);
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  const integer = requireFiniteInteger(value, field);
  if (integer < 0) throw new Error(`${field} must be >= 0.`);
  return integer;
}

function requireNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  throw new Error(`${field} must be a finite number >= 0.`);
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  throw new Error(`${field} must be a boolean.`);
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected keys in ${label}: ${unexpected.join(", ")}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
