// Contrast measurement with getComputedStyle on rendered pages
import { chromium } from "@playwright/test";
import fs from "fs";
import Handlebars from "handlebars";

// Simple selectOptions helper
Handlebars.registerHelper("selectOptions", function (choices, options) {
  const selected = options.hash.selected;
  return Object.entries(choices)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`,
    )
    .join("");
});

const tokens = fs.readFileSync("styles/pf-tokens.css", "utf-8");
const css = fs.readFileSync("styles/pivot-fantasy.css", "utf-8");

// Load templates
const headerTmpl = Handlebars.compile(
  fs.readFileSync("templates/actors/character/header.hbs", "utf-8"),
);
const sheetTmpl = Handlebars.compile(
  fs.readFileSync("templates/actors/character/sheet.hbs", "utf-8"),
);
const npcSheetTmpl = Handlebars.compile(fs.readFileSync("templates/actors/npc-sheet.hbs", "utf-8"));

function generateHTML(theme, content, type = "character") {
  const bodyTheme = theme === "dark" ? "theme-dark" : "";
  const appTheme = theme === "dark" ? "theme-dark" : "";
  const bg = theme === "dark" ? "#0d0b09" : "#f0f0f0";
  const appClasses =
    type === "character" ? `pivot-fantasy pf-sheet sheet ${appTheme}` : `pivot-fantasy ${appTheme}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 20px; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: ${bg}; }
    ${tokens}
    ${css}
  </style>
</head>
<body class="${bodyTheme}">
  <div class="${appClasses}" style="container-type: inline-size; width: 640px; margin: 0 auto;">
    ${content}
  </div>
</body>
</html>
`;
}

function relativeLuminance(r, g, b) {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;
  const R = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const G = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const B = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(rgbString) {
  const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
  };
}

async function measureContrast() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Character sheet data
  const charData = {
    actor: { name: "Joe Bloggs", id: "test" },
    system: { identity: { player: "Test Player" }, progression: { level: 3, xp: 1500 } },
    editable: false,
    disabledAttr: "disabled",
    derived: { speed: { value: 10 } },
    form: { languagesText: "Common", instrumentsText: "", academiaText: "", craftingText: "" },
    config: { abilities: [] },
  };

  // NPC sheet data
  const npcData = {
    actor: { id: "npc-1", name: "Goblin Raider" },
    rootId: "test",
    system: {
      cr: "1",
      tier: "standard",
      creatureType: "humanoid",
      overlay: "",
      attributes: { hp: { value: 15, max: 15 }, ac: 13, speed: 30 },
      combatBonuses: { physical: 2, intellectual: 0 },
      biography: "A typical goblin raider.",
    },
    config: {
      tierChoices: { standard: "Standard", elite: "Elite" },
      creatureTypeChoices: { humanoid: "Humanoid", beast: "Beast" },
      overlayChoices: { "": "None", fiend: "Fiend" },
    },
    disabledAttr: "disabled",
    items: [],
  };

  const tests = [
    {
      theme: "light",
      type: "character",
      name: "EDIT button (light)",
      html: headerTmpl(charData),
      selector: ".pf-edit-toggle",
    },
    {
      theme: "light",
      type: "npc",
      name: "NPC name input (light)",
      html: npcSheetTmpl(npcData),
      selector: ".pf-title-block input",
    },
    {
      theme: "light",
      type: "npc",
      name: "NPC CR label (light)",
      html: npcSheetTmpl(npcData),
      selector: ".pf-header-stats label > span",
    },
    {
      theme: "light",
      type: "npc",
      name: "NPC CR input (light)",
      html: npcSheetTmpl(npcData),
      selector: ".pf-header-stats input",
    },
    {
      theme: "light",
      type: "npc",
      name: "NPC select (light)",
      html: npcSheetTmpl(npcData),
      selector: ".pf-classification select",
    },
    {
      theme: "dark",
      type: "npc",
      name: "NPC CR label (dark)",
      html: npcSheetTmpl(npcData),
      selector: ".pf-header-stats label > span",
    },
    {
      theme: "dark",
      type: "character",
      name: "Loyalty label (dark 900)",
      html: sheetTmpl(charData),
      selector: "label > span",
      filter: (text) => text === "Loyalty:",
    },
    {
      theme: "dark",
      type: "character",
      name: "GP label (dark 900)",
      html: sheetTmpl(charData),
      selector: "label > span",
      filter: (text) => text === "GP",
    },
  ];

  console.log("\n=== Contrast Measurements (getComputedStyle) ===\n");

  for (const test of tests) {
    const html = generateHTML(test.theme, test.html, test.type);
    await page.setContent(html);
    await page.setViewportSize({ width: 900, height: 1200 });

    const measurement = await page.evaluate(
      ({ sel, filterFn }) => {
        /* eslint-disable no-undef */
        let elements = Array.from(document.querySelectorAll(sel));

        // Filter if needed
        if (filterFn) {
          const filter = eval("(" + filterFn + ")");
          elements = elements.filter((el) => filter(el.textContent?.trim() || ""));
        }

        const element = elements[0];
        if (!element) return { error: "Element not found" };

        const styles = window.getComputedStyle(element);

        // Find background by walking up tree
        let bg = styles.backgroundColor;
        let parent = element.parentElement;
        while (parent && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
          const parentStyles = window.getComputedStyle(parent);
          bg = parentStyles.backgroundColor;
          parent = parent.parentElement;
        }

        return {
          color: styles.color,
          backgroundColor: bg,
          text: element.textContent?.trim().substring(0, 50),
        };
        /* eslint-enable no-undef */
      },
      { sel: test.selector, filterFn: test.filter ? test.filter.toString() : null },
    );

    if (measurement.error) {
      console.log(`${test.name}: ERROR - ${measurement.error}`);
      continue;
    }

    const fg = parseRgb(measurement.color);
    const bg = parseRgb(measurement.backgroundColor);

    if (fg && bg) {
      const fgL = relativeLuminance(fg.r, fg.g, fg.b);
      const bgL = relativeLuminance(bg.r, bg.g, bg.b);
      const ratio = contrastRatio(fgL, bgL);
      const pass = ratio >= 4.5 ? "✓ PASS" : "✗ FAIL";
      console.log(
        `${test.name}: ${ratio.toFixed(2)}:1 ${pass} (${measurement.color} on ${measurement.backgroundColor})`,
      );
    } else {
      console.log(
        `${test.name}: Could not parse colors (fg: ${measurement.color}, bg: ${measurement.backgroundColor})`,
      );
    }
  }

  await browser.close();
}

measureContrast().catch((err) => {
  console.error(err);
  process.exit(1);
});
