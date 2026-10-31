import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalSkills } from "../../src/config";
import {
  compareDrift,
  toActorData,
  validate,
  type PivotCharacter,
} from "../../src/import/pivot-character";
import { SURVIVAL_VERSION } from "../../src/migrations/m002";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

type JsonRecord = Record<string, unknown>;

const FIXTURES = {
  veteran: "human-veteran.pivot.json",
  elf: "elf-street-mage.pivot.json",
  dwarf: "dwarf-recluse.pivot.json",
  custom: "custom-humanoid.pivot.json",
} as const;

function load(name: string): JsonRecord {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: JsonRecord, key: string): JsonRecord {
  const child = value[key];
  if (!isRecord(child)) throw new Error(`expected object at ${key}`);
  return child;
}

function step(cursor: unknown, key: string): unknown {
  if (Array.isArray(cursor)) return cursor[Number(key)];
  if (isRecord(cursor)) return cursor[key];
  throw new Error(`cannot walk ${key}`);
}

function edit(file: JsonRecord, path: string[], value: unknown): JsonRecord {
  const copy = structuredClone(file);
  let cursor: unknown = copy;
  for (const key of path.slice(0, -1)) cursor = step(cursor, key);
  const last = path[path.length - 1];
  if (!last) throw new Error("empty path");
  if (Array.isArray(cursor)) cursor[Number(last)] = value;
  else if (isRecord(cursor)) cursor[last] = value;
  else throw new Error(`cannot assign ${last}`);
  return copy;
}

function remove(file: JsonRecord, path: string[]): JsonRecord {
  const copy = structuredClone(file);
  let cursor: unknown = copy;
  for (const key of path.slice(0, -1)) cursor = step(cursor, key);
  const last = path[path.length - 1];
  if (!last || !isRecord(cursor)) throw new Error("cannot remove");
  delete cursor[last];
  return copy;
}

function failure(file: unknown) {
  const result = validate(file);
  if (result.ok) throw new Error("expected a validation error");
  return result.error;
}

function open(file: unknown, rederive?: (choices: unknown) => unknown): PivotCharacter {
  const result = validate(file, rederive ? { rederive } : undefined);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function mapped(file: unknown) {
  return toActorData(open(file));
}

function itemNames(file: unknown): string[] {
  return mapped(file).items.map((item) => `${item.type}:${item.name}`);
}

function bonuses(file: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(mapped(file).actor.system.skills)
      .filter(([, row]) => row.bonus !== 0)
      .map(([id, row]) => [id, row.bonus]),
  );
}

function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, reorder(child)]),
    );
  }
  return value;
}

const veteran = load(FIXTURES.veteran);
const elf = load(FIXTURES.elf);
const dwarf = load(FIXTURES.dwarf);
const custom = load(FIXTURES.custom);

describe("validate", () => {
  it.each([null, [], "pivot", 4, undefined])("rejects %j as malformed", (input) => {
    expect(failure(input)).toEqual({
      code: "malformed",
      message: "This file is not a Pivot character JSON object.",
    });
  });

  it("rejects a file from another system", () => {
    expect(failure({ system: "other", format: 2 })).toEqual({
      code: "wrong-system",
      message: "This file is not a Pivot character.",
    });
  });

  it("rejects a version 1 generator save", () => {
    expect(failure({ system: "pivot", v: 1, format: 2 })).toEqual({
      code: "unknown-format",
      message:
        "This file is a version 1 generator save. Export a format 2 file from the character generator.",
    });
  });

  it.each([
    ["format 1", { system: "pivot", format: 1 }],
    ["a string format", { system: "pivot", format: "2" }],
    ["another v", { system: "pivot", v: 2, format: 2 }],
  ])("rejects %s", (_label, input) => {
    expect(failure(input)).toEqual({
      code: "unknown-format",
      message:
        "This file is not a format 2 Pivot character. Export it again from the character generator.",
    });
  });

  it("names the first missing required field", () => {
    expect(failure(remove(veteran, ["computed", "hp"]))).toMatchObject({
      code: "schema",
      field: "computed.hp",
      message: "This file has a problem at computed.hp.",
    });
  });

  it.each([null, -1, 1.5])("rejects computed.hp of %j", (hp) => {
    expect(failure(edit(veteran, ["computed", "hp"], hp)).field).toBe("computed.hp");
  });

  it.each([0, 31, 10.5])("rejects an ability score of %j", (score) => {
    expect(failure(edit(veteran, ["computed", "abilities", "str", "score"], score)).field).toBe(
      "computed.abilities.str.score",
    );
  });

  it("rejects an unknown skill, attack category, armour block, and extra property", () => {
    expect(
      failure(
        edit(veteran, ["computed", "skills", "Flying"], {
          ability: "dex",
          proficient: false,
          expertise: false,
          total: 0,
        }),
      ).field,
    ).toBe("computed.skills.Flying");
    expect(failure(edit(veteran, ["computed", "attacks", "0", "category"], "Polearms")).field).toBe(
      "computed.attacks.0.category",
    );
    expect(failure(edit(veteran, ["choices", "armourBlock"], "Plate")).field).toBe(
      "choices.armourBlock",
    );
    expect(failure(edit(veteran, ["extra"], true)).field).toBe("extra");
    expect(failure(edit(veteran, ["choices", "extra"], true)).field).toBe("choices.extra");
  });

  it("accepts the four samples without a rederive function", () => {
    for (const file of [veteran, elf, dwarf, custom]) {
      const result = validate(file);
      expect(result.ok).toBe(true);
    }
  });

  it("accepts a rederive result that matches the computed block", () => {
    const result = validate(veteran, {
      rederive: (choices) => {
        expect((choices as JsonRecord).name).toBe("Human Veteran");
        return reorder(recordAt(veteran, "computed"));
      },
    });
    expect(result.ok).toBe(true);
  });

  it("ignores exportedAt and key order when a rederive result matches", () => {
    const computed = reorder({ ...recordAt(veteran, "computed"), exportedAt: "changed" });
    expect(validate(veteran, { rederive: () => computed }).ok).toBe(true);
  });

  it("reports a computed block that does not match rederive", () => {
    const computed = structuredClone(recordAt(veteran, "computed"));
    computed.hp = 1;
    expect(failureOf(validate(veteran, { rederive: () => computed }))).toEqual({
      code: "tampered",
      field: "computed",
      message: "This file does not match its choices.",
    });

    const reversed = structuredClone(recordAt(veteran, "computed"));
    reversed.attacks = [...(reversed.attacks as unknown[])].reverse();
    expect(validate(veteran, { rederive: () => reversed }).ok).toBe(false);
  });

  it("reports a rederive function that throws", () => {
    expect(
      failureOf(
        validate(veteran, {
          rederive: () => {
            throw new Error("generator missing");
          },
        }),
      ),
    ).toEqual({
      code: "unverifiable",
      message: "This file could not be checked against the character generator.",
    });
  });
});

function failureOf(result: ReturnType<typeof validate>) {
  if (result.ok) throw new Error("expected a validation error");
  return result.error;
}

describe("toActorData", () => {
  it("keeps a later edit to the file from changing the draft", () => {
    const file = structuredClone(veteran);
    const character = open(file);
    recordAt(file, "choices").name = "Changed";
    const draft = toActorData(character);
    expect(draft.actor.name).toBe("Human Veteran");
    expect(draft.actor.flags["pivot-chargen"].source).toEqual(veteran);
  });

  it("maps the human veteran", () => {
    const draft = mapped(veteran);
    expect(draft.actor.name).toBe("Human Veteran");
    expect(draft.actor.type).toBe("character");
    expect(draft.actor.system.survivalVersion).toBe(1);
    expect(draft.actor.system.survivalVersion).toBe(SURVIVAL_VERSION);
    expect(draft.actor.system.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(draft.actor.system.progression).toEqual({
      level: 1,
      xp: 0,
      buildPoints: 0,
      progressionPoints: 0,
    });
    expect(draft.actor.system.abilities).toEqual({
      str: { score: 16, primary: true },
      dex: { score: 14, primary: false },
      con: { score: 16, primary: true },
      int: { score: 11, primary: false },
      wis: { score: 14, primary: false },
      cha: { score: 9, primary: false },
    });
    expect(draft.actor.system.attributes).toEqual({
      hp: { temp: 0, value: 12, max: 12 },
      hitDie: "d10",
      speed: { value: 10, bonus: 0 },
      ac: { bonus: 4 },
      initiative: { bonus: 0 },
      passivePerception: { mode: "normal" },
      deathSaves: { status: "alive", successes: 0, failures: 0 },
    });
    expect(draft.actor.system.resources.pool).toEqual({ value: 1, maxBonus: 0 });
    expect(draft.actor.system.magic).toEqual({
      awakened: false,
      ability: null,
      mp: { value: 0, maxBonus: 0 },
    });
    expect(Object.keys(draft.actor.system.magic.mp).sort()).toEqual(["maxBonus", "value"]);
    expect(draft.actor.system.proficiencies).toEqual({
      armour: { light: true, medium: true, heavy: true },
      shields: false,
      instruments: [],
      weapons: {
        meleeLight: false,
        meleeMedium: true,
        meleeHeavy: true,
        meleeTwoHandedHeavy: false,
        bows: false,
        crossbows: false,
        thrown: false,
        improvised: false,
        slings: false,
      },
    });
    expect(draft.actor.system.identity).toEqual({
      concept: "A heavy-armoured veteran called back to the road.",
      focus: "Up-close fighter",
      backgroundTier: 0,
      backgroundText: "Veteran",
      speciesText: "Human",
      languages: ["Common", "Elvish", "Dwarvish"],
      loyalty: "The company that hauled him out of the breach.",
    });
    expect(draft.actor.system.notes).toEqual({ runesThaumaturgy: "", special: "" });
    expect(draft.actor.system.currency).toEqual({ gp: 0, sp: 0, cp: 0, other: "" });
    expect(Object.keys(draft.actor.system.skills).sort()).toEqual(
      canonicalSkills.map((skill) => skill.id).sort(),
    );
    expect(bonuses(veteran)).toEqual({});
    expect(draft.actor.system.skills.athletics).toEqual({
      ability: "str",
      proficient: true,
      deepening: 0,
      expertise: false,
      bonus: 0,
    });
    expect(draft.actor.system.skills.medicineHolistic).toEqual({
      ability: "wis",
      proficient: false,
      deepening: 0,
      expertise: false,
      bonus: 0,
    });
    expect(draft.actor.system.skillSpecializations).toEqual({ academia: [], crafting: [] });
    expect(itemNames(veteran)).toEqual([
      "feature:Human",
      "feature:Veteran",
      "feature:Olympian",
      "feature:Tough Guy",
      "feature:Get Down",
      "feature:Just a Scratch",
      "feature:Combat Reflexes",
      "feature:Lucky",
      "feature:Intestinal Fortitude",
      "feature:Fearless",
      "feature:I Am A Warrior",
      "weapon:Arming sword",
      "equipment:Sidearms",
      "equipment:Explorer",
      "equipment:Heavy",
    ]);
    expect(draft.items.find((item) => item.name === "Olympian")).toEqual({
      type: "feature",
      name: "Olympian",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        category: "feat",
        source: "pivot-chargen",
        cost: { pool: 0, mp: 0, bp: 0 },
        uses: { value: 0, max: 0 },
        notes: "",
      },
    });
    expect(draft.items.find((item) => item.name === "Arming sword")).toEqual({
      type: "weapon",
      name: "Arming sword",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        category: "meleeLight",
        attack: { ability: "str", bonus: 0 },
        damage: { formula: "", type: "", ability: null, bonus: 0 },
        range: { normal: 0, long: 0 },
        weight: 0,
        quantity: 1,
        carried: true,
        notes: "Light or Medium Melee weapon",
      },
    });
    expect(draft.items.find((item) => item.name === "Heavy")).toEqual({
      type: "equipment",
      name: "Heavy",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        quantity: 1,
        weight: 0,
        carried: true,
        equipped: false,
        notes: "",
      },
    });
  });

  it("maps the elf street mage", () => {
    const draft = mapped(elf);
    expect(draft.actor.system.abilities.int).toEqual({ score: 17, primary: true });
    expect(draft.actor.system.abilities.dex).toEqual({ score: 16, primary: true });
    expect(draft.actor.system.attributes.hp).toEqual({ temp: 0, value: 6, max: 6 });
    expect(draft.actor.system.attributes.hitDie).toBe("d8");
    expect(draft.actor.system.attributes.speed).toEqual({ value: 10, bonus: 0 });
    expect(draft.actor.system.attributes.ac).toEqual({ bonus: 1 });
    expect(draft.actor.system.magic).toEqual({
      awakened: true,
      ability: "int",
      mp: { value: 15, maxBonus: 0 },
    });
    expect(draft.actor.system.proficiencies.armour).toEqual({
      light: true,
      medium: false,
      heavy: false,
    });
    expect(draft.actor.system.proficiencies.weapons).toEqual({
      meleeLight: true,
      meleeMedium: false,
      meleeHeavy: false,
      meleeTwoHandedHeavy: false,
      bows: true,
      crossbows: false,
      thrown: false,
      improvised: false,
      slings: false,
    });
    expect(draft.actor.system.identity).toEqual({
      concept: "An elf street mage who learned magic between jobs.",
      focus: "Caster",
      backgroundTier: 0,
      backgroundText: "Street Mage",
      speciesText: "Elf",
      languages: ["Common", "Elvish"],
      loyalty: "The corner of the ward that still hides him.",
    });
    expect(bonuses(elf)).toEqual({});
    expect(draft.actor.system.skills.controlMagic).toEqual({
      ability: "int",
      proficient: true,
      deepening: 0,
      expertise: false,
      bonus: 0,
    });
    expect(itemNames(elf)).toEqual([
      "feature:Elf",
      "feature:Street Mage",
      "feature:Alert",
      "feature:Great Memory",
      "feature:Vigilant",
      "feature:Finesse",
      "feature:Steady Mind",
      "feature:Lucky",
      "feature:Acute Vision",
      "feature:Awakened",
      "magicStream:Aggregate",
      "weapon:Dagger",
      "armour:Light",
    ]);
    expect(draft.items.find((item) => item.name === "Awakened")).toMatchObject({
      type: "feature",
      system: { category: "feat", effects: [], source: "pivot-chargen" },
    });
    expect(draft.items.find((item) => item.name === "Aggregate")).toEqual({
      type: "magicStream",
      name: "Aggregate",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        ability: "int",
        echelon: 1,
        notes: "",
      },
    });
    expect(draft.items.find((item) => item.name === "Light")).toEqual({
      type: "armour",
      name: "Light",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        category: "light",
        acBonus: 0,
        equipped: false,
        weight: 0,
        quantity: 1,
        carried: true,
        notes: "",
      },
    });
  });

  it("maps the dwarf recluse", () => {
    const draft = mapped(dwarf);
    expect(draft.actor.system.attributes.hp).toEqual({ temp: 0, value: 7, max: 7 });
    expect(draft.actor.system.attributes.speed).toEqual({ value: 8, bonus: 0 });
    expect(draft.actor.system.attributes.ac).toEqual({ bonus: 3 });
    expect(draft.actor.system.resources.pool).toEqual({ value: 1, maxBonus: -1 });
    expect(draft.actor.system.magic.mp).toEqual({ value: 0, maxBonus: 0 });
    expect(draft.actor.system.proficiencies).toMatchObject({
      armour: { light: true, medium: false, heavy: false },
      shields: true,
      weapons: {
        meleeLight: false,
        meleeMedium: true,
        meleeHeavy: false,
        meleeTwoHandedHeavy: false,
        bows: true,
        crossbows: false,
        thrown: false,
        improvised: false,
        slings: true,
      },
    });
    expect(draft.actor.system.identity).toEqual({
      concept: "A dwarf recluse who left the hold and does not want to be found.",
      focus: "Survivor",
      backgroundTier: 0,
      backgroundText: "Recluse",
      speciesText: "Dwarf",
      languages: ["Common", "Dwarvish"],
      loyalty: "The sister who still leaves food at the tree line.",
    });
    expect(bonuses(dwarf)).toEqual({ controlMagic: -1 });
    expect(draft.actor.system.skills.controlMagic).toEqual({
      ability: "int",
      proficient: false,
      deepening: 0,
      expertise: false,
      bonus: -1,
    });
    expect(draft.actor.system.skillSpecializations).toEqual({
      academia: [
        {
          name: "Geology",
          ability: "int",
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 0,
        },
      ],
      crafting: [
        {
          name: "Leatherworking",
          ability: "dex",
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 0,
        },
        {
          name: "Stoneworking",
          ability: "str",
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 0,
        },
      ],
    });
    expect(itemNames(dwarf)).toEqual([
      "feature:Dwarf",
      "feature:Recluse",
      "feature:Chronically Ill",
      "feature:Fearless",
      "feature:Olympian",
      "feature:Lucky",
      "feature:Acute Taste",
      "feature:Dodgy",
      "feature:Get Me Outta Here",
      "feature:Acute Hearing",
      "feature:Athletic",
      "feature:Acute Smell",
      "feature:Alert",
      "weapon:Hand axe",
      "armour:Light",
      "equipment:Shield",
    ]);
    expect(draft.items.find((item) => item.name === "Chronically Ill")).toMatchObject({
      type: "feature",
      system: { category: "flaw", effects: [], source: "pivot-chargen" },
    });
    expect(draft.items.find((item) => item.name === "Shield")).toMatchObject({
      type: "equipment",
      system: { quantity: 1, weight: 0, carried: true, equipped: false },
    });
  });

  it("maps the custom humanoid", () => {
    const draft = mapped(custom);
    expect(draft.actor.system.abilities.dex).toEqual({ score: 19, primary: true });
    expect(draft.actor.system.abilities.str).toEqual({ score: 7, primary: false });
    expect(draft.actor.system.attributes.hp).toEqual({ temp: 0, value: 5, max: 5 });
    expect(draft.actor.system.attributes.hitDie).toBe("d6");
    expect(draft.actor.system.attributes.speed).toEqual({ value: 7, bonus: 0 });
    expect(draft.actor.system.attributes.ac).toEqual({ bonus: 2 });
    expect(draft.actor.system.proficiencies.armour).toEqual({
      light: false,
      medium: false,
      heavy: false,
    });
    expect(draft.actor.system.proficiencies.weapons.meleeLight).toBe(true);
    expect(draft.actor.system.proficiencies.weapons.slings).toBe(false);
    expect(draft.actor.system.identity).toEqual({
      concept: "A small custom humanoid prodigy with a carapace and quick hands.",
      focus: "Sneak",
      backgroundTier: 0,
      backgroundText: "Prodigy",
      speciesText: "Custom Humanoid",
      languages: ["Common", "Orcish"],
      loyalty: "The crew that smuggled the carapace out of the pits.",
    });
    expect(draft.actor.system.notes).toEqual({ runesThaumaturgy: "", special: "Size: Small" });
    expect(bonuses(custom)).toEqual({
      alchemy: -2,
      animalHandling: -2,
      athletics: -2,
      controlMagic: -4,
      deception: -2,
      intimidation: -2,
      medicine: -2,
      medicineHolistic: -2,
      nature: -2,
      navigation: -2,
      performance: -2,
      persuasion: -2,
      religion: -2,
      survival: -2,
    });
    expect(draft.actor.system.skills.athletics).toEqual({
      ability: "dex",
      proficient: false,
      deepening: 0,
      expertise: false,
      bonus: -2,
    });
    expect(draft.actor.system.skills.thievery).toEqual({
      ability: "dex",
      proficient: true,
      deepening: 0,
      expertise: true,
      bonus: 0,
    });
    expect(draft.actor.system.skills.controlMagic).toEqual({
      ability: "int",
      proficient: false,
      deepening: 0,
      expertise: false,
      bonus: -4,
    });
    expect(draft.actor.system.skillSpecializations).toEqual({
      academia: [],
      crafting: [
        {
          name: "Fine Arts",
          ability: "dex",
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 0,
        },
      ],
    });
    expect(itemNames(custom)).toEqual([
      "feature:Custom Humanoid",
      "feature:Prodigy",
      "feature:Ambidexterity",
      "feature:Power to Weight Ratio",
      "feature:Lucky",
      "feature:Alert",
      "feature:Get Me Outta Here",
      "feature:Dodgy",
      "feature:Combat Reflexes",
      "feature:Finesse",
      "feature:Vigilant",
      "feature:Acute Touch",
      "feature:Chitinous Carapace",
      "feature:Adapted Vision",
      "weapon:Dagger",
      "equipment:Sidearms",
      "equipment:Tool",
    ]);
    expect(draft.items.find((item) => item.name === "Chitinous Carapace")).toMatchObject({
      type: "feature",
      system: { category: "humanoidAbility", effects: [], notes: "", source: "pivot-chargen" },
    });
  });

  it("writes species labels and skips an empty species", () => {
    for (const [species, label] of [
      ["halfling", "Halfling"],
      ["gnome", "Gnome"],
    ] as const) {
      const draft = mapped(edit(veteran, ["choices", "species"], species));
      expect(draft.actor.system.identity.speciesText).toBe(label);
      expect(draft.items[0]).toMatchObject({
        type: "feature",
        name: label,
        system: { category: "species" },
      });
    }

    const empty = mapped(edit(veteran, ["choices", "species"], ""));
    expect(empty.actor.system.identity.speciesText).toBe("");
    expect(empty.items.some((item) => item.system.category === "species")).toBe(false);
  });

  it("joins only the non-empty biography lines", () => {
    const noted = edit(veteran, ["choices", "look"], "Scarred");
    recordAt(noted, "choices").home = "The breach";
    recordAt(noted, "choices").notes = "Left the company";
    expect(mapped(noted).actor.system.notes.special).toBe(
      "Look: Scarred\nHome: The breach\nNotes: Left the company",
    );

    const sized = edit(custom, ["choices", "look"], "Scarred");
    expect(mapped(sized).actor.system.notes.special).toBe("Size: Small\nLook: Scarred");
  });

  it("stores digits as gp and any other money string as other", () => {
    expect(mapped(edit(veteran, ["choices", "money"], "40")).actor.system.currency).toEqual({
      gp: 40,
      sp: 0,
      cp: 0,
      other: "",
    });
    expect(mapped(edit(veteran, ["choices", "money"], "40gp")).actor.system.currency).toEqual({
      gp: 0,
      sp: 0,
      cp: 0,
      other: "40gp",
    });
  });

  it("sets dying when hit points are zero", () => {
    expect(
      mapped(edit(veteran, ["computed", "hp"], 0)).actor.system.attributes.deathSaves.status,
    ).toBe("dying");
  });

  it("uses a present computed.items list as the whole inventory", () => {
    const replaced = edit(
      veteran,
      ["computed", "items"],
      [
        {
          type: "feature",
          name: "From File",
          system: {
            category: "feat",
            effects: [{ type: "acBonus", amount: 1 }],
            notes: "kept",
            source: "file",
            flavour: "drop me",
          },
        },
        { type: "weapon", name: "Named Bow", system: { category: "bows", notes: "oak" } },
      ],
    );
    const draft = mapped(replaced);
    expect(draft.items.map((item) => item.name)).toEqual(["From File", "Named Bow"]);
    expect(draft.items[0]).toEqual({
      type: "feature",
      name: "From File",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        category: "feat",
        source: "file",
        cost: { pool: 0, mp: 0, bp: 0 },
        uses: { value: 0, max: 0 },
        notes: "kept",
      },
    });
    expect(draft.items[1]).toEqual({
      type: "weapon",
      name: "Named Bow",
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        category: "bows",
        attack: { ability: "str", bonus: 0 },
        damage: { formula: "", type: "", ability: null, bonus: 0 },
        range: { normal: 0, long: 0 },
        weight: 0,
        quantity: 1,
        carried: true,
        notes: "oak",
      },
    });
    expect(mapped(edit(veteran, ["computed", "items"], [])).items).toEqual([]);
  });

  it("skips choice shells whose names are empty", () => {
    const file = structuredClone(veteran);
    const choices = recordAt(file, "choices");
    choices.species = "";
    choices.bg = "";
    choices.feats = ["", "Lucky"];
    choices.freeO = "";
    choices.freeG = "";
    choices.roadWeapon = "";
    choices.blocks = [""];
    choices.issue = "";
    expect(itemNames(file)).toEqual(["feature:Lucky"]);
  });
});

describe("compareDrift", () => {
  it("emits a line only for a total that differs", () => {
    expect(compareDrift(open(elf), { ac: 14, poolMax: 1, mpMax: 11, speed: 10 })).toEqual([
      { field: "mp", file: 15, sheet: 11 },
    ]);
    expect(compareDrift(open(veteran), { ac: 16, poolMax: 1, mpMax: 0, speed: 10 })).toEqual([]);
    expect(compareDrift(open(dwarf), { ac: 14, poolMax: 1, mpMax: 0, speed: 8 })).toEqual([]);
    expect(compareDrift(open(veteran), { ac: 10, poolMax: 4, mpMax: 3, speed: 6 })).toEqual([
      { field: "ac", file: 16, sheet: 10 },
      { field: "pool", file: 1, sheet: 4 },
      { field: "mp", file: 0, sheet: 3 },
      { field: "speed", file: 10, sheet: 6 },
    ]);
  });
});

describe("pivot-character module", () => {
  it("imports neither Foundry nor the rules calculators", () => {
    const source = readFileSync(
      new URL("../../src/import/pivot-character.ts", import.meta.url),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line))
      .join("\n");
    expect(imports).not.toMatch(
      /foundry|character-derived|modifiers|abilityModifier|proficiencyBonusForLevel|calculateCharacterDerived/i,
    );
  });
});
