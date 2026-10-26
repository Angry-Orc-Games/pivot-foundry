import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { prepareCharacterSheetContext } from "../../src/sheets/character-sheet.ts";

Handlebars.registerHelper("localize", (key) => key);
Handlebars.registerHelper("checked", (value) => (value ? "checked" : ""));
Handlebars.registerHelper("selectOptions", () => "");

describe("character sheet template structure", () => {
  it("vitals partial includes ability rows", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/vitals.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Verify the vitals partial uses the abilityRows data
    expect(template).toContain("{{#each abilityRows}}");
    expect(template).toContain('data-roll-kind="ability"');
    expect(template).toContain('data-roll-kind="save"');
    expect(template).toContain("{{scorePath}}");
    expect(template).toContain("{{primaryPath}}");
    expect(template).toContain('aria-label="Primary {{label}}"');
    expect(template).not.toContain(">Primary</span>");
    expect(template).toContain("★");
    expect(template).toContain("☆");
    expect(template).toContain("pf-init-line");
    expect(template.replace(/\s+/g, " ")).toContain(
      "Initiative {{#if initiativeText}}{{initiativeText}}{{else}}{{derived.initiative}}{{/if}}",
    );
    expect(template).toContain("{{short}}");
    expect(template).toContain("{{mod}}");
    expect(template).toContain("{{save}}");
  });

  it("header partial includes concept and tier fields", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/header.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Verify new header fields
    expect(template).toContain('name="system.identity.concept"');
    expect(template).toContain("{{speciesLabel}}");
    expect(template).toContain("{{backgroundLabel}}");
    expect(template).toContain("{{system.identity.focus}}");
  });

  it("header prints a comma only between species and background", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/header.hbs");
    const render = Handlebars.compile(readFileSync(templatePath, "utf-8"));
    const base = {
      actor: { name: "Rest" },
      editable: false,
      tierLabel: "",
      system: { identity: { concept: "", focus: "" }, progression: { level: 1, xp: 0 } },
    };
    const beforeLevel = (labels) =>
      render({ ...base, ...labels })
        .replace(/<[^>]+>/g, "")
        .split("Pivot:")[0]
        .replace(/\s+/g, " ");

    expect(beforeLevel({ speciesLabel: "", backgroundLabel: "" })).not.toContain(",");
    expect(beforeLevel({ speciesLabel: "Elf", backgroundLabel: "" })).not.toContain(",");
    expect(beforeLevel({ speciesLabel: "", backgroundLabel: "Veteran" })).not.toContain(",");
    expect(beforeLevel({ speciesLabel: "Elf", backgroundLabel: "Veteran" })).toContain(
      "Elf, Veteran",
    );
  });

  it("sheet page keeps survival, inventory, magic, and notes on one page", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/sheet.hbs");
    const template = readFileSync(templatePath, "utf-8");

    expect(template).not.toContain("pf-tabs");
    expect(template).not.toContain('data-tab="sheet"');
    expect(template).toContain('data-action="shortRest"');
    expect(template).toContain('data-action="longRest"');
    expect(template).toContain('data-action="deathSave"');
    expect(template).toContain('data-type="weapon"');
    expect(template).toContain('data-type="armour"');
    expect(template).toContain('data-type="equipment"');
    expect(template).toContain('name="system.magic.awakened"');
    expect(template).toContain('name="system.magic.mp.value"');
    expect(template).not.toMatch(
      /data-path="magic\.mp\.value"[\s\S]*<span>\{\{system\.magic\.mp\.value\}\}/,
    );
    expect(template).not.toContain('name="system.attributes.hp.value"');
    const hpLine = template
      .slice(
        template.indexOf('class="pf-hp-line"'),
        template.indexOf("</div>", template.indexOf('class="pf-hp-line"')),
      )
      .replace(/\s+/g, " ");
    expect(hpLine).toContain(
      '<span class="pf-hp-readout">{{system.attributes.hp.value}} / {{system.attributes.hp.max}}</span>',
    );
    expect(hpLine).not.toContain("<input");
    expect(hpLine).not.toContain("name=");
    expect(hpLine).toContain('data-action="survivalRoll"');
    expect(hpLine).toContain('data-action="correctSurvival"');
    expect(template).toContain('name="system.notes.special"');
    expect(template).toContain('name="system.notes.runesThaumaturgy"');
    expect(template).toContain('name="system.identity.loyalty"');
    expect(template).toContain("<h3>Magic</h3>");
    expect(template).toContain("<h3>Body modifications</h3>");
    expect(template).toContain("<h3>Gear and funds</h3>");
    expect(template).toContain("<h3>Loyalty and details</h3>");
    expect(template).toContain('class="pf-survival"');
    expect(template.indexOf("<h3>Gear and funds</h3>")).toBeLessThan(
      template.indexOf('class="pf-survival"'),
    );
    expect(template.indexOf('class="pf-survival"')).toBeLessThan(
      template.indexOf("<h3>Loyalty and details</h3>"),
    );
    expect(template.indexOf("<h3>Feats</h3>")).toBeLessThan(
      template.indexOf("<h3>Body modifications</h3>"),
    );
    expect(template.indexOf("<h3>Body modifications</h3>")).toBeLessThan(
      template.indexOf("<h3>Magic</h3>"),
    );
    expect(template.indexOf("<h3>Magic</h3>")).toBeLessThan(template.indexOf("<h3>Traits</h3>"));
  });

  it("sheet partial has two-column print layout", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/sheet.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Verify print layout structure
    expect(template).toContain('class="pf-cols"');
    expect(template).toContain('class="pf-table pf-skills"');
    expect(template).toContain('class="pf-table pf-attacks"');
    expect(template).toContain("{{#each items.feats}}");
    expect(template).toContain("{{#each items.flaws}}");
    expect(template).toContain("{{#each items.traits}}");
    expect(template).toContain("{{proficiencyText.weapons}}");
    expect(template).toContain("{{proficiencyText.armour}}");
    expect(template).toContain("{{proficiencyText.shields}}");
  });

  it("keeps a skill name click from toggling proficiency and gives traits add and delete", () => {
    const sheet = Handlebars.compile(
      readFileSync(resolve(process.cwd(), "templates/actors/character/sheet.hbs"), "utf-8"),
    );
    const vitals = Handlebars.compile(
      readFileSync(resolve(process.cwd(), "templates/actors/character/vitals.hbs"), "utf-8"),
    );
    const sheetDom = new JSDOM(
      sheet({
        skillRows: [
          {
            id: "medicine",
            label: "Medicine",
            ability: "Wis",
            proficient: false,
            proficientPath: "system.skills.medicine.proficient",
            total: "+2",
          },
        ],
        items: { traits: [{ id: "trait-1", name: "Keen", disabledAttr: "" }] },
        form: {},
        proficiencyText: {},
        system: { magic: {}, notes: {}, identity: {}, currency: {} },
        derived: { armourClass: {}, magic: { mp: {} } },
      }),
    ).window.document;
    const name = [...sheetDom.querySelectorAll("table.pf-skills *")].find((element) =>
      [...element.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent?.includes("Medicine"),
      ),
    );
    const checkbox = sheetDom.querySelector('input[name="system.skills.medicine.proficient"]');
    name?.click();
    expect(checkbox?.checked).toBe(false);
    expect(sheetDom.querySelector("label.pf-check")?.textContent ?? "").not.toContain("Medicine");
    expect(name?.tagName).toBe("BUTTON");
    expect(name?.dataset.action).toBe("roll");
    expect(name?.dataset.rollKind).toBe("skill");
    expect(name?.dataset.key).toBe("medicine");
    expect(name?.dataset.label).toBe("Medicine");

    const traits = [...sheetDom.querySelectorAll(".pf-section-header")].find((element) =>
      element.textContent?.includes("Traits"),
    );
    const add = traits?.querySelector("button");
    expect(add?.dataset.action).toBe("createItem");
    expect(add?.dataset.type).toBe("feature");
    expect(add?.dataset.category).toBe("other");
    const row = [...sheetDom.querySelectorAll("li")].find((element) =>
      element.textContent?.includes("Keen"),
    );
    expect(row?.querySelector('[data-action="openItem"]')).toBeTruthy();
    expect(row?.querySelector('[data-action="deleteItem"]')).toBeTruthy();

    const vitalsDom = new JSDOM(
      vitals({
        abilityRows: [
          {
            key: "str",
            label: "Strength",
            short: "Str",
            save: "+1",
            mod: "+1",
            score: 12,
            primary: false,
            scorePath: "system.abilities.str.score",
            primaryPath: "system.abilities.str.primary",
            abilityClass: "pf-ab",
          },
        ],
        derived: { initiative: 2, passivePerception: 12 },
      }),
    ).window.document;
    for (const kind of ["save", "initiative"]) {
      const control = vitalsDom.querySelector(`[data-roll-kind="${kind}"]`);
      expect(control?.tagName).toBe("BUTTON");
      expect(control?.closest("label")).toBeNull();
    }
  });

  function renderTemplates() {
    return {
      sheet: Handlebars.compile(
        readFileSync(resolve(process.cwd(), "templates/actors/character/sheet.hbs"), "utf-8"),
      ),
      vitals: Handlebars.compile(
        readFileSync(resolve(process.cwd(), "templates/actors/character/vitals.hbs"), "utf-8"),
      ),
    };
  }

  function speedCard(html) {
    const document = new JSDOM(html).window.document;
    const card = [...document.querySelectorAll(".pf-stat")].find(
      (element) => element.querySelector("b")?.textContent === "SPEED",
    );
    return card?.querySelector("span")?.textContent?.replace(/\s+/g, " ").trim();
  }

  it("prints the proficiency bonus on the initiative line and speed alone on the speed card", () => {
    const { vitals } = renderTemplates();
    const html = vitals(
      prepareCharacterSheetContext({
        name: "New Character",
        type: "character",
        system: {},
        items: [],
      }),
    );
    const css = [
      readFileSync(resolve(process.cwd(), "scripts/foundry-v14-form-fixture.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pf-tokens.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pivot-fantasy.css"), "utf-8"),
    ].join("\n");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${css}</style></head>
      <body class="theme-light"><form class="application pivot-fantasy pf-sheet sheet actor character">
        <section class="window-content">${html}</section></form></body></html>`,
      { pretendToBeVisual: true },
    );
    const document = dom.window.document;
    const speed = [...document.querySelectorAll(".pf-stat")].find(
      (element) => element.querySelector("b")?.textContent === "SPEED",
    );
    const line = document.querySelector(".pf-init-line");
    const passive = [...(line?.querySelectorAll("span") ?? [])].find((element) =>
      element.textContent?.includes("Passive Perception"),
    );
    const bonus = [...(line?.querySelectorAll("span") ?? [])].find((element) =>
      element.textContent?.includes("Prof. bonus"),
    );
    expect(speed?.textContent?.replace(/\s+/g, " ").trim()).toBe("SPEED 10 m");
    expect(line?.textContent?.replace(/\s+/g, " ").trim()).toContain("Prof. bonus +2");
    expect(line?.textContent).toContain("Initiative");
    expect(line?.textContent).toContain("Passive Perception");
    expect(bonus?.tagName).toBe("SPAN");
    const passiveStyle = dom.window.getComputedStyle(passive);
    const bonusStyle = dom.window.getComputedStyle(bonus);
    expect(bonusStyle.fontSize).toBe(passiveStyle.fontSize);
    expect(bonusStyle.color).toBe(passiveStyle.color);
    expect(bonusStyle.fontFamily).toBe(passiveStyle.fontFamily);
    expect(dom.window.getComputedStyle(line).gap).toBe("0.35em");
  });

  it("prints 10 m for a default actor and 0 m when speed is zero", () => {
    const { vitals } = renderTemplates();
    const blank = {
      name: "New Character",
      type: "character",
      system: {},
      items: [],
    };
    expect(speedCard(vitals(prepareCharacterSheetContext(blank)))).toBe("10 m");
    expect(
      speedCard(
        vitals(
          prepareCharacterSheetContext({
            ...blank,
            system: { attributes: { speed: { value: 0, bonus: 0 } } },
          }),
        ),
      ),
    ).toBe("0 m");
  });

  it("keeps an integer speed input with the survival fields", () => {
    const { sheet } = renderTemplates();
    const blank = {
      name: "New Character",
      type: "character",
      system: {},
      items: [],
    };
    const editing = new JSDOM(sheet(prepareCharacterSheetContext(blank))).window.document;
    const hpMax = editing.querySelector('input[name="system.attributes.hp.max"]');
    const speed = editing.querySelector('input[name="system.attributes.speed.value"]');
    expect(speed?.getAttribute("type")).toBe("number");
    expect(speed?.getAttribute("min")).toBe("0");
    expect(speed?.getAttribute("step")).toBe("1");
    expect(speed?.disabled).toBe(false);
    expect(speed?.closest("label")?.textContent).toContain("PIVOT.Fields.Speed");
    expect(speed?.closest(".pf-meter-fields")).toBe(hpMax?.closest(".pf-meter-fields"));

    const stopped = prepareCharacterSheetContext(
      {
        ...blank,
        system: { attributes: { speed: { value: 0, bonus: 0 } } },
      },
      false,
    );
    const viewing = new JSDOM(sheet(stopped)).window.document;
    const locked = viewing.querySelector('input[name="system.attributes.speed.value"]');
    expect(locked?.disabled).toBe(true);
    expect(locked?.value).toBe("0");
  });

  function skillSheet(disabledAttr) {
    const { sheet } = renderTemplates();
    return new JSDOM(
      sheet({
        skillRows: [
          {
            id: "medicine",
            label: "Medicine",
            ability: "Wis",
            proficient: false,
            proficientPath: "system.skills.medicine.proficient",
            total: "+2",
            disabledAttr,
          },
        ],
        items: { traits: [] },
        form: {},
        proficiencyText: {},
        system: { magic: {}, notes: {}, identity: {}, currency: {} },
        derived: { armourClass: {}, magic: { mp: {} } },
        disabledAttr,
      }),
    ).window.document;
  }

  it("locks the proficiency dot when the sheet is not editable", () => {
    const locked = skillSheet("disabled");
    const checkbox = locked.querySelector('input[name="system.skills.medicine.proficient"]');
    expect(checkbox?.disabled).toBe(true);
    expect(checkbox?.closest("label")?.getAttribute("title")).toBe(
      "PIVOT.Actions.ToggleProficiency",
    );
    locked.querySelector("button.pf-skill-name")?.click();
    locked.querySelector("td.pf-r button")?.click();
    expect(checkbox?.checked).toBe(false);

    const editing = skillSheet("");
    expect(editing.querySelector('input[name="system.skills.medicine.proficient"]')?.disabled).toBe(
      false,
    );
    const english = JSON.parse(readFileSync(resolve(process.cwd(), "lang/en.json"), "utf-8"));
    expect(english["PIVOT.Actions.ToggleProficiency"]).toBe("Toggle proficiency");
  });

  it("does not paint a locked proficiency dot as clickable", () => {
    const css = [
      readFileSync(resolve(process.cwd(), "scripts/foundry-v14-form-fixture.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pf-tokens.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pivot-fantasy.css"), "utf-8"),
    ].join("\n");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${css}</style></head><body></body></html>`,
      { pretendToBeVisual: true },
    );
    const rules = [...dom.window.document.styleSheets].flatMap((styleSheet) => {
      try {
        return [...styleSheet.cssRules];
      } catch {
        return [];
      }
    });
    const lockedHover = rules.find(
      (rule) =>
        typeof rule.selectorText === "string" &&
        rule.selectorText.includes("pf-check") &&
        rule.selectorText.includes(":disabled") &&
        rule.selectorText.includes(":hover"),
    );
    expect(lockedHover?.style?.cursor).toBe("default");
    expect(lockedHover?.style?.color).toBe("rgb(28, 26, 22)");
  });

  it("shows a muted line when the character has no traits", () => {
    const { sheet } = renderTemplates();
    const empty = new JSDOM(
      sheet({
        skillRows: [],
        items: { traits: [] },
        form: {},
        proficiencyText: {},
        system: { magic: {}, notes: {}, identity: {}, currency: {} },
        derived: { armourClass: {}, magic: { mp: {} } },
      }),
    ).window.document;
    const note = [...empty.querySelectorAll("p.pf-small")].find((element) =>
      element.textContent?.includes("PIVOT.Messages.NoTraits"),
    );
    expect(note).toBeTruthy();
    const header = [...empty.querySelectorAll(".pf-section-header")].find((element) =>
      element.textContent?.includes("Traits"),
    );
    expect(header?.querySelector("button")?.textContent?.trim()).toBe("+");
    expect(header?.querySelector("button")?.dataset.action).toBe("createItem");

    const filled = new JSDOM(
      sheet({
        skillRows: [],
        items: { traits: [{ id: "trait-1", name: "Keen", disabledAttr: "" }] },
        form: {},
        proficiencyText: {},
        system: { magic: {}, notes: {}, identity: {}, currency: {} },
        derived: { armourClass: {}, magic: { mp: {} } },
      }),
    ).window.document;
    expect(
      [...filled.querySelectorAll("p.pf-small")].some((element) =>
        element.textContent?.includes("PIVOT.Messages.NoTraits"),
      ),
    ).toBe(false);
    const row = [...filled.querySelectorAll("li")].find((element) =>
      element.textContent?.includes("Keen"),
    );
    const controls = [...(row?.querySelectorAll("button") ?? [])].map((element) =>
      element.textContent?.trim(),
    );
    expect(controls).toContain("...");
    expect(controls).toContain("x");
    const english = JSON.parse(readFileSync(resolve(process.cwd(), "lang/en.json"), "utf-8"));
    expect(english["PIVOT.Messages.NoTraits"]).toBe("No traits yet");
  });

  it("gives the proficiency dot a 20px target", () => {
    const css = [
      readFileSync(resolve(process.cwd(), "scripts/foundry-v14-form-fixture.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pf-tokens.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pivot-fantasy.css"), "utf-8"),
    ].join("\n");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${css}</style></head>
      <body class="theme-light"><form class="application pivot-fantasy pf-sheet sheet actor character">
        <section class="window-content"><article class="pf-print">
          <table class="pf-skills"><tr><td>
            <label class="pf-check"><input class="pf-sr" type="checkbox" /><span class="pf-prof-mark">○</span></label>
            <button type="button" class="pf-roll pf-skill-name">Medicine</button>
          </td><td class="pf-r"><button type="button" class="pf-roll">+2</button></td></tr></table>
        </article></section></form></body></html>`,
      { pretendToBeVisual: true },
    );
    const dot = dom.window.document.querySelector("label.pf-check");
    const dotStyle = dom.window.getComputedStyle(dot);
    expect(Number.parseFloat(dotStyle.minWidth)).toBeGreaterThanOrEqual(20);
    expect(Number.parseFloat(dotStyle.minHeight)).toBeGreaterThanOrEqual(20);
  });

  it("gives both proficiency marks the same ink ring and fills the proficient mark", () => {
    const css = [
      readFileSync(resolve(process.cwd(), "scripts/foundry-v14-form-fixture.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pf-tokens.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pivot-fantasy.css"), "utf-8"),
    ].join("\n");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${css}</style></head>
      <body class="theme-light"><form class="application pivot-fantasy pf-sheet sheet actor character">
        <section class="window-content"><article class="pf-print">
          <table class="pf-skills"><tbody>
            <tr><td><label class="pf-check"><input class="pf-sr" type="checkbox" /><span class="pf-prof-mark">○</span></label></td></tr>
            <tr><td><label class="pf-check"><input class="pf-sr" type="checkbox" checked /><span class="pf-prof-mark">●</span></label></td></tr>
          </tbody></table>
        </article></section></form></body></html>`,
      { pretendToBeVisual: true },
    );
    const empty = dom.window.document.querySelector(
      "label.pf-check:not(:has(input:checked)) .pf-prof-mark",
    );
    const filled = dom.window.document.querySelector(
      "label.pf-check:has(input:checked) .pf-prof-mark",
    );
    const emptyStyle = dom.window.getComputedStyle(empty);
    const filledStyle = dom.window.getComputedStyle(filled);
    const labelStyle = dom.window.getComputedStyle(empty.closest("label"));
    expect(empty.textContent).toBe("○");
    expect(emptyStyle.borderTopStyle).toBe("solid");
    expect(emptyStyle.borderTopColor).toBe("rgb(28, 26, 22)");
    expect(Number.parseFloat(emptyStyle.borderTopWidth)).toBeGreaterThanOrEqual(1.5);
    expect(emptyStyle.borderRadius).toBe("50%");
    expect(filled.textContent).toBe("●");
    expect(filledStyle.backgroundColor).toBe("rgb(28, 26, 22)");
    expect(filledStyle.borderTopStyle).toBe("solid");
    expect(filledStyle.borderTopColor).toBe(emptyStyle.borderTopColor);
    expect(filledStyle.borderTopWidth).toBe(emptyStyle.borderTopWidth);
    expect(Number.parseFloat(labelStyle.minWidth)).toBeGreaterThanOrEqual(20);
    expect(Number.parseFloat(labelStyle.minHeight)).toBeGreaterThanOrEqual(20);
  });

  it("draws the filled proficiency mark at the same outer size as the empty ring", () => {
    const css = [
      readFileSync(resolve(process.cwd(), "scripts/foundry-v14-form-fixture.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pf-tokens.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pivot-fantasy.css"), "utf-8"),
    ].join("\n");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${css}</style></head>
      <body class="theme-light"><form class="application pivot-fantasy pf-sheet sheet actor character">
        <section class="window-content"><article class="pf-print">
          <table class="pf-skills"><tbody>
            <tr><td><label class="pf-check"><input class="pf-sr" type="checkbox" /><span class="pf-prof-mark">○</span></label></td></tr>
            <tr><td><label class="pf-check"><input class="pf-sr" type="checkbox" checked /><span class="pf-prof-mark">●</span></label></td></tr>
          </tbody></table>
        </article></section></form></body></html>`,
      { pretendToBeVisual: true },
    );
    const empty = dom.window.document.querySelector(
      "label.pf-check:not(:has(input:checked)) .pf-prof-mark",
    );
    const filled = dom.window.document.querySelector(
      "label.pf-check:has(input:checked) .pf-prof-mark",
    );
    const box = (style) => ({
      width: style.width,
      height: style.height,
      boxSizing: style.boxSizing,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
    });
    expect(box(dom.window.getComputedStyle(filled))).toEqual(
      box(dom.window.getComputedStyle(empty)),
    );
  });

  it("keeps rendered skills alphabetical after a proficiency toggle", () => {
    const sheet = Handlebars.compile(
      readFileSync(resolve(process.cwd(), "templates/actors/character/sheet.hbs"), "utf-8"),
    );
    const actor = {
      name: "Toggle",
      type: "character",
      system: {
        skills: {
          acrobatics: { ability: "dex", proficient: false },
          alchemy: { ability: "int", proficient: false },
        },
      },
      items: [],
    };
    const labels = () => {
      const document = new JSDOM(sheet(prepareCharacterSheetContext(actor))).window.document;
      return [...document.querySelectorAll("table.pf-skills button.pf-skill-name")].map((button) =>
        button.textContent?.replace(/\s+/g, " ").trim(),
      );
    };
    const before = labels();
    actor.system.skills.alchemy.proficient = true;
    const after = labels();
    expect(after).toEqual([...after].sort((left, right) => left.localeCompare(right)));
    expect(after.indexOf("Acrobatics")).toBeLessThan(after.indexOf("Alchemy"));
    expect(after).toEqual(before);
  });

  it("underlines the skill name on hover", () => {
    const css = [
      readFileSync(resolve(process.cwd(), "scripts/foundry-v14-form-fixture.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pf-tokens.css"), "utf-8"),
      readFileSync(resolve(process.cwd(), "styles/pivot-fantasy.css"), "utf-8"),
    ].join("\n");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${css}</style></head><body></body></html>`,
      { pretendToBeVisual: true },
    );
    const rules = [...dom.window.document.styleSheets].flatMap((styleSheet) => {
      try {
        return [...styleSheet.cssRules];
      } catch {
        return [];
      }
    });
    const hover = rules.find(
      (rule) =>
        typeof rule.selectorText === "string" &&
        rule.selectorText.includes("pf-skill-name") &&
        rule.selectorText.includes(":hover"),
    );
    const decoration = `${hover?.style?.textDecorationLine || ""} ${hover?.style?.textDecoration || ""}`;
    expect(decoration).toContain("underline");
    expect(hover?.style?.cursor).toBe("pointer");
    expect(hover?.style?.color).toBe("rgb(138, 59, 18)");
  });

  it("vitals partial includes stat cards and abilities", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/vitals.hbs");
    const template = readFileSync(templatePath, "utf-8");

    expect(template).toContain('class="pf-stats"');
    expect(template).toContain('class="pf-stat"');
    expect(template).toContain("ARMOUR CLASS");
    expect(template).toContain("HIT POINTS");
    expect(template).toContain("SPEED");
    expect(template).toContain("POOL");

    // Verify abilities grid
    expect(template).toContain('class="pf-abil"');
    expect(template).toContain('class="{{abilityClass}}"');
  });

  it("renders a Slings training checkbox between Crossbows and Thrown Weapons", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/sheet.hbs");
    const source = readFileSync(templatePath, "utf-8");
    const start = source.indexOf("{{#each weaponTrainingRows}}");
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf("{{/each}}", start));
    expect(block).toContain("pf-check");
    expect(block).toContain("pf-sr");
    expect(block).toContain("pf-prof-mark");
    expect(block).toContain("{{checked proficient}}");
    expect(block).toContain("{{disabledAttr}}");

    const render = Handlebars.compile(source);
    const context = prepareCharacterSheetContext({
      name: "Slinger",
      type: "character",
      system: {
        proficiencies: {
          weapons: { bows: true, crossbows: true, slings: true, thrown: true },
        },
      },
      items: [],
    });
    const dom = new JSDOM(render(context)).window.document;
    const inputs = [...dom.querySelectorAll('input[name^="system.proficiencies.weapons."]')];
    expect(inputs.map((input) => input.getAttribute("name"))).toEqual([
      "system.proficiencies.weapons.meleeLight",
      "system.proficiencies.weapons.meleeMedium",
      "system.proficiencies.weapons.meleeHeavy",
      "system.proficiencies.weapons.meleeTwoHandedHeavy",
      "system.proficiencies.weapons.improvised",
      "system.proficiencies.weapons.bows",
      "system.proficiencies.weapons.crossbows",
      "system.proficiencies.weapons.slings",
      "system.proficiencies.weapons.thrown",
    ]);
    expect(inputs.map((input) => input.getAttribute("aria-label"))).toEqual([
      "Proficient in Light Melee",
      "Proficient in Medium Melee",
      "Proficient in Heavy Melee",
      "Proficient in Two-Handed Heavy Melee",
      "Proficient in Improvised",
      "Proficient in Bows",
      "Proficient in Crossbows",
      "Proficient in Slings",
      "Proficient in Thrown Weapons",
    ]);
    const slings = dom.querySelector('input[name="system.proficiencies.weapons.slings"]');
    expect(slings?.classList.contains("pf-sr")).toBe(true);
    expect(slings?.closest("label")?.classList.contains("pf-check")).toBe(true);
    expect(slings?.parentElement?.querySelector(".pf-prof-mark")).toBeTruthy();
  });
});
