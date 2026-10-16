import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function template(path) {
  return readFileSync(path, "utf8");
}

describe("sheet templates", () => {
  it("keeps npc edit and delete actions", () => {
    const source = template("templates/actors/npc-sheet.hbs");
    expect(source).toContain('data-action="editItem"');
    expect(source).toContain('data-action="deleteItem"');
    expect(source).toContain("{{disabledAttr}}");
  });

  it("keeps item weapon and feature sections", () => {
    const source = template("templates/items/item-sheet.hbs");
    expect(source).toContain("{{#if isWeapon}}");
    expect(source).toContain("{{#if isFeature}}");
    expect(source).toContain("{{disabledAttr}}");
  });
});
