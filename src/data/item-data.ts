import {
  booleanField,
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

export type PivotItemDataModels = Record<
  "weapon" | "armour" | "equipment" | "feature" | "magicStream" | "magicAbility",
  TypeDataModelWithSchema
>;

export function createPivotItemDataModels(foundry: FoundryRuntime): PivotItemDataModels {
  const fields = foundry.data.fields;

  class PivotWeaponData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        category: stringField(fields, { required: true, initial: "meleeLight" }),
        attack: schemaField(fields, {
          ability: stringField(fields, { required: true, initial: "str" }),
          bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
        }),
        damage: schemaField(fields, {
          formula: stringField(fields, { required: true, initial: "1d4" }),
          type: stringField(fields, { required: true, initial: "" }),
          ability: stringField(fields, { required: true, nullable: true, initial: "str" }),
          bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
        }),
        range: schemaField(fields, {
          normal: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          long: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
        }),
        weight: numberField(fields, { required: true, min: 0, initial: 0 }),
        quantity: numberField(fields, { required: true, integer: true, min: 0, initial: 1 }),
        carried: booleanField(fields, { required: true, initial: true }),
        notes: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  class PivotArmourData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        category: stringField(fields, { required: true, initial: "light" }),
        acBonus: numberField(fields, { required: true, integer: true, initial: 1 }),
        equipped: booleanField(fields, { required: true, initial: false }),
        weight: numberField(fields, { required: true, min: 0, initial: 0 }),
        quantity: numberField(fields, { required: true, integer: true, min: 0, initial: 1 }),
        carried: booleanField(fields, { required: true, initial: true }),
        notes: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  class PivotEquipmentData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        quantity: numberField(fields, { required: true, min: 0, initial: 1 }),
        weight: numberField(fields, { required: true, min: 0, initial: 0 }),
        carried: booleanField(fields, { required: true, initial: true }),
        equipped: booleanField(fields, { required: true, initial: false }),
        notes: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  class PivotFeatureData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        category: stringField(fields, { required: true, initial: "feat" }),
        source: stringField(fields, { required: true, initial: "" }),
        cost: schemaField(fields, {
          pool: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          mp: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
        }),
        uses: schemaField(fields, {
          value: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          max: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
        }),
        notes: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  class PivotMagicStreamData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        ability: stringField(fields, { required: true, initial: "int" }),
        echelon: numberField(fields, { required: true, integer: true, min: 1, max: 5, initial: 1 }),
        notes: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  class PivotMagicAbilityData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        stream: stringField(fields, { required: true, initial: "" }),
        echelon: numberField(fields, { required: true, integer: true, min: 1, max: 5, initial: 1 }),
        mpCost: numberField(fields, { required: true, integer: true, min: 0, initial: 1 }),
        roll: stringField(fields, { required: true, initial: "" }),
        damage: stringField(fields, { required: true, initial: "" }),
        notes: stringField(fields, { required: true, initial: "" }),
      };
    }
  }

  return {
    weapon: PivotWeaponData,
    armour: PivotArmourData,
    equipment: PivotEquipmentData,
    feature: PivotFeatureData,
    magicStream: PivotMagicStreamData,
    magicAbility: PivotMagicAbilityData,
  };
}
