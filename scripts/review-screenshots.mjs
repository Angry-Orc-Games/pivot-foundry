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
function generateHTML(theme, content, width, sheetType = "character") {
  const bodyTheme = theme === "dark" ? "theme-dark" : "";
  const appTheme = theme === "dark" ? "theme-dark" : "";
  const bg = theme === "dark" ? "#0d0b09" : "#f0f0f0";

  // Match Foundry ApplicationV2 structure
  const appClasses =
    sheetType === "character"
      ? `pivot-fantasy pf-sheet sheet ${appTheme}`
      : `pivot-fantasy ${appTheme}`;

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
      background: ${bg};
    }
    ${tokens}
    ${css}
    /* Simulate ApplicationV2 window-content structure for full-page screenshots */
    .window-content {
      display: flex;
      flex-direction: column;
      min-height: auto;
    }
  </style>
</head>
<body class="${bodyTheme}">
  <div class="${appClasses}" style="container-type: inline-size; width: ${width}px; margin: 0 auto;">
    ${
      sheetType === "character"
        ? `
      <div class="pf-character-sheet">
        <div class="window-content">
          ${content}
        </div>
      </div>
    `
        : `
      <div class="pf-sheet">
        <div class="pf-npc-sheet window-content">
          ${content}
        </div>
      </div>
    `
    }
  </div>
</body>
</html>
`;
}

async function generateScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const scenarios = [
    { theme: "light", width: 640, name: "review-light-640" },
    { theme: "dark", width: 640, name: "review-dark-640" },
    { theme: "light", width: 900, name: "review-light-900" },
    { theme: "dark", width: 900, name: "review-dark-900" },
  ];

  for (const scenario of scenarios) {
    // Inline minimal context preparation
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
          ability: "Str",
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
          ability: "Int",
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
          ability: "Wis",
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
          ability: "Dex",
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
          ability: "Cha",
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
          ability: "Wis",
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
    const sheetHTML = sheet(data);
    const content = headerHTML + vitalsHTML + sheetHTML;

    const html = generateHTML(scenario.theme, content, scenario.width);

    await page.setContent(html);
    await page.setViewportSize({ width: scenario.width + 40, height: 800 });

    const outputPath = `artifacts/${scenario.name}.png`;
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`Generated ${scenario.name}.png`);

    // Generate crops for light-640 and dark-640
    if (scenario.width === 640) {
      // Skills crop
      const skillsElement = await page.locator("table.pf-skills").first();
      if (skillsElement) {
        await skillsElement.screenshot({
          path: `artifacts/${scenario.name}-skills.png`,
        });
        console.log(`  - ${scenario.name}-skills.png`);
      }

      // Tabs crop
      const loyaltyElement = page.locator(".pf-loyalty");
      if ((await loyaltyElement.count()) > 0) {
        await loyaltyElement.screenshot({
          path: `artifacts/${scenario.name}-loyalty.png`,
        });
        console.log(`  - ${scenario.name}-loyalty.png`);
      }

      // Ability cards crop (vitals section with ability boxes)
      const abilitiesElement = await page.locator(".pf-abil").first();
      if (abilitiesElement) {
        await abilitiesElement.screenshot({
          path: `artifacts/${scenario.name}-abilities.png`,
        });
        console.log(`  - ${scenario.name}-abilities.png`);
      }

      // Attacks table crop
      const attacksElement = await page.locator("table.pf-attacks").first();
      if (attacksElement) {
        await attacksElement.screenshot({
          path: `artifacts/${scenario.name}-attacks.png`,
        });
        console.log(`  - ${scenario.name}-attacks.png`);
      }
    }
  }

  await browser.close();
  console.log("\nAll review screenshots generated in artifacts/!");
}

async function generateNPCScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const npcData = {
    actor: { id: "npc-1", name: "Goblin Raider" },
    system: {
      cr: "1",
      tier: "standard",
      creatureType: "humanoid",
      overlay: "",
      attributes: { hp: { value: 15, max: 15 }, ac: 13, speed: 30 },
      combatBonuses: { physical: 2, intellectual: 0 },
      biography: "A typical goblin raider from the wastes.",
    },
    config: {
      tierChoices: { standard: "Standard", elite: "Elite", champion: "Champion" },
      creatureTypeChoices: { humanoid: "Humanoid", beast: "Beast", undead: "Undead" },
      overlayChoices: { "": "None", fiend: "Fiend", celestial: "Celestial" },
    },
    disabledAttr: "disabled",
    items: [],
  };

  const npcTemplate = `
    <div class="pf-npc-sheet">
      <header class="pf-sheet-header">
        <div class="pf-title-block">
          <label>NPC Name</label>
          <input type="text" value="${npcData.actor.name}" disabled />
        </div>
        <div class="pf-header-stats">
          <label>
            <span>CR</span>
            <input type="text" value="${npcData.system.cr}" disabled />
          </label>
        </div>
      </header>

      <div class="pf-sheet-body">
        <section class="pf-classification">
          <h2>Classification</h2>
          <div class="pf-attribute-row">
            <label>
              <span>Tier</span>
              <select disabled>
                <option selected>${npcData.config.tierChoices[npcData.system.tier]}</option>
              </select>
            </label>
            <label>
              <span>Creature Type</span>
              <select disabled>
                <option selected>${npcData.config.creatureTypeChoices[npcData.system.creatureType]}</option>
              </select>
            </label>
          </div>
          <div class="pf-attribute-row">
            <label>
              <span>Overlay</span>
              <select disabled>
                <option selected>None</option>
              </select>
            </label>
          </div>
        </section>

        <section class="pf-attributes">
          <h2>Attributes</h2>
          <div class="pf-attribute-row">
            <label>
              <span>HP Current</span>
              <input type="number" value="${npcData.system.attributes.hp.value}" disabled />
            </label>
            <label>
              <span>HP Max</span>
              <input type="number" value="${npcData.system.attributes.hp.max}" disabled />
            </label>
          </div>
          <div class="pf-attribute-row">
            <label>
              <span>AC</span>
              <input type="number" value="${npcData.system.attributes.ac}" disabled />
            </label>
            <label>
              <span>Speed</span>
              <input type="number" value="${npcData.system.attributes.speed}" disabled />
            </label>
          </div>
        </section>
      </div>
    </div>
  `;

  const scenarios = [
    { theme: "light", width: 640, name: "npc-light-640" },
    { theme: "dark", width: 640, name: "npc-dark-640" },
    { theme: "light", width: 900, name: "npc-light-900" },
    { theme: "dark", width: 900, name: "npc-dark-900" },
  ];

  for (const scenario of scenarios) {
    const html = generateHTML(scenario.theme, npcTemplate, scenario.width, "npc");
    await page.setContent(html);
    await page.setViewportSize({ width: scenario.width + 40, height: 800 });

    const outputPath = `artifacts/${scenario.name}.png`;
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`Generated ${scenario.name}.png`);

    // Crop NPC classification selects at 640px
    if (scenario.width === 640) {
      const classificationElement = await page.locator(".pf-classification");
      if (classificationElement) {
        await classificationElement.screenshot({
          path: `artifacts/${scenario.name}-classification.png`,
        });
        console.log(`  - ${scenario.name}-classification.png`);
      }
    }
  }

  await browser.close();
  console.log("\nNPC review screenshots generated!");
}

async function generateItemScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const itemData = {
    item: { id: "item-1", name: "Longsword", type: "weapon" },
    system: {
      description: "A well-crafted longsword.",
      quantity: 1,
      weight: 3,
      cost: { gp: 15, sp: 0, cp: 0 },
    },
    disabledAttr: "disabled",
  };

  const itemTemplate = `
    <div class="pf-item-sheet">
      <header class="pf-sheet-header">
        <div class="pf-title-block">
          <label>Item Name</label>
          <input type="text" value="${itemData.item.name}" disabled />
        </div>
        <div class="pf-header-stats">
          <label>
            <span>Type</span>
            <input type="text" value="${itemData.item.type}" disabled />
          </label>
        </div>
      </header>
      <div class="pf-sheet-body">
        <section>
          <label><span>Description</span><textarea disabled>${itemData.system.description}</textarea></label>
        </section>
      </div>
    </div>
  `;

  const scenarios = [
    { theme: "light", width: 640, name: "item-light-640" },
    { theme: "dark", width: 640, name: "item-dark-640" },
  ];

  for (const scenario of scenarios) {
    const html = generateHTML(scenario.theme, itemTemplate, scenario.width, "item");
    await page.setContent(html);
    await page.setViewportSize({ width: scenario.width + 40, height: 600 });

    const outputPath = `artifacts/${scenario.name}.png`;
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`Generated ${scenario.name}.png`);
  }

  await browser.close();
  console.log("\nItem review screenshots generated!");
}

generateScreenshots()
  .then(() => generateNPCScreenshots())
  .then(() => generateItemScreenshots())
  .catch(console.error);
