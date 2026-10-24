export interface StoredDocument {
  name?: string;
  type?: string;
  system?: Record<string, unknown>;
  toObject?: () => unknown;
  _source?: unknown;
}

export interface PersistedItem {
  id?: string;
  _id?: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
}

export interface PersistedDocument {
  name?: string;
  type?: string;
  system: Record<string, unknown>;
  items?: PersistedItem[];
}

export function readPersistedDocument(document: StoredDocument): PersistedDocument {
  const stored = readStoredRecord(document);
  return {
    name: typeof stored?.name === "string" ? stored.name : document.name,
    type: typeof stored?.type === "string" ? stored.type : document.type,
    system: isRecord(stored?.system) ? stored.system : (document.system ?? {}),
    items: normalizeItems(stored && "items" in stored ? stored.items : undefined),
  };
}

function readStoredRecord(document: StoredDocument): Record<string, unknown> | undefined {
  const fromObject = readObject(document.toObject);
  const fromSource = isRecord(document._source) ? document._source : undefined;
  if (!fromObject) return fromSource;
  if (!fromSource) return fromObject;
  return {
    name: typeof fromObject.name === "string" ? fromObject.name : fromSource.name,
    type: typeof fromObject.type === "string" ? fromObject.type : fromSource.type,
    system: isRecord(fromObject.system) ? fromObject.system : fromSource.system,
    items: "items" in fromObject ? fromObject.items : fromSource.items,
  };
}

function readObject(toObject: StoredDocument["toObject"]): Record<string, unknown> | undefined {
  if (typeof toObject !== "function") return undefined;
  try {
    const value = toObject();
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function normalizeItems(value: unknown): PersistedItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const name = typeof entry.name === "string" ? entry.name : "";
    const type = typeof entry.type === "string" ? entry.type : "";
    if (!name && !type) return [];
    const id = typeof entry.id === "string" ? entry.id : undefined;
    const sourceId = typeof entry._id === "string" ? entry._id : undefined;
    return [
      {
        id,
        _id: sourceId,
        name,
        type,
        system: isRecord(entry.system) ? entry.system : {},
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
