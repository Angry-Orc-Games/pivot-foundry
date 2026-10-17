import { expect, test } from "@playwright/test";

import { attachErrorSink, joinAs, readIdentity, unexpectedErrors } from "../helpers/foundry";

const adminKey = process.env.FOUNDRY_TEST_ADMIN_KEY || "";
const worldId = process.env.FOUNDRY_TEST_WORLD_ID || "";

if (!adminKey) {
  throw new Error("FOUNDRY_TEST_ADMIN_KEY is required for remote E2E tests");
}

if (!worldId) {
  throw new Error("FOUNDRY_TEST_WORLD_ID is required for remote E2E tests");
}

test.describe.configure({ mode: "serial" });

test("connects to remote Foundry via tunnel and opens the test world", async ({
  page,
  context,
}) => {
  attachErrorSink(context);

  await page.goto("/", { waitUntil: "domcontentloaded" });

  const setupPage = page.locator("#setup, .setup");
  if ((await setupPage.count()) > 0) {
    const password = page.locator('input[type="password"]').first();
    if (await password.isVisible().catch(() => false)) {
      await password.fill(adminKey);
      await password.press("Enter");
    }
  }

  const worldLaunched = await page.evaluate(async (testWorldId) => {
    const runtime = window as unknown as {
      game?: {
        worlds?: {
          get?: (id: string) => { launch?: () => Promise<unknown> } | undefined;
          contents?: Array<{ id?: string; launch?: () => Promise<unknown> }>;
        };
      };
    };

    const world =
      runtime.game?.worlds?.get?.(testWorldId) ||
      runtime.game?.worlds?.contents?.find((item) => item.id === testWorldId);

    if (world?.launch) {
      await world.launch();
      return true;
    }
    return false;
  }, worldId);

  if (!worldLaunched) {
    const launchButton = page.locator(
      `button[data-world="${worldId}"], a[data-world="${worldId}"]`,
    );
    if ((await launchButton.count()) > 0) {
      await launchButton.first().click();
    } else {
      throw new Error(`World ${worldId} not found on setup page`);
    }
  }

  await page.waitForURL(/\/join/i, { timeout: 60_000 });

  const errors = unexpectedErrors(context);
  expect(errors).toEqual([]);
});

test("logs in as Gamemaster and verifies system identity", async ({ page, context }) => {
  attachErrorSink(context);

  await joinAs(page, { name: "Gamemaster" });

  const identity = await readIdentity(page);
  expect(identity.ready).toBe(true);
  expect(identity.systemId).toBe("pivot-fantasy");
  expect(identity.worldId).toBe(worldId);

  const errors = unexpectedErrors(context);
  expect(errors).toEqual([]);
});

test("opens a Character sheet", async ({ page, context }) => {
  attachErrorSink(context);

  await joinAs(page, { name: "Gamemaster" });

  const characterResult = await page.evaluate(async () => {
    const runtime = window as unknown as {
      game: {
        actors: {
          contents?: Array<{ id: string; type: string; name: string }>;
          filter?: (fn: (actor: { type: string }) => boolean) => Array<{
            id: string;
            type: string;
            name: string;
            sheet: { render: (force?: boolean) => Promise<unknown> };
          }>;
        };
      };
      Actor: { create: (data: Record<string, unknown>) => Promise<{ id: string; name: string }> };
    };

    const characters =
      runtime.game.actors.filter?.((a) => a.type === "character") ||
      runtime.game.actors.contents?.filter((a) => a.type === "character") ||
      [];

    let character = characters[0];

    if (!character) {
      const created = await runtime.Actor.create({
        name: "Remote E2E Character",
        type: "character",
      });
      character = {
        ...created,
        type: "character",
        sheet: runtime.game.actors.filter((a) => a.id === created.id)[0]?.sheet,
      } as typeof character;
    }

    if (character.sheet) {
      await character.sheet.render(true);
    }

    return { id: character.id, name: character.name, type: character.type };
  });

  expect(characterResult.type).toBe("character");

  await expect(
    page.locator(".pivot-character-sheet, .window-app.sheet.actor, .application"),
  ).toBeVisible({ timeout: 30_000 });

  const errors = unexpectedErrors(context);
  expect(errors).toEqual([]);
});

test("opens an NPC sheet", async ({ page, context }) => {
  attachErrorSink(context);

  await joinAs(page, { name: "Gamemaster" });

  const npcResult = await page.evaluate(async () => {
    const runtime = window as unknown as {
      game: {
        actors: {
          contents?: Array<{ id: string; type: string; name: string }>;
          filter?: (fn: (actor: { type: string }) => boolean) => Array<{
            id: string;
            type: string;
            name: string;
            sheet: { render: (force?: boolean) => Promise<unknown> };
          }>;
        };
      };
      Actor: { create: (data: Record<string, unknown>) => Promise<{ id: string; name: string }> };
    };

    const npcs =
      runtime.game.actors.filter?.((a) => a.type === "npc") ||
      runtime.game.actors.contents?.filter((a) => a.type === "npc") ||
      [];

    let npc = npcs[0];

    if (!npc) {
      const created = await runtime.Actor.create({
        name: "Remote E2E NPC",
        type: "npc",
      });
      npc = {
        ...created,
        type: "npc",
        sheet: runtime.game.actors.filter((a) => a.id === created.id)[0]?.sheet,
      } as typeof npc;
    }

    if (npc.sheet) {
      await npc.sheet.render(true);
    }

    return { id: npc.id, name: npc.name, type: npc.type };
  });

  expect(npcResult.type).toBe("npc");

  await expect(page.locator(".pivot-npc-sheet, .window-app.sheet.actor, .application")).toBeVisible(
    { timeout: 30_000 },
  );

  const errors = unexpectedErrors(context);
  expect(errors).toEqual([]);
});
