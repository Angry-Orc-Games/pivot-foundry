export const ECHELON_VALUES = ["core", "1", "2", "3", "4", "5"] as const;

export type Echelon = (typeof ECHELON_VALUES)[number];

export const M006_NUMERIC_ECHELON_MAP = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
} as const satisfies Record<number, Echelon>;

const numericEchelon: Partial<Record<number, Echelon>> = M006_NUMERIC_ECHELON_MAP;
const echelonValues: ReadonlySet<string> = new Set(ECHELON_VALUES);

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
