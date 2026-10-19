import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

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

  it("vitals partial includes stat cards and abilities", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/vitals.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Verify stat cards
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
});
