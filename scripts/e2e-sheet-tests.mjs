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
const foundryForm = readFileSync(join(__dirname, "foundry-v14-form-fixture.css"), "utf-8");
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
    ${foundryForm}
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
<body class="${theme}">
  <form class="application pivot-fantasy pf-sheet sheet actor character ${theme === "theme-dark" ? "theme-dark" : ""}" style="width: ${width}px;">
    <section class="window-content" style="height: 600px; width: ${width}px;">
      ${content}
    </section>
  </form>
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
  const sheetHTML = sheet(data);

  const content = `
    ${headerHTML}
    ${vitalsHTML}
    <div class="pf-tab-body">
      ${sheetHTML}
    </div>
  `;

  const html = generateHTML("pivot-fantasy", content, 640);

  await page.setContent(html);
  await page.setViewportSize({ width: 680, height: 800 });

  // Test 1: Scroll with page.mouse.wheel over tab body
  console.log("Test 1: Scroll with page.mouse.wheel over tab body");

  // Add tall content to make scrolling possible
  await page.evaluate(() => {
    /* eslint-disable no-undef */
    const sheet = document.querySelector(".pf-sheet-content, .tab.active");
    if (sheet) {
      for (let i = 0; i < 50; i++) {
        const p = document.createElement("p");
        p.textContent = `Scroll test content line ${i + 1}. This is tall content to enable scrolling.`;
        p.style.margin = "10px 0";
        sheet.appendChild(p);
      }
    }
    /* eslint-enable no-undef */
  });

  // Wait a moment for layout
  await page.waitForTimeout(100);

  // Get initial scrollTop and container position
  const initialState = await page.evaluate(() => {
    /* eslint-disable no-undef */
    const tabBody =
      document.querySelector(".pf-tab-body") ||
      document.querySelector(".window-content") ||
      document.querySelector(".pf-character-sheet");

    if (!tabBody) {
      return { error: "Scroll container not found" };
    }

    const rect = tabBody.getBoundingClientRect();
    return {
      initialScrollTop: tabBody.scrollTop,
      scrollHeight: tabBody.scrollHeight,
      clientHeight: tabBody.clientHeight,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    /* eslint-enable no-undef */
  });

  if (initialState.error) {
    console.log(`  ✗ ${initialState.error}`);
    process.exit(1);
  } else {
    // Use page.mouse.wheel to scroll
    await page.mouse.move(initialState.x, initialState.y);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(100);

    // Check scrollTop after wheel event
    const finalState = await page.evaluate(() => {
      /* eslint-disable no-undef */
      const tabBody =
        document.querySelector(".pf-tab-body") ||
        document.querySelector(".window-content") ||
        document.querySelector(".pf-character-sheet");
      return { scrollTop: tabBody ? tabBody.scrollTop : 0 };
      /* eslint-enable no-undef */
    });

    const scrollDelta = finalState.scrollTop - initialState.initialScrollTop;
    const scrollChanged = scrollDelta > 0;

    console.log(`  Initial scrollTop: ${initialState.initialScrollTop}`);
    console.log(`  After mouse.wheel: ${finalState.scrollTop}`);
    console.log(`  Scroll delta: ${scrollDelta}px`);
    console.log(
      `  Scrollable: ${initialState.scrollHeight > initialState.clientHeight} (height: ${initialState.scrollHeight}, client: ${initialState.clientHeight})`,
    );
    console.log(
      `  ${scrollChanged ? "✓" : "✗"} Scroll changed scrollTop ${scrollChanged ? "PASS" : "FAIL"}`,
    );

    if (!scrollChanged) {
      console.error("\n✗ Scroll test FAILED: scrollTop did not change");
      process.exit(1);
    }
  }

  // Test 2: Former tab sections are visible together, with no tab bar.
  console.log("\nTest 2: One-page sections (survival, inventory, magic, notes)");

  const sectionResult = await page.evaluate(() => {
    /* eslint-disable no-undef */
    const visible = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      return window.getComputedStyle(el).display !== "none";
    };
    const headings = [...document.querySelectorAll("h3")].map((el) => el.textContent.trim());
    const order = [
      "Skills",
      "Attacks",
      "Feats",
      "Magic",
      "Flaws",
      "Traits",
      "Gear and funds",
      "Survival",
      "Loyalty and details",
    ];
    let last = -1;
    let orderOk = true;
    for (const heading of order) {
      const index = headings.indexOf(heading);
      if (index < 0 || index < last) orderOk = false;
      last = index;
    }
    return {
      noTabBar: document.querySelector(".pf-tabs") === null,
      sheet: visible(".pf-sheet-content"),
      survival: visible(".pf-survival"),
      inventory: visible(".pf-inventory"),
      magic: visible(".pf-magic"),
      notes: visible('textarea[name="system.notes.special"]'),
      shortRest: visible('[data-action="shortRest"]'),
      createWeapon: visible('[data-type="weapon"]'),
      awakened: visible('[name="system.magic.awakened"]'),
      orderOk,
      headings,
    };
    /* eslint-enable no-undef */
  });

  const sectionChecks = [
    ["no tab bar", sectionResult.noTabBar],
    ["sheet", sectionResult.sheet],
    ["survival", sectionResult.survival],
    ["inventory", sectionResult.inventory],
    ["magic", sectionResult.magic],
    ["notes", sectionResult.notes],
    ["short rest", sectionResult.shortRest],
    ["create weapon", sectionResult.createWeapon],
    ["awakened", sectionResult.awakened],
    ["section order", sectionResult.orderOk],
  ];
  let allTabsWork = true;
  for (const [label, pass] of sectionChecks) {
    allTabsWork = allTabsWork && pass;
    console.log(`  ${pass ? "✓" : "✗"} ${label}: ${pass ? "PASS" : "FAIL"}`);
  }
  if (!sectionResult.orderOk) {
    console.log(`    Headings: ${sectionResult.headings.join(" | ")}`);
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
      sectionHeading: getColorAndBg(".pf-print h3"),
      abilityLabel: getColorAndBg(".pf-ab b"),
    };
    /* eslint-enable no-undef */
  });

  let contrastFailed = false;
  for (const [key, value] of Object.entries(contrastTests)) {
    if (!value) {
      console.log(`  ✗ ${key}: Element not found`);
      contrastFailed = true;
      continue;
    }

    const fg = parseRgb(value.color);
    const bg = parseRgb(value.bg);

    if (!fg || !bg) {
      console.log(`  ✗ ${key}: Could not parse colors`);
      console.log(`    FG: ${value.color}, BG: ${value.bg}`);
      contrastFailed = true;
      continue;
    }

    const ratio = getContrastRatio(fg, bg);
    const pass = ratio >= 4.5;
    console.log(`  ${pass ? "✓" : "✗"} ${key}: ${ratio.toFixed(2)}:1 ${pass ? "PASS" : "FAIL"}`);
    if (!pass) {
      console.log(`    FG: ${value.color}, BG: ${value.bg}`);
      contrastFailed = true;
    }
  }

  console.log("\nTest 4: Print sheet measurements");
  const printFailed = !(await assertPrintSheet(page, "light"));
  const darkHtml = generateHTML("theme-dark", content, 900);
  await page.setContent(darkHtml);
  await page.setViewportSize({ width: 980, height: 800 });
  const darkFailed = !(await assertPrintSheet(page, "dark"));

  await browser.close();

  console.log("\n=== Tests Complete ===\n");

  if (!allTabsWork || contrastFailed || printFailed || darkFailed) {
    console.error("✗ Some tests FAILED");
    process.exit(1);
  }
}

async function assertPrintSheet(page, label) {
  const measured = await page.evaluate(() => {
    /* eslint-disable no-undef */
    const styleOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        fontSize: style.fontSize,
        color: style.color,
        backgroundColor: style.backgroundColor,
        textTransform: style.textTransform,
        letterSpacing: style.letterSpacing,
        borderBottomWidth: style.borderBottomWidth,
        borderBottomStyle: style.borderBottomStyle,
        listStyleType: style.listStyleType,
        fontWeight: style.fontWeight,
      };
    };
    const row = document.querySelector("table.pf-skills tr");
    const evenRow = document.querySelector("table.pf-skills tr:nth-child(even)");
    const speed = [...document.querySelectorAll(".pf-stat span")].find((el) =>
      /m/i.test(el.textContent || ""),
    );
    const mark = document.querySelector(".pf-prof-mark");
    const ability = document.querySelector("table.pf-skills td.pf-small");
    const score = document.querySelector(".pf-ab-score");
    const scoreStyle = score ? window.getComputedStyle(score) : null;
    const hpInput = document.querySelector('input[name="system.attributes.hp.value"]');
    const hpReadout = document.querySelector(".pf-hp-readout");
    const hpStyle = hpReadout ? window.getComputedStyle(hpReadout) : null;
    const hpLine = document.querySelector(".pf-hp-line");
    const awakened = document.querySelector('input[name="system.magic.awakened"]');
    const awakenedStyle = awakened ? window.getComputedStyle(awakened) : null;
    const prime = document.querySelector(".pf-ab.pf-prime .pf-prime-toggle");
    const primeInput = document.querySelector(".pf-prime-toggle input");
    const emptyStar = document.querySelector(".pf-ab:not(.pf-prime) .pf-prime-mark");
    const primeBox = document.querySelector(".pf-ab.pf-prime");
    const skillCell = document.querySelector("table.pf-skills td");
    const skillName = document.querySelector("table.pf-skills .pf-check span:not(.pf-prof-mark)");
    const skillCellStyle = skillCell ? window.getComputedStyle(skillCell) : null;
    const skillNameStyle = skillName ? window.getComputedStyle(skillName) : null;
    const modifier = document.querySelector("table.pf-skills td.pf-r .pf-roll");
    const modifierStyle = modifier ? window.getComputedStyle(modifier) : null;
    const initLine = document.querySelector(".pf-init-line");
    const initButton = initLine?.querySelector("button") ?? null;
    const initNote = initLine?.querySelector("span:last-child") ?? null;
    const initButtonStyle = initButton ? window.getComputedStyle(initButton) : null;
    const scoreSpin = score ? window.getComputedStyle(score, "::-webkit-inner-spin-button") : null;
    const mp = document.querySelector('input[name="system.magic.mp.value"]');
    const mpStyle = mp ? window.getComputedStyle(mp) : null;
    const plus = document.querySelector('[data-type="magicStream"]');
    const plusStyle = plus ? window.getComputedStyle(plus) : null;
    const contentWidth = document.querySelector(".window-content")?.clientWidth ?? 0;
    const headerWidth = document.querySelector(".pf-hdr")?.getBoundingClientRect().width ?? 0;
    const vitalsWidth = document.querySelector(".pf-vitals")?.getBoundingClientRect().width ?? 0;
    return {
      paper: styleOf(".pf-print-wrap"),
      window: styleOf(".window-content"),
      body: styleOf(".pf-print"),
      small: styleOf(".pf-print .pf-small"),
      heading: styleOf(".pf-print h3"),
      attacks: styleOf("table.pf-attacks thead"),
      attacksHead: styleOf("table.pf-attacks thead th"),
      skillStripe: evenRow ? window.getComputedStyle(evenRow).backgroundColor : "",
      list: styleOf(".pf-print .pf-list"),
      scoreShadow: scoreStyle ? scoreStyle.boxShadow : "",
      scoreBorder: scoreStyle ? scoreStyle.borderTopWidth : "",
      scoreFont: scoreStyle ? scoreStyle.fontFamily : "",
      hpInput: Boolean(hpInput),
      hpText: hpReadout ? hpReadout.textContent.replace(/\s+/g, " ").trim() : "",
      hpFont: hpStyle ? hpStyle.fontFamily : "",
      hpBorder: hpStyle ? hpStyle.borderTopWidth : "",
      hpDamageHeal: Boolean(hpLine?.querySelector('[data-action="survivalRoll"]')),
      awakenedAppearance: awakenedStyle ? awakenedStyle.appearance : "",
      awakenedBorder: awakenedStyle ? awakenedStyle.borderTopWidth : "",
      awakenedWidth: awakenedStyle ? awakenedStyle.width : "",
      primeText: prime ? prime.textContent.replace(/\s+/g, " ").trim() : "",
      primeWidth: primeInput ? window.getComputedStyle(primeInput).width : "",
      emptyStar: emptyStar ? emptyStar.textContent : "",
      primeFill: primeBox ? window.getComputedStyle(primeBox).backgroundColor : "",
      skillCellBg: skillCellStyle ? skillCellStyle.backgroundColor : "",
      skillCellAlign: skillCellStyle ? skillCellStyle.textAlign : "",
      skillNameAlign: skillNameStyle ? skillNameStyle.textAlign : "",
      skillNameColor: skillNameStyle ? skillNameStyle.color : "",
      skillNameOffset:
        skillName && skillCell
          ? skillName.getBoundingClientRect().left - skillCell.getBoundingClientRect().left
          : 999,
      abilityColor: ability ? window.getComputedStyle(ability).color : "",
      modifierWeight: modifierStyle ? modifierStyle.fontWeight : "",
      modifierDeco: modifierStyle ? modifierStyle.textDecorationLine : "",
      modifierAlign: modifier ? window.getComputedStyle(modifier.parentElement).textAlign : "",
      initText: initButton ? initButton.textContent.replace(/\s+/g, " ").trim() : "",
      initDeco: initButtonStyle ? initButtonStyle.textDecorationLine : "",
      initSameLine:
        initButton && initNote
          ? Math.abs(
              initButton.getBoundingClientRect().top - initNote.getBoundingClientRect().top,
            ) < 8
          : false,
      initNarrow:
        initButton && initLine
          ? initButton.getBoundingClientRect().width < initLine.getBoundingClientRect().width * 0.5
          : false,
      scoreAppearance: scoreStyle ? scoreStyle.appearance : "",
      mpAppearance: mpStyle ? mpStyle.appearance : "",
      scoreSpinDisplay: scoreSpin ? scoreSpin.display : "",
      mpReadouts: document.querySelectorAll(".pf-magic .pf-resource-actions span").length,
      plusBg: plusStyle ? plusStyle.backgroundColor : "",
      plusColor: plusStyle ? plusStyle.color : "",
      plusWidth: plus ? plus.getBoundingClientRect().width : 0,
      contentWidth,
      headerWidth,
      vitalsWidth,
      speedText: speed ? speed.textContent.replace(/\s+/g, " ").trim() : "",
      speedTransform: speed ? window.getComputedStyle(speed).textTransform : "",
      rowHeight: row ? row.getBoundingClientRect().height : 0,
      mark: mark ? mark.textContent : "",
      ability: ability ? ability.textContent.trim() : "",
      skillNameLefts: [...document.querySelectorAll(".pf-skills .pf-check span:not(.pf-prof-mark)")]
        .slice(0, 2)
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return Math.round(range.getBoundingClientRect().left);
        }),
      attackBorder: (() => {
        const head = document.querySelector(".pf-attacks th");
        if (!head) return null;
        const style = window.getComputedStyle(head);
        return {
          top: style.borderTopWidth,
          right: style.borderRightWidth,
          bottom: style.borderBottomStyle,
          left: style.borderLeftWidth,
        };
      })(),
      focusRing: (() => {
        const readLabel = (input) => {
          if (!input) return "";
          const wasDisabled = input.disabled;
          input.disabled = false;
          input.focus({ focusVisible: true });
          const outline = window.getComputedStyle(input.closest("label")).outline;
          input.blur();
          input.disabled = wasDisabled;
          return outline;
        };
        const roll = document.querySelector("button.pf-roll");
        if (roll) roll.focus({ focusVisible: true });
        const rollOutline = roll ? window.getComputedStyle(roll).outlineStyle : "";
        if (roll) roll.blur();
        return {
          prime: readLabel(document.querySelector(".pf-prime-toggle input")),
          skill: readLabel(document.querySelector(".pf-skills .pf-check input")),
          roll: rollOutline,
        };
      })(),
      paperOffenders: (() => {
        const allowed = new Set([
          "rgba(0, 0, 0, 0)",
          "rgb(255, 255, 255)",
          "rgb(241, 220, 203)",
          "rgb(138, 59, 18)",
        ]);
        const offenders = [];
        for (const el of document.querySelectorAll(".window-content, .window-content *")) {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          const cls = typeof el.className === "string" ? el.className : "";
          const label = `${el.tagName.toLowerCase()}${cls ? "." + cls.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
          if (!allowed.has(bg)) {
            offenders.push(`${label} ${bg}`);
          }
          if (
            (el.tagName === "BUTTON" || el.tagName === "A") &&
            style.textDecorationLine.includes("underline")
          ) {
            offenders.push(`${label} underline`);
          }
        }
        return offenders.slice(0, 12);
      })(),
    };
    /* eslint-enable no-undef */
  });

  const checks = [
    ["paper background", measured.paper?.backgroundColor === "rgb(255, 255, 255)"],
    ["window paper", measured.window?.backgroundColor === "rgb(255, 255, 255)"],
    ["paper ink", measured.paper?.color === "rgb(28, 26, 22)"],
    ["body 12px", measured.body?.fontSize === "12px"],
    ["small 10.5px", measured.small?.fontSize === "10.5px"],
    ["heading uppercase", measured.heading?.textTransform === "uppercase"],
    ["heading 12px", measured.heading?.fontSize === "12px"],
    ["heading rust", measured.heading?.color === "rgb(138, 59, 18)"],
    ["heading rule", measured.heading?.borderBottomStyle === "solid"],
    ["attacks white", measured.attacksHead?.backgroundColor === "rgb(255, 255, 255)"],
    ["attacks rust", measured.attacksHead?.color === "rgb(138, 59, 18)"],
    ["attacks caps", measured.attacksHead?.textTransform === "uppercase"],
    ["attacks rule", measured.attacksHead?.borderBottomStyle === "solid"],
    ["attacks bold", Number(measured.attacksHead?.fontWeight) >= 700],
    [
      "skills unstriped",
      measured.skillStripe === "rgba(0, 0, 0, 0)" || measured.skillStripe === "rgb(255, 255, 255)",
    ],
    ["skill cell white", measured.skillCellBg === "rgb(255, 255, 255)"],
    ["skill name left", measured.skillCellAlign === "left" && measured.skillNameAlign === "left"],
    ["skill name ink", measured.skillNameColor === "rgb(28, 26, 22)"],
    ["skill ability muted", measured.abilityColor === "rgb(85, 85, 85)"],
    [
      "skill modifier",
      Number(measured.modifierWeight) >= 700 &&
        measured.modifierDeco === "none" &&
        measured.modifierAlign === "right",
    ],
    [
      "initiative line",
      measured.initText === "Initiative +7" &&
        measured.initDeco === "none" &&
        measured.initSameLine === true &&
        measured.initNarrow === true,
    ],
    ["empty star", measured.emptyStar === "☆"],
    ["primary fill", measured.primeFill === "rgb(241, 220, 203)"],
    [
      "number fields",
      measured.scoreAppearance === "textfield" && measured.mpAppearance === "textfield",
    ],
    ["mp once", measured.mpReadouts === 0],
    [
      "add button",
      measured.plusBg === "rgb(138, 59, 18)" &&
        measured.plusColor === "rgb(255, 255, 255)" &&
        measured.plusWidth > 0 &&
        measured.plusWidth < 48,
    ],
    ["score flat", measured.scoreShadow === "none" && measured.scoreBorder === "0px"],
    ["score georgia", /Georgia/i.test(measured.scoreFont)],
    [
      "hp text",
      measured.hpInput === false &&
        measured.hpText === "47 / 71" &&
        /Georgia/i.test(measured.hpFont) &&
        measured.hpBorder === "0px" &&
        measured.hpDamageHeal === true,
    ],
    [
      "awakened box",
      measured.awakenedAppearance === "none" &&
        measured.awakenedBorder === "1px" &&
        measured.awakenedWidth === "18px",
    ],
    ["primary star", measured.primeText === "★"],
    ["primary control clipped", measured.primeWidth === "1px"],
    [
      "parts one width",
      Math.abs(measured.headerWidth - measured.contentWidth) < 1 &&
        Math.abs(measured.vitalsWidth - measured.contentWidth) < 1,
    ],
    ["bullets", measured.list?.listStyleType === "disc"],
    ["speed lowercase", measured.speedText.includes("m") && !measured.speedText.includes("M")],
    ["speed transform", measured.speedTransform === "none"],
    ["skill marker", measured.mark === "●" || measured.mark === "○"],
    ["ability case", measured.ability === "Str"],
    ["skill row height", measured.rowHeight >= 16 && measured.rowHeight <= 22],
    [
      "skill names aligned",
      measured.skillNameLefts?.length === 2 &&
        measured.skillNameLefts[0] === measured.skillNameLefts[1],
    ],
    [
      "attacks header rule",
      measured.attackBorder?.top === "0px" &&
        measured.attackBorder?.right === "0px" &&
        measured.attackBorder?.left === "0px" &&
        measured.attackBorder?.bottom === "solid",
    ],
    [
      "focus rings",
      measured.focusRing?.prime.includes("solid 2px") &&
        measured.focusRing?.skill.includes("solid 2px"),
    ],
    ["paper surfaces", measured.paperOffenders?.length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    ok = ok && pass;
    console.log(`  ${pass ? "✓" : "✗"} ${label} ${name}`);
  }
  if (!ok) console.log(`    ${label} measured ${JSON.stringify(measured)}`);
  return ok;
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
