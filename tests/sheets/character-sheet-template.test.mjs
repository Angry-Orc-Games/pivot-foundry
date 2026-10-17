import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
