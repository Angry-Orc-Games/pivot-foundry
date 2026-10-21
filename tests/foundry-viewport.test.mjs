import { describe, expect, it } from "vitest";

import config from "../e2e/playwright.config.ts";

describe("Playwright viewport", () => {
  it("gives chromium at least 1366 by 768", () => {
    const project = config.projects?.find((item) => item.name === "chromium");
    const viewport = project?.use?.viewport;
    expect(viewport?.width).toBeGreaterThanOrEqual(1366);
    expect(viewport?.height).toBeGreaterThanOrEqual(768);
  });
});
