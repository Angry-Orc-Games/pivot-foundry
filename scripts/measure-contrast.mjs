// Quick contrast measurement script
import { chromium } from "@playwright/test";
import fs from "fs";

const tokens = fs.readFileSync("styles/pf-tokens.css", "utf-8");
const css = fs.readFileSync("styles/pivot-fantasy.css", "utf-8");

function generateHTML(theme, content) {
  const bodyTheme = theme === "dark" ? "theme-dark" : "";
  const appTheme = theme === "dark" ? "theme-dark" : "";
  const bg = theme === "dark" ? "#0d0b09" : "#f0f0f0";

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
  <div class="pivot-fantasy pf-sheet sheet ${appTheme}" style="container-type: inline-size; width: 640px; margin: 0 auto;">
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

async function measureContrast() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const tests = [
    {
      theme: "light",
      name: "Light theme EDIT button",
      html: `<button class="pf-edit-toggle">EDIT</button>`,
      selector: ".pf-edit-toggle",
    },
    {
      theme: "light",
      name: "NPC light name input",
      html: `
        <div class="pf-npc-sheet">
          <header class="pf-sheet-header">
            <div class="pf-title-block">
              <label>Name</label>
              <input type="text" value="Goblin Raider" disabled />
            </div>
          </header>
        </div>
      `,
      selector: ".pf-title-block input",
    },
    {
      theme: "light",
      name: "NPC light CR label",
      html: `
        <div class="pf-npc-sheet">
          <header class="pf-sheet-header">
            <div class="pf-header-stats">
              <label><span>CR</span><input type="text" value="1" disabled /></label>
            </div>
          </header>
        </div>
      `,
      selector: ".pf-header-stats span",
    },
    {
      theme: "light",
      name: "NPC light CR input",
      html: `
        <div class="pf-npc-sheet">
          <header class="pf-sheet-header">
            <div class="pf-header-stats">
              <label><span>CR</span><input type="text" value="1" disabled /></label>
            </div>
          </header>
        </div>
      `,
      selector: ".pf-header-stats input",
    },
    {
      theme: "light",
      name: "NPC light select",
      html: `
        <div class="pf-npc-sheet">
          <label><span>Tier</span><select disabled><option>Standard</option></select></label>
        </div>
      `,
      selector: "select",
    },
    {
      theme: "light",
      name: "NPC light attribute input",
      html: `
        <div class="pf-npc-sheet">
          <label><span>HP</span><input type="number" value="15" disabled /></label>
        </div>
      `,
      selector: "input",
    },
    {
      theme: "dark",
      name: "NPC dark name input",
      html: `
        <div class="pf-npc-sheet">
          <header class="pf-sheet-header">
            <div class="pf-title-block">
              <label>Name</label>
              <input type="text" value="Goblin Raider" disabled />
            </div>
          </header>
        </div>
      `,
      selector: ".pf-title-block input",
    },
    {
      theme: "dark",
      name: "NPC dark CR label",
      html: `
        <div class="pf-npc-sheet">
          <header class="pf-sheet-header">
            <div class="pf-header-stats">
              <label><span>CR</span><input type="text" value="1" disabled /></label>
            </div>
          </header>
        </div>
      `,
      selector: ".pf-header-stats span",
    },
  ];

  console.log("\n=== Contrast Measurements ===\n");

  for (const test of tests) {
    const html = generateHTML(test.theme, test.html);
    await page.setContent(html);
    await page.setViewportSize({ width: 800, height: 600 });

    const measurement = await page.evaluate((sel) => {
      /* eslint-disable no-undef */
      const element = document.querySelector(sel);
      if (!element) return { error: "Element not found" };

      const styles = window.getComputedStyle(element);
      const parent = element.parentElement || document.body;
      const parentStyles = window.getComputedStyle(parent);

      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        parentBg: parentStyles.backgroundColor,
      };
      /* eslint-enable no-undef */
    }, test.selector);

    if (measurement.error) {
      console.log(`${test.name}: ERROR - ${measurement.error}`);
      continue;
    }

    // Parse rgb values
    const fgMatch = measurement.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const bgMatch = (
      measurement.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? measurement.backgroundColor
        : measurement.parentBg
    ).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

    if (fgMatch && bgMatch) {
      const fgL = relativeLuminance(
        parseInt(fgMatch[1]),
        parseInt(fgMatch[2]),
        parseInt(fgMatch[3]),
      );
      const bgL = relativeLuminance(
        parseInt(bgMatch[1]),
        parseInt(bgMatch[2]),
        parseInt(bgMatch[3]),
      );
      const ratio = contrastRatio(fgL, bgL);
      const pass = ratio >= 4.5 ? "✓ PASS" : "✗ FAIL";
      console.log(`${test.name}: ${ratio.toFixed(2)}:1 ${pass}`);
    } else {
      console.log(
        `${test.name}: Could not parse colors (fg: ${measurement.color}, bg: ${measurement.backgroundColor})`,
      );
    }
  }

  await browser.close();
}

measureContrast().catch(console.error);
