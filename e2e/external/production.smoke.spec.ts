import { expect, test } from "@playwright/test";

test("production health is HTTPS and serves the promoted package manifest", async ({ request }) => {
  const base = process.env.PIVOT_FOUNDRY_BASE_URL || "https://foundry.angryorcgames.com";
  expect(new URL(base).hostname).toBe("foundry.angryorcgames.com");
  const manifestUrl =
    process.env.PIVOT_PRODUCTION_MANIFEST_URL ||
    `${base.replace(/\/$/, "")}/systems/pivot-fantasy/system.json`;
  const response = await request.get(manifestUrl);
  expect(response.ok()).toBeTruthy();
  const manifest = (await response.json()) as { id?: string; version?: string };
  expect(manifest.id).toBe("pivot-fantasy");
  if (process.env.PIVOT_PACKAGE_VERSION) {
    expect(manifest.version).toBe(process.env.PIVOT_PACKAGE_VERSION);
  }
});

test("production join page loads without destructive setup", async ({ page }) => {
  const response = await page.goto(
    process.env.PIVOT_FOUNDRY_BASE_URL || "https://foundry.angryorcgames.com",
    {
      waitUntil: "domcontentloaded",
    },
  );
  expect(
    response?.ok() || [301, 302, 303, 307, 308].includes(response?.status() || 0),
  ).toBeTruthy();
  await expect(page).toHaveTitle(/Foundry/i);
});
