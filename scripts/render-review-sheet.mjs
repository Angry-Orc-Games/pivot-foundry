import { chromium } from "playwright";
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/screenshots/character-sheet");
const fontDir = "/tmp/fonts";

const foundryForm = readFileSync(join(root, "scripts/foundry-v14-form-fixture.css"), "utf-8");
const tokens = readFileSync(join(root, "styles/pf-tokens.css"), "utf-8");
const css = readFileSync(join(root, "styles/pivot-fantasy.css"), "utf-8");
const enJson = JSON.parse(readFileSync(join(root, "lang/en.json"), "utf-8"));
const templateDir = join(root, "templates/actors/character");

Handlebars.registerHelper("localize", (key) => enJson[key] || key);
Handlebars.registerHelper("checked", (value) => (value ? "checked" : ""));
Handlebars.registerHelper("selectOptions", () => "");

const header = Handlebars.compile(readFileSync(join(templateDir, "header.hbs"), "utf-8"));
const vitals = Handlebars.compile(readFileSync(join(templateDir, "vitals.hbs"), "utf-8"));
const sheet = Handlebars.compile(readFileSync(join(templateDir, "sheet.hbs"), "utf-8"));

function skill(id, label, ability, proficient, total) {
  return {
    id,
    label,
    ability,
    proficientPath: `system.skills.${id}.proficient`,
    proficient,
    expertise: false,
    total,
    disabledAttr: "",
  };
}

function buildContext(editable) {
  const disabledAttr = editable ? "" : "disabled";
  const skills = [
    skill("athletics", "Athletics", "Str", true, "+5"),
    skill("intimidation", "Intimidation", "Cha", true, "+1"),
    skill("perception", "Perception", "Wis", true, "+4"),
    skill("survival", "Survival", "Wis", true, "+4"),
    skill("acrobatics", "Acrobatics", "Dex", false, "+1"),
    skill("alchemy", "Alchemy", "Int", false, "+0"),
    skill("animalHandling", "Animal Handling", "Wis", false, "+2"),
    skill("deception", "Deception", "Cha", false, "-1"),
    skill("insight", "Insight", "Wis", false, "+2"),
    skill("stealth", "Stealth", "Dex", false, "+1"),
  ].map((row) => ({ ...row, disabledAttr }));

  return {
    actor: { name: "Brakka Ironvein" },
    editable,
    disabledAttr,
    speciesLabel: "Human",
    backgroundLabel: "Veteran",
    tierLabel: "Tier 2",
    conMod: "+2",
    scoreSourceText: "Score sources. Wis: base 13, species +1, Fearless +1.",
    proficiencyText: {
      weapons: "Melee Medium",
      armour: "Medium",
      shields: "Yes",
    },
    magicStreamsText: "Aggregate",
    form: {
      languagesText: "Common, Dwarvish",
      academiaText: "",
      craftingText: "",
    },
    system: {
      identity: {
        concept: "A deserter-turned-caravan guard who still salutes officers by reflex.",
        focus: "Up-close fighter",
        speciesText: "Broad, scarred knuckles, regimental braid.",
        backgroundText: "The border fort at Kessel Ford.",
        loyalty: "The squad that carried her out",
        player: "",
        age: "",
        height: "",
        eyes: "",
        hair: "",
        weight: { value: null },
        languagesText: "Common, Dwarvish",
      },
      progression: { level: 1, xp: 0, buildPoints: 9, progressionPoints: 0 },
      attributes: {
        hp: { value: 10, max: 10, temp: 0 },
        hitDie: "d8",
        deathSaves: { successes: 0, failures: 0 },
      },
      resources: { pool: { value: 1 } },
      magic: { awakened: false, ability: "", mp: { value: 0 } },
      currency: { gp: 54, sp: 0, cp: 0, other: "" },
      notes: { special: "GM ruled the deserter bounty is 40 gp.", runesThaumaturgy: "" },
    },
    derived: {
      armourClass: {
        value: 16,
        armourWorn: "Medium armour + Large Shield",
        breakdown: "10 + 3 + 3",
      },
      speed: { value: 10 },
      proficiencyBonus: 2,
      initiative: 1,
      passivePerception: 14,
      pool: { max: 1 },
      magic: { mp: { max: 0 } },
      totalWeight: 31,
    },
    abilityRows: [
      ["str", "STR", 16, "+3", "+5", true],
      ["dex", "DEX", 13, "+1", "+1", false],
      ["con", "CON", 15, "+2", "+4", true],
      ["int", "INT", 11, "+0", "+0", false],
      ["wis", "WIS", 15, "+2", "+2", false],
      ["cha", "CHA", 9, "-1", "-1", false],
    ].map(([key, short, score, mod, save, primary]) => ({
      key,
      label: short,
      short,
      scorePath: `system.abilities.${key}.score`,
      primaryPath: `system.abilities.${key}.primary`,
      score,
      primary,
      mod,
      save,
      abilityClass: primary ? "pf-ab pf-prime" : "pf-ab",
      disabledAttr,
    })),
    skillRows: skills,
    hpPercent: 100,
    poolPercent: 100,
    survivalLabel: "PIVOT.Survival.alive",
    survivalStatus: "alive",
    deathSaveSuccessPips: [false, false, false],
    deathSaveFailurePips: [false, false, false],
    isGM: false,
    config: { magicAbilities: [], hitDiceChoices: { d8: "d8" } },
    items: {
      weapons: [
        {
          id: "w1",
          name: "Arming sword",
          disabledAttr,
          summary: { damageFormula: "1d6+3", bth: "+5", btd: 3, range: { normal: 0, long: 0 } },
          system: { quantity: 1 },
        },
      ],
      armour: [
        {
          id: "a1",
          name: "Medium armour",
          disabledAttr,
          system: { category: "medium", acBonus: 3, equipped: true },
        },
      ],
      equipment: [
        {
          id: "e1",
          name: "Basic Outfit",
          disabledAttr,
          system: { quantity: 1, weight: 2, carried: true },
        },
        {
          id: "e2",
          name: "Hooded lantern",
          disabledAttr,
          system: { quantity: 1, weight: 1, carried: true },
        },
        {
          id: "e3",
          name: "Flask of oil",
          disabledAttr,
          system: { quantity: 2, weight: 1, carried: true },
        },
      ],
      feats: [{ id: "f1", name: "Fearless", disabledAttr }],
      flaws: [
        {
          id: "fl1",
          name: "Deep Sleeper",
          disabledAttr,
          system: { cost: { bp: 1 } },
        },
      ],
      bodyModifications: [{ id: "b1", name: "Scarred knuckles", disabledAttr }],
      traits: [{ id: "t1", name: "Extra language of your choice", disabledAttr }],
      features: [],
      magicStreams: [],
      magicAbilities: [],
    },
  };
}

function pageHtml(theme, width, context) {
  const fontCss = readFileSync(join(fontDir, "signika.css"), "utf-8");
  const appTheme = theme === "dark" ? "theme-dark" : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    ${fontCss}
    body { margin: 0; background: ${theme === "dark" ? "#1b1814" : "#f3ede0"}; }
    ${foundryForm}
    ${tokens}
    ${css}
    .pivot-fantasy { --font-primary: Signika, system-ui, sans-serif; }
    .pf-sheet .window-content { width: ${width}px; padding: 12px 0; }
  </style>
</head>
<body class="${theme === "dark" ? "theme-dark" : "theme-light"}">
  <form class="application pivot-fantasy pf-sheet sheet actor character ${appTheme}">
    <section class="window-content">
      ${header(context)}
      ${vitals(context)}
      ${sheet(context)}
    </section>
  </form>
</body>
</html>`;
}

async function ensureSignika() {
  mkdirSync(fontDir, { recursive: true });
  const cssPath = join(fontDir, "signika.css");
  if (existsSync(cssPath)) return;
  const remote = await fetch(
    "https://fonts.googleapis.com/css2?family=Signika:wght@400;600;700&display=swap",
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  let cssText = await remote.text();
  const urls = [...cssText.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]);
  for (const url of urls) {
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    cssText = cssText.replace(url, `data:font/ttf;base64,${bytes.toString("base64")}`);
  }
  writeFileSync(cssPath, cssText);
}

const shots = [];
for (const mode of ["view", "edit"]) {
  for (const theme of ["light", "dark"]) {
    for (const width of [900, 675, 640]) {
      shots.push({ mode, theme, width, name: `${mode}-${theme}-${width}.png` });
    }
  }
}

await ensureSignika();
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const shot of shots) {
  const context = buildContext(shot.mode === "edit");
  const htmlPath = join(fontDir, `sheet-${shot.name}.html`);
  writeFileSync(htmlPath, pageHtml(shot.theme, shot.width, context));
  await page.goto(`file://${htmlPath}`);
  const paper = page.locator(".pf-print-wrap").first();
  const box = await paper.boundingBox();
  if (!box || Math.round(box.width) !== shot.width) {
    throw new Error(`${shot.name} paper width ${box?.width} wanted ${shot.width}`);
  }
  await page.locator(".window-content").screenshot({ path: join(outDir, shot.name) });
  console.log(`${shot.name} paper ${Math.round(box.width)}px`);
}

await browser.close();
