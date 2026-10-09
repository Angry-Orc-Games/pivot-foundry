import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("character sheet template structure", () => {
  it("renders abilities section before tabs navigation", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character-sheet.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Find the position of the abilities panel and the tabs navigation
    const abilitiesPanelIndex = template.indexOf('class="pivot-panel pivot-abilities-panel"');
    const tabsNavigationIndex = template.indexOf('class="tabs pivot-tabs"');
    const tabBodyIndex = template.indexOf('class="pivot-tab-body"');

    // Verify that the abilities panel exists
    expect(abilitiesPanelIndex).toBeGreaterThan(-1);

    // Verify that tabs navigation exists
    expect(tabsNavigationIndex).toBeGreaterThan(-1);

    // Verify that abilities panel comes before tabs navigation
    expect(abilitiesPanelIndex).toBeLessThan(tabsNavigationIndex);

    // Verify that abilities panel comes before tab body
    expect(abilitiesPanelIndex).toBeLessThan(tabBodyIndex);

    // Verify that tabs navigation comes before tab body
    expect(tabsNavigationIndex).toBeLessThan(tabBodyIndex);
  });

  it("does not include abilities section inside Core tab", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character-sheet.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Verify that abilities are not duplicated in the Core tab
    // The abilities should only appear in the top-level panel, not inside the Core tab
    const abilitiesHeadingCount = (template.match(/PIVOT\.Sections\.Abilities/g) || []).length;
    expect(abilitiesHeadingCount).toBe(1);
  });

  it("includes all six ability rows in the abilities panel", () => {
    const templatePath = resolve(process.cwd(), "templates/actors/character-sheet.hbs");
    const template = readFileSync(templatePath, "utf-8");

    // Extract the abilities panel content
    const abilitiesPanelStart = template.indexOf('class="pivot-panel pivot-abilities-panel"');
    const abilitiesPanelEnd = template.indexOf("</section>", abilitiesPanelStart);
    const abilitiesPanelContent = template.slice(abilitiesPanelStart, abilitiesPanelEnd);

    // Verify the abilities panel uses the abilityRows data
    expect(abilitiesPanelContent).toContain("{{#each abilityRows}}");
    expect(abilitiesPanelContent).toContain('data-roll-kind="ability"');
    expect(abilitiesPanelContent).toContain('data-roll-kind="save"');
    expect(abilitiesPanelContent).toContain("{{scorePath}}");
    expect(abilitiesPanelContent).toContain("{{primaryPath}}");
  });
});
