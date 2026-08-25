import { describe, expect, it } from "vitest";

import manifestJson from "../system.json";

type SystemManifest = {
  documentTypes?: {
    Actor?: Record<string, unknown>;
  };
};

const manifest = manifestJson as SystemManifest;

describe("system manifest", () => {
  it("declares a character Actor subtype for Foundry document validation", () => {
    expect(manifest.documentTypes?.Actor).toHaveProperty("character");
  });
});
