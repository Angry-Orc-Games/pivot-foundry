import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { prepareCharacterSheetContext } from "../../src/sheets/character-sheet";

// Load all character part templates
const TEMPLATE_DIR = join(__dirname, "../../templates/actors/character");
const PARTS = ["header", "vitals", "tabs", "sheet", "survival", "inventory", "magic", "notes"];

// Joe fixture for context
const joeFixture = {
  id: "test-actor-joe",
  name: "Joe",
  type: "character",
  system: {
    identity: {
      concept: "Former mercenary that likes Kitty",
      focus: "Food: Only dead fighter",
      speciesText: "Elf",
      backgroundText: "Privileged",
      backgroundTier: 3,
      loyalty: "The Group",
      languages: ["Common", "Elvish", "Dwarven", "Draconic"],
    },
    progression: {
      level: 9,
      xp: 10,
      buildPoints: 10,
      progressionPoints: 0,
    },
    attributes: {
      hp: { value: 47, max: 71, temp: 0 },
      hitDie: "d8",
      ac: { bonus: 0 },
      initiative: { bonus: 0 },
      speed: { value: 10, bonus: 0 },
      passivePerception: { mode: "normal" },
      deathSaves: { successes: 0, failures: 0 },
    },
    resources: {
      pool: { value: 9, maxBonus: 0 },
    },
    abilities: {
      str: { score: 15, primary: false },
      dex: { score: 17, primary: true },
      con: { score: 15, primary: false },
      int: { score: 17, primary: true },
      wis: { score: 15, primary: false },
      cha: { score: 15, primary: false },
    },
    skills: {
      athletics: { ability: "str", proficient: true, deepening: 0, expertise: false, bonus: 0 },
      deception: { ability: "cha", proficient: false, deepening: 0, expertise: false, bonus: 0 },
      insight: { ability: "wis", proficient: false, deepening: 0, expertise: false, bonus: 0 },
      investigation: { ability: "int", proficient: true, deepening: 0, expertise: false, bonus: 0 },
      perception: { ability: "wis", proficient: true, deepening: 0, expertise: false, bonus: 0 },
      acrobatics: { ability: "dex", proficient: false, deepening: 0, expertise: false, bonus: 0 },
    },
    proficiencies: {
      armour: { light: true, medium: true, heavy: false },
      shields: false,
      weapons: {
        bows: true,
        crossbows: false,
        thrown: true,
        meleeLight: true,
        meleeMedium: true,
        meleeHeavy: false,
        meleeTwoHandedHeavy: false,
        improvised: false,
      },
      instruments: [],
    },
    skillSpecializations: {
      academia: [],
      crafting: [],
    },
    magic: {
      awakened: true,
      ability: "int",
      mp: { value: 15, maxBonus: 0 },
    },
    currency: { gp: 0, sp: 0, cp: 0, other: "" },
  },
  items: [],
};

// Register Handlebars helpers that templates expect
Handlebars.registerHelper("localize", (key: string) => key);
Handlebars.registerHelper("checked", (value: boolean) => (value ? "checked" : ""));
Handlebars.registerHelper("selectOptions", () => "");

describe("ApplicationV2 PARTS single root element requirement", () => {
  PARTS.forEach((partName) => {
    it(`${partName}.hbs renders exactly one root element`, () => {
      // Load template
      const templatePath = join(TEMPLATE_DIR, `${partName}.hbs`);
      const templateSource = readFileSync(templatePath, "utf-8");
      const template = Handlebars.compile(templateSource);

      // Prepare context
      const context = prepareCharacterSheetContext(joeFixture, true);

      // Render HTML
      const html = template(context);

      // Parse with JSDOM
      const dom = new JSDOM(html);
      const { document } = dom.window;
      const body = document.body;

      // Check for non-whitespace text nodes at root level
      const rootTextNodes = Array.from(body.childNodes).filter(
        (node) => node.nodeType === 3 && node.textContent?.trim() !== "",
      );

      if (rootTextNodes.length > 0) {
        throw new Error(
          `${partName}.hbs has non-whitespace text at root level: "${rootTextNodes.map((n) => n.textContent).join(" ")}"`,
        );
      }

      // Check for exactly one root element
      const rootElements = Array.from(body.children);
      if (rootElements.length !== 1) {
        throw new Error(
          `${partName}.hbs must render exactly one root element, found ${rootElements.length}: ${rootElements.map((el) => el.tagName).join(", ")}`,
        );
      }

      // Verify it's a proper HTML element
      const root = rootElements[0];
      expect(root?.tagName).toBeTruthy();
      console.log(`✓ ${partName}.hbs renders <${root?.tagName?.toLowerCase()}> as single root`);
    });
  });
});
