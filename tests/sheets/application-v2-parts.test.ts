import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { prepareCharacterSheetContext } from "../../src/sheets/character-sheet";
import { prepareNpcSheetContext } from "../../src/sheets/npc-sheet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load all character part templates
const CHARACTER_TEMPLATE_DIR = join(__dirname, "../../templates/actors/character");
const CHARACTER_PARTS = [
  "header",
  "vitals",
  "tabs",
  "sheet",
  "survival",
  "inventory",
  "magic",
  "notes",
];

// NPC sheet has only one PARTS entry: form -> npc-sheet.hbs
const NPC_TEMPLATE_PATH = join(__dirname, "../../templates/actors/npc-sheet.hbs");

// NPC fixture for context (with items to test {{#if items}} true branch)
const npcWithItemsFixture = {
  id: "test-npc-goblin",
  name: "Goblin Scout",
  type: "npc",
  system: {
    tier: "gonk",
    creatureType: "humanoid",
    overlay: "none",
    attributes: {
      hp: { value: 15, max: 20 },
      ac: 14,
      speed: 8,
    },
    combatBonuses: {
      physical: 2,
      intellectual: -1,
    },
    cr: "1/2",
    biography: "A sneaky goblin scout.",
  },
  items: [
    { id: "item-1", name: "Shortsword", type: "weapon", system: {} },
    { id: "item-2", name: "Leather Armor", type: "armour", system: {} },
  ],
};

// NPC fixture without items (to test {{#if items}} false branch / {{else}})
const npcWithoutItemsFixture = {
  id: "test-npc-skeleton",
  name: "Skeleton Warrior",
  type: "npc",
  system: {
    tier: "gonk",
    creatureType: "undead",
    overlay: "undead",
    attributes: {
      hp: { value: 10, max: 10 },
      ac: 12,
      speed: 6,
    },
    combatBonuses: {
      physical: 1,
      intellectual: -2,
    },
    cr: "1/4",
    biography: "An animated skeleton.",
  },
  items: [], // Empty items array to trigger {{else}} branch
};
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
  items: [
    {
      id: "flaw-addiction",
      name: "Addiction",
      type: "feature",
      system: {
        category: "flaw",
        cost: { gp: 0, bp: 1 },
        description: "Compelled to seek a specific substance.",
      },
    },
  ],
};

// Register Handlebars helpers that templates expect
Handlebars.registerHelper("localize", (key: string) => key);
Handlebars.registerHelper("checked", (value: boolean) => (value ? "checked" : ""));
Handlebars.registerHelper("selectOptions", () => "");

describe("ApplicationV2 PARTS single root element requirement", () => {
  describe("Character sheet PARTS", () => {
    CHARACTER_PARTS.forEach((partName) => {
      it(`${partName}.hbs renders exactly one root element`, () => {
        // Load template
        const templatePath = join(CHARACTER_TEMPLATE_DIR, `${partName}.hbs`);
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
          (node): node is Text => node.nodeType === 3 && (node.textContent?.trim() ?? "") !== "",
        );

        if (rootTextNodes.length > 0) {
          throw new Error(
            `${partName}.hbs has non-whitespace text at root level: "${rootTextNodes.map((n) => n.textContent ?? "").join(" ")}"`,
          );
        }

        // Check for exactly one root element
        const rootElements = Array.from(body.children);
        if (rootElements.length !== 1) {
          throw new Error(
            `${partName}.hbs must render exactly one root element, found ${rootElements.length}: ${Array.from(rootElements, (el) => el.tagName).join(", ")}`,
          );
        }

        // Verify it's a proper HTML element
        const root = rootElements[0] as Element;
        expect(root.tagName).toBeTruthy();
        console.log(
          `✓ character/${partName}.hbs renders <${root.tagName.toLowerCase()}> as single root`,
        );
      });
    });
  });

  describe("NPC sheet PARTS", () => {
    it("npc-sheet.hbs renders exactly one root element (with items)", () => {
      // Load template
      const templateSource = readFileSync(NPC_TEMPLATE_PATH, "utf-8");
      const template = Handlebars.compile(templateSource);

      // Prepare context with items (tests {{#if items}} true branch)
      const context = { ...prepareNpcSheetContext(npcWithItemsFixture), rootId: "test-npc" };

      // Render HTML
      const html = template(context);

      // Parse with JSDOM
      const dom = new JSDOM(html);
      const { document } = dom.window;
      const body = document.body;

      // Check for non-whitespace text nodes at root level
      const rootTextNodes = Array.from(body.childNodes).filter(
        (node): node is Text => node.nodeType === 3 && (node.textContent?.trim() ?? "") !== "",
      );

      if (rootTextNodes.length > 0) {
        throw new Error(
          `npc-sheet.hbs has non-whitespace text at root level: "${rootTextNodes.map((n) => n.textContent ?? "").join(" ")}"`,
        );
      }

      // Check for exactly one root element
      const rootElements = Array.from(body.children);
      if (rootElements.length !== 1) {
        throw new Error(
          `npc-sheet.hbs must render exactly one root element, found ${rootElements.length}: ${Array.from(rootElements, (el) => el.tagName).join(", ")}`,
        );
      }

      // Verify it's a proper HTML element
      const root = rootElements[0] as Element;
      expect(root.tagName).toBeTruthy();
      console.log(
        `✓ npc-sheet.hbs (with items) renders <${root.tagName.toLowerCase()}> as single root`,
      );
    });

    it("npc-sheet.hbs renders exactly one root element (without items, {{else}} branch)", () => {
      // Load template
      const templateSource = readFileSync(NPC_TEMPLATE_PATH, "utf-8");
      const template = Handlebars.compile(templateSource);

      // Prepare context without items (tests {{#if items}} false branch / {{else}})
      const context = {
        ...prepareNpcSheetContext(npcWithoutItemsFixture),
        rootId: "test-npc-empty",
      };

      // Render HTML
      const html = template(context);

      // Parse with JSDOM
      const dom = new JSDOM(html);
      const { document } = dom.window;
      const body = document.body;

      // Check for non-whitespace text nodes at root level
      const rootTextNodes = Array.from(body.childNodes).filter(
        (node): node is Text => node.nodeType === 3 && (node.textContent?.trim() ?? "") !== "",
      );

      if (rootTextNodes.length > 0) {
        throw new Error(
          `npc-sheet.hbs (empty) has non-whitespace text at root level: "${rootTextNodes.map((n) => n.textContent ?? "").join(" ")}"`,
        );
      }

      // Check for exactly one root element
      const rootElements = Array.from(body.children);
      if (rootElements.length !== 1) {
        throw new Error(
          `npc-sheet.hbs (empty) must render exactly one root element, found ${rootElements.length}: ${Array.from(rootElements, (el) => el.tagName).join(", ")}`,
        );
      }

      // Verify it's a proper HTML element
      const root = rootElements[0] as Element;
      expect(root.tagName).toBeTruthy();
      console.log(
        `✓ npc-sheet.hbs (without items, {{else}}) renders <${root.tagName.toLowerCase()}> as single root`,
      );
    });
  });
});
