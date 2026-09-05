import { describe, expect, it } from "vitest";

import en from "../lang/en.json";
import manifestJson from "../system.json";

type SystemManifest = {
  styles?: string[];
  documentTypes?: {
    Actor?: Record<string, unknown>;
    Item?: Record<string, unknown>;
  };
};

const manifest = manifestJson as SystemManifest;

describe("system manifest", () => {
  it("declares a character Actor subtype for Foundry document validation", () => {
    expect(manifest.documentTypes?.Actor).toHaveProperty("character");
  });

  it("declares Pivot Item subtypes used by the native sheets", () => {
    expect(manifest.documentTypes?.Item).toEqual(
      expect.objectContaining({
        armour: {},
        equipment: {},
        feature: {},
        magicAbility: {},
        magicStream: {},
        weapon: {},
      }),
    );
  });

  it("declares the sheet stylesheet", () => {
    expect(manifest.styles).toContain("styles/pivot-fantasy.css");
  });
});

describe("english localization", () => {
  it("defines roll-mode dialog keys used by the character sheet", () => {
    expect(en).toMatchObject({
      "PIVOT.RollDialog.Cancel": "Cancel",
      "PIVOT.RollDialog.Roll": "Roll",
      "PIVOT.RollDialog.Title": "Choose roll mode",
      "PIVOT.RollMode.Advantage": "Advantage",
      "PIVOT.RollMode.Disadvantage": "Disadvantage",
      "PIVOT.RollMode.Normal": "Normal",
      "PIVOT.RollMode.SuperAdvantage": "Super-Advantage",
    });
  });
});
