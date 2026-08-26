import { abilities, canonicalSkills } from "../config";
import {
  arrayField,
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

export function createPivotCharacterDataModel(foundry: FoundryRuntime): TypeDataModelWithSchema {
  const fields = foundry.data.fields;

  class PivotCharacterData extends foundry.abstract.TypeDataModel {
    static defineSchema(): Record<string, DataField> {
      return {
        identity: schemaField(fields, {
          player: stringField(fields, { required: true, initial: "" }),
          backgroundText: stringField(fields, { required: true, initial: "" }),
          speciesText: stringField(fields, { required: true, initial: "" }),
          languages: arrayField(fields, stringField(fields, { required: true, initial: "" })),
          loyalty: stringField(fields, { required: true, initial: "" }),
          weight: schemaField(fields, {
            value: numberField(fields, { required: true, nullable: true, initial: null, min: 0 }),
            unit: stringField(fields, { required: true, initial: "kg" }),
          }),
          height: stringField(fields, { required: true, initial: "" }),
          age: stringField(fields, { required: true, initial: "" }),
          eyes: stringField(fields, { required: true, initial: "" }),
          hair: stringField(fields, { required: true, initial: "" }),
        }),
        progression: schemaField(fields, {
          level: numberField(fields, { required: true, integer: true, min: 1, initial: 1 }),
          xp: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          buildPoints: numberField(fields, { required: true, integer: true, min: 0, initial: 8 }),
          progressionPoints: numberField(fields, {
            required: true,
            integer: true,
            min: 0,
            initial: 0,
          }),
        }),
        abilities: schemaField(
          fields,
          Object.fromEntries(abilities.map(({ key }) => [key, abilitySchema(fields)])),
        ),
        attributes: schemaField(fields, {
          hp: schemaField(fields, {
            value: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
            max: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          }),
          hitDie: stringField(fields, { required: true, initial: "d8" }),
          speed: schemaField(fields, {
            value: numberField(fields, { required: true, integer: true, min: 0, initial: 10 }),
            bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
          }),
          ac: schemaField(fields, {
            bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
          }),
          initiative: schemaField(fields, {
            bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
          }),
          passivePerception: schemaField(fields, {
            mode: stringField(fields, { required: true, initial: "normal" }),
          }),
          deathSaves: schemaField(fields, {
            successes: numberField(fields, {
              required: true,
              integer: true,
              min: 0,
              max: 3,
              initial: 0,
            }),
            failures: numberField(fields, {
              required: true,
              integer: true,
              min: 0,
              max: 3,
              initial: 0,
            }),
          }),
        }),
        resources: schemaField(fields, {
          pool: schemaField(fields, {
            value: numberField(fields, { required: true, integer: true, min: 0, initial: 1 }),
            maxBonus: numberField(fields, { required: true, integer: true, initial: 0 }),
          }),
        }),
        skills: schemaField(
          fields,
          Object.fromEntries(
            canonicalSkills.map((skill) => [skill.id, skillSchema(fields, skill.ability)]),
          ),
        ),
        skillSpecializations: schemaField(fields, {
          academia: arrayField(fields, skillSpecializationSchema(fields, "int")),
          crafting: arrayField(fields, skillSpecializationSchema(fields, "int")),
        }),
        proficiencies: schemaField(fields, {
          armour: schemaField(fields, {
            light: booleanField(fields, { required: true, initial: false }),
            medium: booleanField(fields, { required: true, initial: false }),
            heavy: booleanField(fields, { required: true, initial: false }),
          }),
          shields: booleanField(fields, { required: true, initial: false }),
          instruments: arrayField(fields, stringField(fields, { required: true, initial: "" })),
          weapons: schemaField(fields, {
            meleeLight: booleanField(fields, { required: true, initial: false }),
            meleeMedium: booleanField(fields, { required: true, initial: false }),
            meleeHeavy: booleanField(fields, { required: true, initial: false }),
            meleeTwoHandedHeavy: booleanField(fields, { required: true, initial: false }),
            bows: booleanField(fields, { required: true, initial: false }),
            crossbows: booleanField(fields, { required: true, initial: false }),
            thrown: booleanField(fields, { required: true, initial: false }),
            improvised: booleanField(fields, { required: true, initial: false }),
          }),
        }),
        currency: schemaField(fields, {
          gp: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          sp: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          cp: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
          other: stringField(fields, { required: true, initial: "" }),
        }),
        magic: schemaField(fields, {
          awakened: booleanField(fields, { required: true, initial: false }),
          ability: stringField(fields, { required: true, nullable: true, initial: null }),
          mp: schemaField(fields, {
            value: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
            maxBonus: numberField(fields, { required: true, integer: true, initial: 0 }),
          }),
        }),
        notes: schemaField(fields, {
          runesThaumaturgy: stringField(fields, { required: true, initial: "" }),
          special: stringField(fields, { required: true, initial: "" }),
        }),
      };
    }
  }

  return PivotCharacterData;
}

function abilitySchema(fields: FoundryRuntime["data"]["fields"]): DataField {
  return schemaField(fields, {
    score: numberField(fields, { required: true, integer: true, min: 1, max: 30, initial: 10 }),
    primary: booleanField(fields, { required: true, initial: false }),
  });
}

function skillSchema(fields: FoundryRuntime["data"]["fields"], ability: string): DataField {
  return schemaField(fields, {
    ability: stringField(fields, {
      required: true,
      initial: ability === "varies" ? "int" : ability,
    }),
    proficient: booleanField(fields, { required: true, initial: false }),
    deepening: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
    expertise: booleanField(fields, { required: true, initial: false }),
    bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
  });
}

function skillSpecializationSchema(
  fields: FoundryRuntime["data"]["fields"],
  ability: string,
): DataField {
  return schemaField(fields, {
    name: stringField(fields, { required: true, initial: "" }),
    ability: stringField(fields, { required: true, initial: ability }),
    proficient: booleanField(fields, { required: true, initial: true }),
    deepening: numberField(fields, { required: true, integer: true, min: 0, initial: 0 }),
    expertise: booleanField(fields, { required: true, initial: false }),
    bonus: numberField(fields, { required: true, integer: true, initial: 0 }),
  });
}
