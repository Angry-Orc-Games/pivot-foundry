import type { MigrationPlan } from "./m001";
import { characterMpMaximum, clampMp } from "../rules/resources";

export const MP_CLAMP_MIGRATION_ID = "M005";

export interface MpClampPlan {
  plan: MigrationPlan;
  notice?: string;
}

type StoredDocument = {
  name?: string;
  type?: string;
  system?: unknown;
  _source?: { system?: unknown };
  toObject?: () => { system?: unknown };
  items?:
    | Iterable<StoredDocument>
    | {
        contents: Iterable<StoredDocument>;
      };
};

const unchanged: MpClampPlan = { plan: { ok: true, changed: false } };

export function planMpClampMigration(document: StoredDocument): MpClampPlan {
  if (document.type && document.type !== "character") return unchanged;
  const stored = readStoredSystem(document);
  const current = readMpValue(stored);
  if (current === undefined) return unchanged;
  const items = listItems(document).map((item) => ({ system: readStoredSystem(item) }));
  const max = characterMpMaximum(stored, items);
  if (!(current > max)) return unchanged;
  const clamped = clampMp(current, max);
  const name = document.name ?? "unknown";
  return {
    plan: {
      ok: true,
      changed: true,
      update: { "system.magic.mp.value": clamped },
    },
    notice: `${MP_CLAMP_MIGRATION_ID}: clamped MP on '${name}' from ${current} to ${clamped}`,
  };
}

function readStoredSystem(document: StoredDocument): unknown {
  if (typeof document.toObject === "function") {
    try {
      const object = document.toObject();
      if (isRecord(object) && "system" in object) return object.system;
    } catch {
      // Fall through to source data.
    }
  }
  if (isRecord(document._source) && "system" in document._source) return document._source.system;
  return document.system;
}

function listItems(document: StoredDocument): StoredDocument[] {
  const items = document.items;
  if (!items) return [];
  if (typeof items === "object" && "contents" in items) return Array.from(items.contents);
  if (typeof items === "object" && Symbol.iterator in Object(items)) {
    return Array.from(items as Iterable<StoredDocument>);
  }
  return [];
}

function readMpValue(system: unknown): number | undefined {
  if (!isRecord(system) || !isRecord(system.magic) || !isRecord(system.magic.mp)) return undefined;
  return typeof system.magic.mp.value === "number" ? system.magic.mp.value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
