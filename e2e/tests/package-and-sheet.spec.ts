import { expect, test } from "@playwright/test";

import {
  attachErrorSink,
  createPlayerUser,
  ensureE2EWorld,
  expectPackageIdentity,
  joinAs,
  unexpectedErrors,
  waitForCanvasReady,
} from "../helpers/foundry";

const adminKey = process.env.PIVOT_FOUNDRY_ADMIN_KEY || process.env.FOUNDRY_ADMIN_KEY || "";
const playerPassword = process.env.PIVOT_PLAYER_PASSWORD || "e2e-player-local";
const playerName = "E2E Player";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  attachErrorSink(context);
  const page = await context.newPage();
  await ensureE2EWorld(page, adminKey);
  await joinAs(page, { name: "Gamemaster" });
  await expectPackageIdentity(page);
  await createPlayerUser(page, playerName, playerPassword);
  await context.close();
});

test("loads the packaged Pivot Fantasy system in a fresh world", async ({ page, context }) => {
  attachErrorSink(context);
  await joinAs(page, { name: "Gamemaster" });
  const identity = await expectPackageIdentity(page);
  expect(identity.systemId).toBe("pivot-fantasy");
  expect(unexpectedErrors(context)).toEqual([]);
});

test("creates a character, renders the sheet, and persists after reload", async ({
  page,
  context,
}) => {
  attachErrorSink(context);
  await joinAs(page, { name: "Gamemaster" });
  const actor = await page.evaluate(async () => {
    const created = await (
      window as unknown as {
        Actor: { create: (data: Record<string, unknown>) => Promise<{ id: string; name: string }> };
      }
    ).Actor.create({ name: "E2E Hero", type: "character" });
    return { id: created.id, name: created.name };
  });
  expect(actor.name).toBe("E2E Hero");

  await page.evaluate(async (id) => {
    const actorDoc = (
      window as unknown as {
        game: {
          actors: {
            get: (id: string) => { sheet: { render: (force?: boolean) => Promise<unknown> } };
          };
        };
      }
    ).game.actors.get(id);
    await actorDoc.sheet.render(true);
  }, actor.id);

  await expect(page.locator(".pivot-character-sheet, .window-app, .application")).toContainText(
    /E2E Hero/,
  );

  await page.evaluate(async (id) => {
    await (
      window as unknown as {
        game: {
          actors: {
            get: (id: string) => { update: (data: Record<string, unknown>) => Promise<unknown> };
          };
        };
      }
    ).game.actors
      .get(id)
      .update({
        name: "E2E Hero Reloaded",
        "system.progression.level": 3,
      });
  }, actor.id);

  await page.reload({ waitUntil: "domcontentloaded" });
  await joinAs(page, { name: "Gamemaster" });
  const persisted = await page.evaluate((id) => {
    const actorDoc = (
      window as unknown as {
        game: {
          actors: {
            get: (
              id: string,
            ) => { name: string; system: { progression: { level: number } } } | undefined;
          };
        };
      }
    ).game.actors.get(id);
    return actorDoc ? { name: actorDoc.name, level: actorDoc.system.progression.level } : null;
  }, actor.id);
  expect(persisted).toEqual({ name: "E2E Hero Reloaded", level: 3 });
});

test("posts a d20 roll to chat and activates a scene canvas", async ({ page }) => {
  await joinAs(page, { name: "Gamemaster" });
  await page.evaluate(async () => {
    const roll = await new (
      window as unknown as {
        Roll: new (formula: string) => {
          evaluate: () => Promise<{
            toMessage: (data: Record<string, unknown>) => Promise<unknown>;
          }>;
        };
      }
    ).Roll("1d20").evaluate();
    await roll.toMessage({ speaker: { alias: "E2E Roller" }, flavor: "Pivot E2E d20" });
  });
  await expect(page.locator("#chat-log, .chat-log, ol.chat-log")).toContainText(
    /E2E Roller|Pivot E2E d20|1d20/,
  );

  await page.evaluate(async () => {
    const scene = await (
      window as unknown as {
        Scene: {
          create: (data: Record<string, unknown>) => Promise<{ activate: () => Promise<unknown> }>;
        };
      }
    ).Scene.create({ name: "E2E Scene", navigation: true });
    await scene.activate();
  });
  await waitForCanvasReady(page);
  const canvasReady = await page.evaluate(
    () => (window as unknown as { canvas?: { ready?: boolean } }).canvas?.ready === true,
  );
  expect(canvasReady).toBe(true);
});

test("player permissions and cross-client actor sync", async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  attachErrorSink(gmContext);
  attachErrorSink(playerContext);
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  await joinAs(gm, { name: "Gamemaster" });
  await joinAs(player, { name: playerName, password: playerPassword });

  const actor = await gm.evaluate(async () => {
    const created = await (
      window as unknown as {
        Actor: { create: (data: Record<string, unknown>) => Promise<{ id: string; name: string }> };
      }
    ).Actor.create({ name: "Shared Scout", type: "character" });
    return { id: created.id, name: created.name };
  });

  await expect
    .poll(async () =>
      player.evaluate((id) => {
        return Boolean(
          (
            window as unknown as { game: { actors: { get: (id: string) => unknown } } }
          ).game.actors.get(id),
        );
      }, actor.id),
    )
    .toBe(true);

  const playerUpdate = await player.evaluate(async (id) => {
    try {
      await (
        window as unknown as {
          game: {
            actors: {
              get: (id: string) => { update: (data: Record<string, unknown>) => Promise<unknown> };
            };
          };
        }
      ).game.actors
        .get(id)
        .update({ name: "Hacked Name" });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, actor.id);
  expect(playerUpdate.ok).toBe(false);

  const gmName = await gm.evaluate(
    (id) =>
      (
        window as unknown as { game: { actors: { get: (id: string) => { name: string } } } }
      ).game.actors.get(id).name,
    actor.id,
  );
  expect(gmName).toBe("Shared Scout");

  await gmContext.close();
  await playerContext.close();
});

test("does not declare Foundry LevelDB packs yet", async ({ page }) => {
  await joinAs(page, { name: "Gamemaster" });
  const packCount = await page.evaluate(() => {
    const packs = (
      window as unknown as { game: { packs: { size?: number; contents?: unknown[] } } }
    ).game.packs;
    return packs.size ?? packs.contents?.length ?? 0;
  });
  expect(packCount).toBe(0);
});
