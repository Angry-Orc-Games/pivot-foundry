#!/usr/bin/env node

import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { chromium } from "playwright";

// Sample character data
const sampleActor = {
  id: "actor-test-123",
  name: "Grawl Ironheart",
  type: "character",
  system: {
    progression: { level: 5, xp: 6500 },
    identity: {
      player: "Test Player",
      backgroundText: "Soldier",
      speciesText: "Dwarf",
      languages: ["Common", "Dwarven"],
      loyalty: "Order of the Silver Flame",
      weight: { value: 180 },
      height: "4'8\"",
      age: "85",
      eyes: "Brown",
      hair: "Black",
    },
    abilities: {
      str: { score: 16, primary: true },
      dex: { score: 14, primary: false },
      con: { score: 15, primary: true },
      int: { score: 10, primary: false },
      wis: { score: 13, primary: false },
      cha: { score: 8, primary: false },
    },
    attributes: {
      ac: { bonus: 0 },
      initiative: { bonus: 0 },
      passivePerception: { mode: "normal" },
      hp: { value: 38, max: 45, temp: 0 },
      hitDie: "d10",
      speed: { value: 25, bonus: 0 },
      deathSaves: { status: "alive", successes: 0, failures: 0 },
    },
    resources: { pool: { value: 4, maxBonus: 0 } },
    proficiencies: {
      armour: { light: true, medium: true, heavy: true },
      shields: true,
      weapons: {
        meleeLight: true,
        meleeMedium: true,
        meleeHeavy: true,
        meleeTwoHandedHeavy: true,
      },
      instruments: ["Drums"],
    },
    skills: {
      athletics: { ability: "str", proficient: true, deepening: 0, expertise: false, bonus: 0 },
      perception: {
        ability: "wis",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
      intimidation: {
        ability: "cha",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
    },
    skillSpecializations: {
      academia: [],
      crafting: [{ name: "Smithing", ability: "int", proficient: true }],
    },
    currency: { gp: 250, sp: 50, cp: 10, other: "" },
    magic: {
      awakened: false,
      ability: null,
      mp: { value: 0, maxBonus: 0 },
    },
    notes: {
      runesThaumaturgy: "",
      special: "Dwarven Resilience: Advantage on saving throws against poison.",
    },
  },
};

// Helper functions
const localize = (key) => {
  const translations = {
    "PIVOT.Fields.CharacterName": "Character Name",
    "PIVOT.Fields.Level": "Level",
    "PIVOT.Fields.XP": "XP",
    "PIVOT.Sections.Abilities": "Abilities",
    "PIVOT.Fields.Score": "Score",
    "PIVOT.Fields.Primary": "Primary",
    "PIVOT.Tabs.Core": "Core",
    "PIVOT.Tabs.Skills": "Skills",
    "PIVOT.Tabs.Combat": "Combat",
    "PIVOT.Tabs.Equipment": "Equipment",
    "PIVOT.Tabs.Magic": "Magic",
    "PIVOT.Tabs.Features": "Features",
    "PIVOT.Sheets.Character.Navigation": "Character Sheet Navigation",
    "PIVOT.Sections.Identity": "Identity",
    "PIVOT.Sections.Resources": "Resources",
    "PIVOT.Fields.Player": "Player",
    "PIVOT.Fields.Background": "Background",
    "PIVOT.Fields.Species": "Species",
    "PIVOT.Fields.Languages": "Languages",
    "PIVOT.Fields.Loyalty": "Loyalty",
    "PIVOT.Fields.Weight": "Weight",
    "PIVOT.Fields.Height": "Height",
    "PIVOT.Fields.Age": "Age",
    "PIVOT.Fields.Eyes": "Eyes",
    "PIVOT.Fields.Hair": "Hair",
    "PIVOT.Fields.AcademiaSpecializations": "Academia Specializations",
    "PIVOT.Fields.CraftingSpecializations": "Crafting Specializations",
    "PIVOT.Fields.ProfBonus": "Prof Bonus",
    "PIVOT.Fields.ArmourClass": "AC",
    "PIVOT.Fields.Initiative": "Initiative",
    "PIVOT.Fields.Speed": "Speed",
    "PIVOT.Fields.PassivePerception": "Passive Perception",
    "PIVOT.Rolls.Initiative": "Initiative",
    "PIVOT.Sections.Vitality": "Vitality",
    "PIVOT.Fields.HPMax": "HP Max",
    "PIVOT.Fields.HPCurrent": "Current HP",
    "PIVOT.Fields.Pool": "Pool",
    "PIVOT.Actions.DecreasePool": "Decrease Pool",
    "PIVOT.Actions.IncreasePool": "Increase Pool",
    "PIVOT.Actions.RecoverPoolLongRest": "Recover Pool (Long Rest)",
    "PIVOT.Fields.HitDie": "Hit Die",
    "PIVOT.Actions.ShortRest": "Short Rest",
    "PIVOT.Actions.LongRest": "Long Rest",
    "PIVOT.Sections.Survival": "Survival",
    "PIVOT.Survival.alive": "Alive",
    "PIVOT.Survival.Temp": "Temp HP",
    "PIVOT.Survival.RollTitle": "Survival Roll",
    "PIVOT.Survival.DeathSave": "Death Save",
    "PIVOT.Survival.ClearTemp": "Clear Temp HP",
    "PIVOT.Survival.ManualConsequences": "Apply death and stabilization manually.",
    "PIVOT.Fields.Successes": "Successes",
    "PIVOT.Fields.Failures": "Failures",
    "PIVOT.Sections.Skills": "Skills",
    "PIVOT.Fields.Deepening": "Deepening",
    "PIVOT.Fields.Bonus": "Bonus",
    "PIVOT.Fields.Expertise": "Expertise",
    "PIVOT.Sections.Proficiencies": "Proficiencies",
    "PIVOT.Proficiencies.ArmourLight": "Light Armour",
    "PIVOT.Proficiencies.ArmourMedium": "Medium Armour",
    "PIVOT.Proficiencies.ArmourHeavy": "Heavy Armour",
    "PIVOT.Proficiencies.Shields": "Shields",
    "PIVOT.Proficiencies.Bows": "Bows",
    "PIVOT.Proficiencies.Crossbows": "Crossbows",
    "PIVOT.Proficiencies.Thrown": "Thrown",
    "PIVOT.Proficiencies.MeleeLight": "Melee Light",
    "PIVOT.Proficiencies.MeleeMedium": "Melee Medium",
    "PIVOT.Proficiencies.MeleeHeavy": "Melee Heavy",
    "PIVOT.Proficiencies.MeleeTwoHanded": "Melee Two-Handed",
    "PIVOT.Proficiencies.Improvised": "Improvised",
    "PIVOT.Fields.Instruments": "Instruments",
    "PIVOT.Fields.Other": "Other",
  };
  return translations[key] || key;
};

const checked = (value) => (value ? "checked" : "");

// Import the context preparation function
const abilities = [
  { key: "str", label: "Strength", short: "STR" },
  { key: "dex", label: "Dexterity", short: "DEX" },
  { key: "con", label: "Constitution", short: "CON" },
  { key: "int", label: "Intelligence", short: "INT" },
  { key: "wis", label: "Wisdom", short: "WIS" },
  { key: "cha", label: "Charisma", short: "CHA" },
];

// Simplified context preparation (just what we need for rendering)
function prepareSimpleContext() {
  const abilityRows = abilities.map(({ key, label }) => {
    const score = sampleActor.system.abilities[key].score;
    const primary = sampleActor.system.abilities[key].primary;
    const mod = Math.floor((score - 10) / 2);
    const profBonus = 3; // Level 5
    const save = mod + (primary ? profBonus : 0);

    return {
      key,
      label,
      scorePath: `system.abilities.${key}.score`,
      primaryPath: `system.abilities.${key}.primary`,
      score,
      primary,
      mod: mod >= 0 ? `+${mod}` : String(mod),
      save: save >= 0 ? `+${save}` : String(save),
      disabledAttr: "",
    };
  });

  return {
    actor: sampleActor,
    system: sampleActor.system,
    rootId: "test-sheet",
    disabledAttr: "",
    abilityRows,
    tabs: {
      core: { cssClass: "active" },
      skills: { cssClass: "" },
      combat: { cssClass: "" },
      equipment: { cssClass: "" },
      magic: { cssClass: "" },
      features: { cssClass: "" },
    },
    form: {
      languagesText: "Common, Dwarven",
      instrumentsText: "Drums",
      academiaText: "",
      craftingText: "Smithing",
    },
    derived: {
      proficiencyBonus: 3,
      armourClass: { value: 17, breakdown: "Base 10 + Heavy Armour 7", armourWorn: "Heavy Armour" },
      initiative: 2,
      passivePerception: 14,
      pool: { max: 5 },
      magic: { mp: { max: 0 } },
      totalWeight: 82,
      abilities: {
        str: { mod: 3 },
        dex: { mod: 2 },
        con: { mod: 2 },
        int: { mod: 0 },
        wis: { mod: 1 },
        cha: { mod: -1 },
      },
      saves: {
        str: 6,
        dex: 2,
        con: 5,
        int: 0,
        wis: 1,
        cha: -1,
      },
      skills: {
        athletics: { total: 6 },
        perception: { total: 4 },
        intimidation: { total: 2 },
      },
    },
    hpPercent: Math.round((38 / 45) * 100),
    poolPercent: Math.round((4 / 5) * 100),
    survivalStatus: "alive",
    survivalLabel: "PIVOT.Survival.alive",
    deathSaveSuccessPips: [false, false, false],
    deathSaveFailurePips: [false, false, false],
    isGM: false,
    skillRows: [],
    items: {
      weapons: [],
      armour: [],
      equipment: [],
      features: [],
      magicStreams: [],
      magicAbilities: [],
    },
    config: {
      hitDiceChoices: { d6: "d6", d8: "d8", d10: "d10", d12: "d12" },
    },
  };
}

// Register Handlebars helpers
Handlebars.registerHelper("localize", localize);
Handlebars.registerHelper("checked", checked);
Handlebars.registerHelper("selectOptions", () => "");

async function renderScreenshots() {
  console.log("Loading template and CSS...");

  const templatePath = resolve(process.cwd(), "templates/actors/character-sheet.hbs");
  const cssPath = resolve(process.cwd(), "styles/pivot-fantasy.css");

  const templateSource = readFileSync(templatePath, "utf-8");
  const css = readFileSync(cssPath, "utf-8");

  const template = Handlebars.compile(templateSource);
  const context = prepareSimpleContext();

  console.log("Rendering template...");
  const html = template(context);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
      background: #19202a;
    }
    .window-content {
      overflow: hidden;
    }
    ${css}
    /* Override for standalone rendering */
    .pivot-character-sheet {
      background: #f1eadb;
    }
    input, select, textarea, button {
      font-family: inherit;
      font-size: inherit;
    }
    label {
      cursor: default;
    }
    input[type="number"],
    input[type="text"] {
      border: 1px solid #8a7b68;
      border-radius: 4px;
      padding: 4px 6px;
    }
    input[type="number"]:focus,
    input[type="text"]:focus {
      outline: 2px solid #2f6fed;
      outline-offset: 1px;
    }
    select {
      border: 1px solid #8a7b68;
      border-radius: 4px;
      padding: 4px 6px;
      background: white;
    }
  </style>
</head>
<body>
  <div class="window-content">
    ${html}
  </div>
</body>
</html>
`;

  console.log("Launching browser...");
  const browser = await chromium.launch();
  const artifactsDir = "/opt/cursor/artifacts";
  mkdirSync(artifactsDir, { recursive: true });

  async function captureScreenshot(width, height, name, scrollConfig = {}) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2, // Retina for better quality
    });

    await page.setContent(fullHtml);

    if (scrollConfig.selector && scrollConfig.scrollTop) {
      await page.locator(scrollConfig.selector).evaluate((el, scrollTop) => {
        el.scrollTop = scrollTop;
      }, scrollConfig.scrollTop);
    }

    const outputPath = `${artifactsDir}/${name}`;
    await page.screenshot({
      path: outputPath,
      clip: { x: 0, y: 0, width, height },
    });

    console.log(`Screenshot saved: ${outputPath}`);
    await page.close();
  }

  // Update context for Skills tab
  function setSkillsTab() {
    context.tabs.core.cssClass = "";
    context.tabs.skills.cssClass = "active";
  }

  console.log("Capturing screenshots...");

  // (a) 960x760 on the Core tab
  await captureScreenshot(960, 760, "sheet-960x760-core.png");

  // (b) about 700px wide
  await captureScreenshot(700, 760, "sheet-700x760.png");

  // (c) 620px wide (the minimum)
  await captureScreenshot(620, 760, "sheet-620x760-minimum.png");

  // (d) 960x760 on the Skills tab scrolled partway
  setSkillsTab();
  const htmlSkills = template(context);
  const fullHtmlSkills = fullHtml.replace(html, htmlSkills);

  const page = await browser.newPage({
    viewport: { width: 960, height: 760 },
    deviceScaleFactor: 2,
  });

  await page.setContent(fullHtmlSkills);

  // Scroll the tab body partway
  await page.locator(".pivot-tab-body").evaluate((el) => {
    el.scrollTop = 150;
  });

  await page.screenshot({
    path: `${artifactsDir}/sheet-960x760-skills-scrolled.png`,
    clip: { x: 0, y: 0, width: 960, height: 760 },
  });

  console.log(`Screenshot saved: ${artifactsDir}/sheet-960x760-skills-scrolled.png`);
  await page.close();

  await browser.close();
  console.log("All screenshots captured successfully!");
}

renderScreenshots().catch((err) => {
  console.error("Error rendering screenshots:", err);
  process.exit(1);
});
