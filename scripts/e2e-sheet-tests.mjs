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
const survival = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "survival.hbs"), "utf-8"));
const inventory = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "inventory.hbs"), "utf-8"));
const magic = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "magic.hbs"), "utf-8"));
const notesTemplate = Handlebars.compile(readFileSync(join(TEMPLATE_DIR, "notes.hbs"), "utf-8"));

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
      player: "Player One",
      age: "127",
      height: "5'11\"",
      weight: { value: 165 },
      eyes: "Green",
      hair: "Black",
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
      athletics: {
        ability: "str",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
      deception: {
        ability: "cha",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
      insight: {
        ability: "wis",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
      investigation: {
        ability: "int",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
      perception: {
        ability: "wis",
        proficient: true,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
      acrobatics: {
        ability: "dex",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
      },
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
    notes: {
      special: "This is a test note about the character.",
    },
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
      system: {
        category: "feat",
        cost: { gp: 0 },
        description: "Increases HP.",
      },
    },
  ],
};

function getContextData() {
  return {
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
}

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
    /* Test-specific styles */
    .pf-character-sheet {
      height: 600px;
    }
  </style>
  <script>
    // Minimal tab switching simulation
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-action="tab"]');
      if (!tab) return;
      e.preventDefault();
      const group = tab.dataset.group;
      const tabId = tab.dataset.tab;
      
      const panelClassMap = {
        sheet: 'pf-sheet-content',
        survival: 'pf-survival-tab',
        inventory: 'pf-inventory-tab',
        magic: 'pf-magic-tab',
        notes: 'pf-notes-tab'
      };
      
      // Update tab nav
      document.querySelectorAll(\`[data-group="\${group}"][data-action="tab"]\`).forEach(t => {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      
      // Update tab panels
      document.querySelectorAll(\`.tab[data-group="\${group}"]\`).forEach(panel => {
        panel.classList.remove('active');
      });
      
      const panelClass = panelClassMap[tabId];
      if (panelClass) {
        const activePanel = document.querySelector(\`.\${panelClass}\`);
        if (activePanel) {
          activePanel.classList.add('active');
        }
      }
    });
  </script>
</head>
<body class="${theme} pivot-fantasy">
  <div class="pf-sheet" style="container-type: inline-size; width: ${width}px; margin: 0 auto;">
    <div class="pf-character-sheet">
      ${content}
    </div>
  </div>
</body>
</html>
`;
}

function getContrastRatio(rgb1, rgb2) {
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((val) => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = luminance(rgb1);
  const l2 = luminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(rgbString) {
  const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
}

async function runTests() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("\n=== E2E Tests for Character Sheet ===\n");

  const data = getContextData();
  const headerHTML = header(data);
  const vitalsHTML = vitals(data);
  const tabsHTML = tabs(data);
  const sheetHTML = sheet(data);
  const survivalHTML = survival(data);
  const inventoryHTML = inventory(data);
  const magicHTML = magic(data);
  const notesHTML = notesTemplate(data);

  const content = `
    ${headerHTML}
    ${vitalsHTML}
    ${tabsHTML}
    <div class="pf-tab-body">
      ${sheetHTML}
      ${survivalHTML}
      ${inventoryHTML}
      ${magicHTML}
      ${notesHTML}
    </div>
  `;

  const html = generateHTML("pivot-fantasy", content, 640);

  await page.setContent(html);
  await page.setViewportSize({ width: 680, height: 800 });

  // Test 1: Wheel scroll changes scrollTop
  console.log("Test 1: Wheel scroll functionality");
  const scrollTest = await page.evaluate(
    /* eslint-disable no-undef */
    () => {
      const tabBody = document.querySelector(".pf-tab-body");
      if (!tabBody) return { error: "Tab body not found" };

      const initialScrollTop = tabBody.scrollTop;
      const scrollHeight = tabBody.scrollHeight;
      const clientHeight = tabBody.clientHeight;

      // Simulate scroll by setting scrollTop
      tabBody.scrollTop = 100;
      const scrolledTop = tabBody.scrollTop;

      return {
        initialScrollTop,
        scrolledTop,
        scrollHeight,
        clientHeight,
        isScrollable: scrollHeight > clientHeight,
        scrollChanged: scrolledTop !== initialScrollTop,
      };
    },
    /* eslint-enable no-undef */
  );

  console.log(`  Initial scrollTop: ${scrollTest.initialScrollTop}`);
  console.log(`  After scroll: ${scrollTest.scrolledTop}`);
  console.log(
    `  Scrollable: ${scrollTest.isScrollable} (height: ${scrollTest.scrollHeight}, client: ${scrollTest.clientHeight})`,
  );
  console.log(
    `  ${scrollTest.scrollChanged ? "✓" : "✗"} Scroll changed scrollTop ${scrollTest.scrollChanged ? "PASS" : "FAIL"}`,
  );

  // Test 2: Tab switching
  console.log("\nTest 2: Tab switching functionality");

  const tabIds = ["sheet", "survival", "inventory", "magic", "notes"];
  const panelClassMap = {
    sheet: "pf-sheet-content",
    survival: "pf-survival-tab",
    inventory: "pf-inventory-tab",
    magic: "pf-magic-tab",
    notes: "pf-notes-tab",
  };
  let allTabsWork = true;

  for (const tabId of tabIds) {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      ({ id, panelClass }) => {
        const tabButton = document.querySelector(`[data-tab="${id}"]`);
        if (!tabButton) return { error: `Tab button ${id} not found` };

        tabButton.click();

        // Wait a bit for JS to execute
        return new Promise((resolve) => {
          setTimeout(() => {
            const activeTab = document.querySelector(".pf-tabs a.active");
            const activePanel = document.querySelector(`.${panelClass}.active`);

            resolve({
              tabId: id,
              tabIsActive: activeTab?.dataset.tab === id,
              panelIsActive: !!activePanel,
              panelVisible: activePanel
                ? window.getComputedStyle(activePanel).display !== "none"
                : false,
            });
          }, 50);
        });
      },
      /* eslint-enable no-undef */
      { id: tabId, panelClass: panelClassMap[tabId] },
    );

    const pass = result.tabIsActive && result.panelIsActive && result.panelVisible;
    allTabsWork = allTabsWork && pass;
    console.log(`  ${pass ? "✓" : "✗"} ${tabId}: ${pass ? "PASS" : "FAIL"}`);
    if (!pass) {
      console.log(
        `    Tab active: ${result.tabIsActive}, Panel active: ${result.panelIsActive}, Panel visible: ${result.panelVisible}`,
      );
    }
  }

  // Test 3: Contrast ratios
  console.log("\nTest 3: Contrast ratio checks (minimum 4.5:1)");

  const contrastTests = await page.evaluate(() => {
    /* eslint-disable no-undef */
    const getEffectiveBackground = (el) => {
      let current = el;
      while (current && current !== document.body) {
        const bg = window.getComputedStyle(current).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
          return bg;
        }
        current = current.parentElement;
      }
      return window.getComputedStyle(document.body).backgroundColor;
    };

    const getColorAndBg = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        bg: getEffectiveBackground(el),
      };
    };

    return {
      skillName: getColorAndBg(".pf-skills label span"),
      skillModifier: getColorAndBg(".pf-skills .pf-small"),
      activeTab: getColorAndBg(".pf-tabs a.active"),
      abilityLabel: getColorAndBg(".pf-ab b"),
      statCardLabel: getColorAndBg(".pf-stat-card > span"),
    };
    /* eslint-enable no-undef */
  });

  for (const [key, value] of Object.entries(contrastTests)) {
    if (!value) {
      console.log(`  ✗ ${key}: Element not found`);
      continue;
    }

    const fg = parseRgb(value.color);
    const bg = parseRgb(value.bg);

    if (!fg || !bg) {
      console.log(`  ✗ ${key}: Could not parse colors`);
      console.log(`    FG: ${value.color}, BG: ${value.bg}`);
      continue;
    }

    const ratio = getContrastRatio(fg, bg);
    const pass = ratio >= 4.5;
    console.log(`  ${pass ? "✓" : "✗"} ${key}: ${ratio.toFixed(2)}:1 ${pass ? "PASS" : "FAIL"}`);
    if (!pass) {
      console.log(`    FG: ${value.color}, BG: ${value.bg}`);
    }
  }

  await browser.close();

  console.log("\n=== Tests Complete ===\n");
}

runTests().catch(console.error);
