import { CURRENT_SCHEMA_VERSION } from "../rules/schema-version";
import {
  type DataField,
  type FoundryRuntime,
  numberField,
  schemaField,
  stringField,
  type TypeDataModelConstructor,
} from "../foundry-runtime";

type TypeDataModelWithSchema = TypeDataModelConstructor & {
  defineSchema(): Record<string, DataField>;
};

export function createPivotNpcDataModel(foundry: FoundryRuntime): TypeDataModelWithSchema {
  const fields = foundry.data.fields;

  class PivotNpcData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        schemaVersion: numberField(fields, {
          required: true,
          integer: true,
          min: 0,
          initial: CURRENT_SCHEMA_VERSION,
        }),
        attributes: schemaField(fields, {
          hp: schemaField(fields, {
            value: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
            max: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          }),
          ac: numberField(fields, { required: true, integer: true, min: 0, initial: 10 }),
          speed: numberField(fields, { required: true, integer: true, min: 0, initial: 10 }),
        }),
        combatBonuses: schemaField(fields, {
          physical: numberField(fields, { required: true, integer: true, initial: 0 }),
          intellectual: numberField(fields, { required: true, integer: true, initial: 0 }),
        }),
        cr: stringField(fields, { required: true, initial: "0" }),
        biography: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  return PivotNpcData;
}
