import { describe, expect, it } from "vitest";

import { canonicalSkills } from "../../src/config";
import { abilityModifier, proficiencyBonusForLevel } from "../../src/rules/modifiers";
import {
  prepareCharacterSheetContext,
  resolveSheetRoll,
  type ActorLike,
} from "../../src/sheets/character-sheet";
import sheetTemplate from "../../templates/actors/character-sheet.hbs?raw";

const abilityScores = {
  str: 16,
  dex: 14,
  con: 12,
  int: 10,
  wis: 13,
  cha: 8,
} as const;

type AbilityName = keyof typeof abilityScores;

interface RollableSkill {
  id: string;
  label: string;
  ability: AbilityName;
  proficient: boolean;
  deepening: number;
  expertise: boolean;
  bonus: number;
}

function scholar(): ActorLike {
  return {
    name: "Grawl",
    type: "character",
    system: {
      progression: { level: 5 },
      abilities: {
        str: { score: abilityScores.str, primary: true },
        dex: { score: abilityScores.dex, primary: false },
        con: { score: abilityScores.con, primary: false },
        int: { score: abilityScores.int, primary: false },
        wis: { score: abilityScores.wis, primary: true },
        cha: { score: abilityScores.cha, primary: false },
      },
      magic: { awakened: true, ability: "wis" },
      skills: {
        athletics: {
          ability: "str",
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 0,
        },
      },
      skillSpecializations: {
        academia: [
          {
            name: "History",
            ability: "int",
            proficient: true,
            deepening: 0,
            expertise: false,
            bonus: 0,
          },
          {
            name: " ",
            ability: "int",
            proficient: true,
            deepening: 0,
            expertise: false,
            bonus: 0,
          },
        ],
        crafting: [
          {
            name: "Stoneworking",
            ability: "str",
            proficient: true,
            deepening: 1,
            expertise: false,
            bonus: 0,
          },
        ],
      },
    },
    items: [],
  };
}

function rollableSkills(actor: ActorLike): RollableSkill[] {
  const system = actor.system;
  const storedSkills = isRecord(system.skills) ? system.skills : {};
  const magicValue = readPath(system, ["magic", "ability"]);
  const magicAbility: AbilityName = isAbilityName(magicValue) ? magicValue : "int";
  const catalog = canonicalSkills.map((skill) => {
    const storedValue = storedSkills[skill.id];
    const stored = isRecord(storedValue) ? storedValue : {};
    const fallback = skill.ability === "varies" ? magicAbility : skill.ability;
    return {
      id: skill.id,
      label: skill.label,
      ability: isAbilityName(stored.ability) ? stored.ability : fallback,
      proficient: stored.proficient === true,
      deepening: finiteNumber(stored.deepening, 0),
      expertise: stored.expertise === true,
      bonus: finiteNumber(stored.bonus, 0),
    };
  });
  const groups = isRecord(system.skillSpecializations) ? system.skillSpecializations : {};
  const specializations = Object.entries(groups).flatMap(([group, entries]) => {
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.name !== "string" || entry.name.trim() === "") {
        return [];
      }
      const ability = isAbilityName(entry.ability) ? entry.ability : "int";
      return [
        {
          id: `${group}:${entry.name.trim()}`,
          label: entry.name.trim(),
          ability,
          proficient: entry.proficient !== false,
          deepening: finiteNumber(entry.deepening, 0),
          expertise: entry.expertise === true,
          bonus: finiteNumber(entry.bonus, 0),
        },
      ];
    });
  });
  return [...catalog, ...specializations];
}

function expectedModifier(skill: RollableSkill): number {
  const proficiency = proficiencyBonusForLevel(5);
  const training = skill.proficient ? proficiency : 0;
  const expertise = skill.proficient && skill.expertise ? proficiency : 0;
  const deepening =
    skill.id === "controlMagic" ? 0 : Math.min(Math.max(0, skill.deepening), proficiency);
  return (
    abilityModifier(abilityScores[skill.ability]) + training + expertise + deepening + skill.bonus
  );
}

function renderSkillRows(rows: ReadonlyArray<{ id: string; label: string }>): string {
  const loop = sheetTemplate.match(/\{\{#each skillRows\}\}([\s\S]*?)\{\{\/each\}\}/);
  const body = loop?.[1];
  if (!body) {
    throw new Error("character sheet template has no skillRows loop");
  }
  return rows
    .map((row) =>
      body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match: string, key: string) => {
        if (key !== "id" && key !== "label") return "";
        return row[key];
      }),
    )
    .join("");
}

function skillRollButtons(markup: string): Array<{ key: string; label: string }> {
  const buttons: Array<{ key: string; label: string }> = [];
  for (const match of markup.matchAll(/<button\b([^>]*)>/g)) {
    const attrs = match[1] ?? "";
    if (!attrs.includes('data-action="roll"') || !attrs.includes('data-roll-kind="skill"')) {
      continue;
    }
    const key = attrs.match(/data-key="([^"]*)"/)?.[1];
    const label = attrs.match(/data-label="([^"]*)"/)?.[1];
    if (key && label !== undefined) buttons.push({ key, label });
  }
  return buttons;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbilityName(value: unknown): value is AbilityName {
  return typeof value === "string" && value in abilityScores;
}

function readPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

describe("skill roll controls", () => {
  it("renders a roll control for every rollable skill and rolls that skill", () => {
    const actor = scholar();
    const context = prepareCharacterSheetContext(actor);
    const expected = rollableSkills(actor);
    const buttons = skillRollButtons(renderSkillRows(context.skillRows));

    expect(buttons.map((button) => button.key)).toEqual(expected.map((skill) => skill.id));

    for (const skill of expected) {
      const button = buttons.find((entry) => entry.key === skill.id);
      expect(button, skill.id).toMatchObject({ label: skill.label });
      expect(
        resolveSheetRoll(
          { dataset: { rollKind: "skill", key: button?.key, label: button?.label } },
          context,
        ),
      ).toMatchObject({
        kind: "d20",
        rollKind: "skill",
        label: skill.label,
        modifier: expectedModifier(skill),
        applyAttackCrit: false,
      });
    }
  });
});
