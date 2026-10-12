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
    expect(template).toContain("{{tierLabel}}");
    expect(template).toContain("{{system.identity.focus}}");
  });

  it("tabs partial includes Sheet, Survival, Inventory, Magic, Notes tabs", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character/tabs.hbs");
    const template = readFileSync(templatePath, "utf-8");

    expect(template).toContain('data-tab="sheet"');
    expect(template).toContain('data-tab="survival"');
    expect(template).toContain('data-tab="inventory"');
    expect(template).toContain('data-tab="magic"');
    expect(template).toContain('data-tab="notes"');
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
