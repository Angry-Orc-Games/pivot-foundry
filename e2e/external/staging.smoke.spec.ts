import { expect, test } from "@playwright/test";

import { waitForFoundryShell } from "../helpers/foundry";

const baseUrl = process.env.PIVOT_FOUNDRY_BASE_URL || "";
const expectedVersion = process.env.PIVOT_PACKAGE_VERSION || "";

// No Foundry accounts are needed: the build server is checked as an anonymous visitor.
test("build server is HTTPS, reachable over WebSocket, and serves the accepted package", async ({
  page,
  request,
}) => {
  expect(new URL(baseUrl).protocol).toBe("https:");

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  expect(response?.ok() || response?.status() === 304).toBeTruthy();
  await waitForFoundryShell(page);

  const wsOpened = await new Promise<boolean>((resolve) => {
    page.on("websocket", () => resolve(true));
    setTimeout(() => resolve(false), 15_000);
  });
  expect(wsOpened).toBe(true);

  const manifest = await request.get(new URL("/systems/pivot-fantasy/system.json", baseUrl).href);
  expect(manifest.ok()).toBeTruthy();
  const system = (await manifest.json()) as { id?: string; version?: string };
  expect(system.id).toBe("pivot-fantasy");
  if (expectedVersion) {
    expect(system.version).toBe(expectedVersion);
  }
});
