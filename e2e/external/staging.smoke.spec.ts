import { expect, test } from "@playwright/test";

import { joinAs, readIdentity, waitForFoundryShell } from "../helpers/foundry";

const expectedVersion = process.env.PIVOT_PACKAGE_VERSION || "";
const gmName = process.env.PIVOT_STAGING_GM_USER || "Gamemaster";
const gmPassword = process.env.PIVOT_STAGING_GM_PASSWORD || "";
const playerName = process.env.PIVOT_STAGING_PLAYER_USER || "";
const playerPassword = process.env.PIVOT_STAGING_PLAYER_PASSWORD || "";

test("staging is HTTPS, reachable over WebSocket, and serves the accepted package", async ({
  page,
}) => {
  expect(new URL(page.url() || process.env.PIVOT_FOUNDRY_BASE_URL || "").protocol).toBe("https:");
  const response = await page.goto(process.env.PIVOT_FOUNDRY_BASE_URL || "/", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.ok() || response?.status() === 304).toBeTruthy();
  await waitForFoundryShell(page);

  const wsOpened = await new Promise<boolean>((resolve) => {
    page.on("websocket", () => resolve(true));
    setTimeout(() => resolve(false), 15_000);
  });
  expect(wsOpened).toBe(true);

  await joinAs(page, { name: gmName, password: gmPassword });
  const identity = await readIdentity(page);
  expect(identity.ready).toBe(true);
  expect(identity.systemId).toBe("pivot-fantasy");
  if (expectedVersion) {
    expect(identity.systemVersion).toBe(expectedVersion);
  }
});

test("staging player can connect without GM write access", async ({ browser }) => {
  test.skip(!playerName, "PIVOT_STAGING_PLAYER_USER is not configured.");
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();
  await joinAs(gm, { name: gmName, password: gmPassword });
  await joinAs(player, { name: playerName, password: playerPassword });
  const gmReady = await gm.evaluate(
    () => (window as unknown as { game?: { ready?: boolean } }).game?.ready === true,
  );
  const playerReady = await player.evaluate(
    () => (window as unknown as { game?: { ready?: boolean } }).game?.ready === true,
  );
  expect(gmReady).toBe(true);
  expect(playerReady).toBe(true);
  await gmContext.close();
  await playerContext.close();
});
