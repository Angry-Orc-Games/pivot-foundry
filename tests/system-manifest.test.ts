import { describe, expect, it } from "vitest";

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
