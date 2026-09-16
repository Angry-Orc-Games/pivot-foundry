export type DataField = object;

export type TypeDataModelConstructor = new (...args: never[]) => object;

export interface DataFieldConstructors {
  NumberField: new (options?: Record<string, unknown>) => DataField;
  StringField: new (options?: Record<string, unknown>) => DataField;
  BooleanField: new (options?: Record<string, unknown>) => DataField;
  SchemaField: new (fields: Record<string, DataField>) => DataField;
  ArrayField: new (field: DataField) => DataField;
}

export interface FoundryRuntime {
  abstract: {
    TypeDataModel: TypeDataModelConstructor;
  };
  data: {
    fields: DataFieldConstructors;
  };
  applications: {
    api: {
      HandlebarsApplicationMixin: (base: TypeDataModelConstructor) => TypeDataModelConstructor;
    };
    apps: {
      DocumentSheetConfig: {
        registerSheet: (
          documentClass: unknown,
          namespace: string,
          sheetClass: unknown,
          options: Record<string, unknown>,
        ) => void;
      };
    };
    sheets: {
      ActorSheetV2: TypeDataModelConstructor;
      ItemSheetV2: TypeDataModelConstructor;
    };
  };
}

export interface FoundryHooks {
  on?(
    event: "renderChatMessageHTML",
    callback: (
      message: { id?: string; flags?: Record<string, unknown> },
      html: HTMLElement,
    ) => void,
  ): void;
  on?(
    event: "preCreateActor",
    callback: (actor: {
      type?: string;
      system?: unknown;
      updateSource?: (data: Record<string, unknown>) => unknown;
    }) => void,
  ): void;
  on?(
    event: "preUpdateActor",
    callback: (actor: { system?: unknown }, changes: Record<string, unknown>) => false | undefined,
  ): void;
  once(event: "init" | "ready", callback: () => void): void;
}

export interface FoundryConfig {
  Actor: {
    dataModels: Record<string, TypeDataModelConstructor>;
    trackableAttributes?: Record<string, { bar: string[]; value: string[] }>;
  };
  Item: {
    dataModels: Record<string, TypeDataModelConstructor>;
  };
}

export interface PivotRegistrationRuntime {
  Hooks: FoundryHooks;
  CONFIG: FoundryConfig;
  foundry: FoundryRuntime;
  ActorDocument?: unknown;
  ItemDocument?: unknown;
}

export function stringField(
  fields: DataFieldConstructors,
  options: Record<string, unknown> = {},
): DataField {
  return new fields.StringField(options);
}

export function numberField(
  fields: DataFieldConstructors,
  options: Record<string, unknown> = {},
): DataField {
  return new fields.NumberField(options);
}

export function booleanField(
  fields: DataFieldConstructors,
  options: Record<string, unknown> = {},
): DataField {
  return new fields.BooleanField(options);
}

export function schemaField(
  fields: DataFieldConstructors,
  schema: Record<string, DataField>,
): DataField {
  return new fields.SchemaField(schema);
}

export function arrayField(fields: DataFieldConstructors, field: DataField): DataField {
  return new fields.ArrayField(field);
}
