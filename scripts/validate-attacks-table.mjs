import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load templates
const TEMPLATE_DIR = join(__dirname, "../templates/actors/character");
const header = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "header.hbs"), "utf-8"));
const vitals = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "vitals.hbs"), "utf-8"));
const tabs = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "tabs.hbs"), "utf-8"));
const sheet = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "sheet.hbs"), "utf-8"));

// Load CSS
const tokens = readFileSync(join(__dirname, "../styles/pf-tokens.css"), "utf-8");
const css = readFileSync(join(__dirname, "../styles/pivot-fantasy.css"), "utf-8");

// Load localization
const enJson = JSON.parse(readFileSync(join(__dirname, "../lang/en.json"), "utf-8"));

// Register helpers
Handlebars.registerHelper("localize", (key) => enJson[key] || key);
Handlebars.registerHelper("checked", (value) => (value ? "checked" : ""));
Handlebars.registerHelper("selectOptions", () => "");

// Joe fixture with flaw
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
      id: "weapon-1",
      name: "Shortsword",
      type: "weapon",
      system: {
        category: "meleeLight",
        attack: { ability: "dex", bonus: 0 },
        damage: { ability: null, bonus: 0, formula: "1d6" },
        range: { normal: 0, long: 0 },
      },
    },
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
    {
      id: "feat-tough",
      name: "Tough",
      type: "feature",
      system: { category: "feat", cost: { gp: 0 }, description: "Increases HP." },
    },
  ],
};

// Generate HTML wrapper
function generateHTML(theme, content, width) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: ${theme === "theme-dark" ? "#0d0b09" : "#f0f0f0"};
    }
    ${tokens}
    ${css}
  </style>
</head>
<body class="${theme} pivot-fantasy">
  <div class="pf-sheet" style="container-type: inline-size; width: ${width}px; margin: 0 auto;">
    <div class="pf-character-sheet pf-print-wrap">
      ${content}
    </div>
  </div>
</body>
</html>
`;
}

async function validateAttacksTable() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test with 640px light theme
  const data = {
    actor: joeFixture,
    editable: false,
    disabledAttr: "disabled",
    system: joeFixture.system,
    speciesLabel: "Elf",
    backgroundLabel: "Privileged",
    tierLabel: "",
    conMod: "+2",
    proficiencyText: {
      weapons: "Bows, Thrown, Melee Light, Melee Medium",
      armour: "Light, Medium",
      shields: "No",
    },
    magicStreamsText: "",
    form: {
      languagesText: "Common, Elvish, Dwarven, Draconic",
      instrumentsText: "",
      academiaText: "",
      craftingText: "",
    },
    config: {
      abilities: [
        { key: "str", label: "Strength", short: "STR" },
        { key: "dex", label: "Dexterity", short: "DEX" },
        { key: "con", label: "Constitution", short: "CON" },
        { key: "int", label: "Intelligence", short: "INT" },
        { key: "wis", label: "Wisdom", short: "WIS" },
        { key: "cha", label: "Charisma", short: "CHA" },
      ],
      magicAbilities: [],
      skills: [],
      hitDice: [],
      hitDiceChoices: {},
      weaponCategories: [],
      armourCategories: [],
      featureCategories: [],
    },
    derived: {
      armourClass: {
        value: 15,
        breakdown: "10 + DEX 3 + Medium 2",
        armourWorn: "Medium armour (Large Shield)",
      },
      speed: { value: 10 },
      proficiencyBonus: 4,
      initiative: "+7",
      passivePerception: 17,
      pool: { max: 9 },
      magic: { mp: { max: 15 } },
      totalWeight: 0,
      abilities: {
        str: { mod: 2 },
        dex: { mod: 3 },
        con: { mod: 2 },
        int: { mod: 3 },
        wis: { mod: 2 },
        cha: { mod: 2 },
      },
      saves: {
        str: 2,
        dex: 7,
        con: 2,
        int: 7,
        wis: 2,
        cha: 2,
      },
      skills: {
        athletics: { total: 6 },
        deception: { total: 2 },
        insight: { total: 2 },
        investigation: { total: 7 },
        perception: { total: 6 },
        acrobatics: { total: 3 },
      },
      proficiencies: {
        armour: { light: true, medium: true, heavy: false },
        shields: false,
        weapons: {},
      },
    },
    abilityRows: [
      {
        key: "str",
        label: "Strength",
        short: "STR",
        scorePath: "system.abilities.str.score",
        primaryPath: "system.abilities.str.primary",
        score: 15,
        primary: false,
        mod: "+2",
        save: "+2",
        abilityClass: "pf-ab",
        disabledAttr: "disabled",
      },
      {
        key: "dex",
        label: "Dexterity",
        short: "DEX",
        scorePath: "system.abilities.dex.score",
        primaryPath: "system.abilities.dex.primary",
        score: 17,
        primary: true,
        mod: "+3",
        save: "+7",
        abilityClass: "pf-ab pf-prime",
        disabledAttr: "disabled",
      },
      {
        key: "con",
        label: "Constitution",
        short: "CON",
        scorePath: "system.abilities.con.score",
        primaryPath: "system.abilities.con.primary",
        score: 15,
        primary: false,
        mod: "+2",
        save: "+2",
        abilityClass: "pf-ab",
        disabledAttr: "disabled",
      },
      {
        key: "int",
        label: "Intelligence",
        short: "INT",
        scorePath: "system.abilities.int.score",
        primaryPath: "system.abilities.int.primary",
        score: 17,
        primary: true,
        mod: "+3",
        save: "+7",
        abilityClass: "pf-ab pf-prime",
        disabledAttr: "disabled",
      },
      {
        key: "wis",
        label: "Wisdom",
        short: "WIS",
        scorePath: "system.abilities.wis.score",
        primaryPath: "system.abilities.wis.primary",
        score: 15,
        primary: false,
        mod: "+2",
        save: "+2",
        abilityClass: "pf-ab",
        disabledAttr: "disabled",
      },
      {
        key: "cha",
        label: "Charisma",
        short: "CHA",
        scorePath: "system.abilities.cha.score",
        primaryPath: "system.abilities.cha.primary",
        score: 15,
        primary: false,
        mod: "+2",
        save: "+2",
        abilityClass: "pf-ab",
        disabledAttr: "disabled",
      },
    ],
    skillRows: [
      {
        id: "athletics",
        label: "Athletics",
        ability: "STR",
        abilityPath: "system.skills.athletics.ability",
        proficientPath: "system.skills.athletics.proficient",
        deepeningPath: "system.skills.athletics.deepening",
        expertisePath: "system.skills.athletics.expertise",
        bonusPath: "system.skills.athletics.bonus",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
        total: "+6",
        disabledAttr: "disabled",
      },
      {
        id: "investigation",
        label: "Investigation",
        ability: "INT",
        abilityPath: "system.skills.investigation.ability",
        proficientPath: "system.skills.investigation.proficient",
        deepeningPath: "system.skills.investigation.deepening",
        expertisePath: "system.skills.investigation.expertise",
        bonusPath: "system.skills.investigation.bonus",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
        total: "+7",
        disabledAttr: "disabled",
      },
      {
        id: "perception",
        label: "Perception",
        ability: "WIS",
        abilityPath: "system.skills.perception.ability",
        proficientPath: "system.skills.perception.proficient",
        deepeningPath: "system.skills.perception.deepening",
        expertisePath: "system.skills.perception.expertise",
        bonusPath: "system.skills.perception.bonus",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
        total: "+6",
        disabledAttr: "disabled",
      },
      {
        id: "acrobatics",
        label: "Acrobatics",
        ability: "DEX",
        abilityPath: "system.skills.acrobatics.ability",
        proficientPath: "system.skills.acrobatics.proficient",
        deepeningPath: "system.skills.acrobatics.deepening",
        expertisePath: "system.skills.acrobatics.expertise",
        bonusPath: "system.skills.acrobatics.bonus",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
        total: "+3",
        disabledAttr: "disabled",
      },
      {
        id: "deception",
        label: "Deception",
        ability: "CHA",
        abilityPath: "system.skills.deception.ability",
        proficientPath: "system.skills.deception.proficient",
        deepeningPath: "system.skills.deception.deepening",
        expertisePath: "system.skills.deception.expertise",
        bonusPath: "system.skills.deception.bonus",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
        total: "+2",
        disabledAttr: "disabled",
      },
      {
        id: "insight",
        label: "Insight",
        ability: "WIS",
        abilityPath: "system.skills.insight.ability",
        proficientPath: "system.skills.insight.proficient",
        deepeningPath: "system.skills.insight.deepening",
        expertisePath: "system.skills.insight.expertise",
        bonusPath: "system.skills.insight.bonus",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
        total: "+2",
        disabledAttr: "disabled",
      },
    ],
    items: {
      weapons: [
        {
          id: "weapon-1",
          name: "Shortsword",
          disabledAttr: "disabled",
          summary: {
            bth: "+7",
            btd: "+3",
            damageFormula: "1d6",
            range: { normal: 0, long: 0 },
          },
        },
      ],
      armour: [],
      equipment: [],
      features: [],
      feats: [{ id: "feat-tough", name: "Tough", disabledAttr: "disabled" }],
      flaws: [
        {
          id: "flaw-addiction",
          name: "Addiction",
          system: { cost: { bp: 1 } },
          disabledAttr: "disabled",
        },
      ],
      traits: [],
      magicStreams: [],
      magicAbilities: [],
    },
    survivalLabel: "PIVOT.Survival.Healthy",
    survivalStatus: "healthy",
    hpPercent: 66,
    poolPercent: 100,
    deathSaveSuccessPips: [false, false, false],
    deathSaveFailurePips: [false, false, false],
    isGM: false,
    tabs: {
      sheet: { cssClass: "active" },
      survival: { cssClass: "" },
      inventory: { cssClass: "" },
      magic: { cssClass: "" },
      notes: { cssClass: "" },
    },
  };

  const headerHTML = header(data);
  const vitalsHTML = vitals(data);
  const tabsHTML = tabs(data);
  const sheetHTML = sheet(data);
  const content = headerHTML + vitalsHTML + tabsHTML + sheetHTML;

  const html = generateHTML("theme-light", content, 640);

  await page.setContent(html);
  await page.setViewportSize({ width: 680, height: 1200 });

  // Validate table bounding boxes
  /* eslint-disable no-undef */
  const validation = await page.evaluate(() => {
    const table = document.querySelector(".pf-attacks");
    const thead = table?.querySelector("thead");
    const tbody = table?.querySelector("tbody");
    const theadRow = thead?.querySelector("tr");
    const tbodyRow = tbody?.querySelector("tr");

    if (!table || !theadRow || !tbodyRow) {
      return { error: "Table elements not found" };
    }

    const tableBounds = table.getBoundingClientRect();
    const theadBounds = theadRow.getBoundingClientRect();
    const tbodyBounds = tbodyRow.getBoundingClientRect();

    const theadCells = Array.from(theadRow.querySelectorAll("th")).map((th) => {
      const bounds = th.getBoundingClientRect();
      const computed = window.getComputedStyle(th);
      return { bounds, width: computed.width, tableLayout: computed.tableLayout };
    });
    const tbodyCells = Array.from(tbodyRow.querySelectorAll("td")).map((td) => {
      const bounds = td.getBoundingClientRect();
      const computed = window.getComputedStyle(td);
      return { bounds, width: computed.width };
    });

    const tableComputed = window.getComputedStyle(table);

    return {
      tableWidth: tableBounds.width,
      tableComputedWidth: tableComputed.width,
      tableLayout: tableComputed.tableLayout,
      theadRowWidth: theadBounds.width,
      tbodyRowWidth: tbodyBounds.width,
      cells: theadCells.map((thData, i) => {
        const tdData = tbodyCells[i];
        return {
          column: i,
          thLeft: thData.bounds.left,
          thWidth: thData.bounds.width,
          thComputedWidth: thData.width,
          tdLeft: tdData.bounds.left,
          tdWidth: tdData.bounds.width,
          tdComputedWidth: tdData.width,
          leftAlignDiff: Math.abs(thData.bounds.left - tdData.bounds.left),
          widthDiff: Math.abs(thData.bounds.width - tdData.bounds.width),
        };
      }),
    };
  });
  /* eslint-enable no-undef */

  console.log("\n=== Attacks Table Validation ===");
  console.log(`Table width: ${validation.tableWidth?.toFixed(2)}px`);
  console.log(`Table computed width: ${validation.tableComputedWidth}`);
  console.log(`Table layout: ${validation.tableLayout}`);
  console.log(`Thead row width: ${validation.theadRowWidth?.toFixed(2)}px`);
  console.log(`Tbody row width: ${validation.tbodyRowWidth?.toFixed(2)}px`);
  console.log("\nColumn alignment:");

  if (validation.cells) {
    validation.cells.forEach((cell) => {
      const aligned = cell.leftAlignDiff <= 2 ? "✓" : "✗";
      console.log(`  Column ${cell.column}: ${aligned}`);
      console.log(
        `    TH: left=${cell.thLeft.toFixed(2)}px, width=${cell.thWidth.toFixed(2)}px, computed=${cell.thComputedWidth}`,
      );
      console.log(
        `    TD: left=${cell.tdLeft.toFixed(2)}px, width=${cell.tdWidth.toFixed(2)}px, computed=${cell.tdComputedWidth}`,
      );
      console.log(
        `    Left edge diff: ${cell.leftAlignDiff.toFixed(2)}px (${cell.leftAlignDiff <= 2 ? "PASS" : "FAIL"})`,
      );
      console.log(`    Width diff: ${cell.widthDiff.toFixed(2)}px`);
    });
  }

  const allAligned = validation.cells?.every((cell) => cell.leftAlignDiff <= 2) ?? false;
  console.log(`\n${allAligned ? "✓ All columns aligned" : "✗ Columns NOT aligned"}`);

  await browser.close();

  if (!allAligned) {
    throw new Error("Table columns are not properly aligned");
  }
}

validateAttacksTable().catch(console.error);
