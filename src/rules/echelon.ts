export const ECHELON_VALUES = ["core", "1", "2", "3", "4", "5"] as const;

export type Echelon = (typeof ECHELON_VALUES)[number];

const M006_NUMERIC_ECHELON_MAP = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
} as const satisfies Record<number, Echelon>;

const numericEchelon: Partial<Record<number, Echelon>> = M006_NUMERIC_ECHELON_MAP;
const echelonValues: ReadonlySet<string> = new Set(ECHELON_VALUES);
const legacyEchelon = new WeakMap<object, unknown>();

export function normalizeEchelon(value: unknown): Echelon | undefined {
  if (typeof value === "string") {
    const canonical = value.toLowerCase();
    return echelonValues.has(canonical) ? (canonical as Echelon) : undefined;
  }
  if (typeof value === "number" && Number.isInteger(value)) return numericEchelon[value];
  return undefined;
}

export function migrateStoredEchelon(value: unknown): Echelon {
  return normalizeEchelon(value) ?? "core";
}

export function rememberLegacyEchelon(source: object, original: unknown): void {
  legacyEchelon.set(source, original);
}

export function hasLegacyEchelon(source: object): boolean {
  return legacyEchelon.has(source);
}

export function peekLegacyEchelon(source: object): unknown {
  return legacyEchelon.get(source);
}

export function takeLegacyEchelon(source: object): unknown {
  if (!legacyEchelon.has(source)) return undefined;
  const original = legacyEchelon.get(source);
  legacyEchelon.delete(source);
  return original;
}
