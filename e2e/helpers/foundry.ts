import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export interface FoundryIdentity {
  ready: boolean;
  systemId: string;
  systemVersion: string;
  worldId: string;
  worldTitle: string;
  version: string;
}

export async function waitForFoundryShell(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const title = document.title || "";
      return (
        title.includes("Foundry") ||
        Boolean(document.querySelector("#join-game, #setup, .setup, .join-game")) ||
        Boolean((window as unknown as { game?: { ready?: boolean } }).game)
      );
    },
    { timeout: 180_000 },
  );
}

export async function authenticateSetup(page: Page, adminKey: string): Promise<void> {
  const password = page.locator(
    'input[type="password"], input[name="adminPassword"], input[name="password"]',
  );
  if (
    (await password.count()) > 0 &&
    (await password
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await password.first().fill(adminKey);
    const submit = page.getByRole("button", { name: /submit|log in|unlock|continue/i }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await password.first().press("Enter");
    }
  }
}

export async function ensureE2EWorld(page: Page, adminKey: string): Promise<void> {
  await waitForFoundryShell(page);
  await authenticateSetup(page, adminKey);

  const ready = await page.evaluate(() =>
    Boolean((window as unknown as { game?: { ready?: boolean } }).game?.ready),
  );
  if (ready) return;

  const created = await page.evaluate(
    async (world) => {
      const runtime = window as unknown as {
        World?: { create?: (data: Record<string, string>) => Promise<unknown> };
        game?: { worlds?: { get?: (id: string) => { id?: string } | undefined } };
      };
      if (runtime.game?.worlds?.get?.(world.id)) return "exists";
      if (typeof runtime.World?.create === "function") {
        await runtime.World.create({
          id: world.id,
          name: world.id,
          title: world.title,
          system: world.system,
        });
        return "created";
      }
      return "unavailable";
    },
    {
      id: process.env.PIVOT_E2E_WORLD_ID || "pivot-e2e",
      title: "Pivot Fantasy E2E",
      system: "pivot-fantasy",
    },
  );

  if (created === "unavailable") {
    await createWorldThroughUi(page);
  }

  await launchWorld(page);
}

async function createWorldThroughUi(page: Page): Promise<void> {
  const create = page.getByRole("button", { name: /create world|new world/i }).first();
  await expect(create).toBeVisible({ timeout: 30_000 });
  await create.click();
  const title = page.locator('input[name="title"], input[name="name"]').first();
  await title.fill("Pivot Fantasy E2E");
  const system = page.locator('select[name="system"], select#system');
  if ((await system.count()) > 0) {
    await system
      .first()
      .selectOption({ value: "pivot-fantasy" })
      .catch(async () => {
        await system.first().selectOption({ label: /pivot fantasy/i });
      });
  }
  await page
    .getByRole("button", { name: /create world|create/i })
    .last()
    .click();
}

async function launchWorld(page: Page): Promise<void> {
  const launched = await page.evaluate(async (worldId) => {
    const runtime = window as unknown as {
      game?: {
        worlds?: {
          get?: (id: string) => { launch?: () => Promise<unknown> } | undefined;
          contents?: Array<{ id?: string; launch?: () => Promise<unknown> }>;
        };
      };
    };
    const world =
      runtime.game?.worlds?.get?.(worldId) ||
      runtime.game?.worlds?.contents?.find((item) => item.id === worldId);
    if (world?.launch) {
      await world.launch();
      return true;
    }
    return false;
  }, process.env.PIVOT_E2E_WORLD_ID || "pivot-e2e");

  if (!launched) {
    const launch = page.getByRole("button", { name: /launch/i }).first();
    await expect(launch).toBeVisible({ timeout: 30_000 });
    await launch.click();
  }
}

export async function joinAs(
  page: Page,
  { name, password = "" }: { name: string; password?: string },
): Promise<void> {
  if (!page.url().includes("/join")) {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
  }
  await page.getByText(name, { exact: true }).first().click({ timeout: 60_000 });
  if (password) {
    const field = page.locator('input[type="password"]');
    if ((await field.count()) > 0) await field.first().fill(password);
  }
  const join = page.getByRole("button", { name: /join game|join/i }).first();
  if (await join.isVisible().catch(() => false)) {
    await join.click();
  }
  await waitForGameReady(page);
}

export async function waitForGameReady(page: Page): Promise<FoundryIdentity> {
  await page.waitForFunction(
    () => (window as unknown as { game?: { ready?: boolean } }).game?.ready === true,
    {
      timeout: 180_000,
    },
  );
  return readIdentity(page);
}

export async function readIdentity(page: Page): Promise<FoundryIdentity> {
  return page.evaluate(() => {
    const game = (
      window as unknown as {
        game: {
          ready: boolean;
          system: { id: string; version: string };
          world: { id: string; title: string };
          version: string;
        };
      }
    ).game;
    return {
      ready: game.ready,
      systemId: game.system.id,
      systemVersion: game.system.version,
      worldId: game.world.id,
      worldTitle: game.world.title,
      version: game.version,
    };
  });
}

export async function waitForCanvasReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { canvas?: { ready?: boolean } }).canvas?.ready === true,
    {
      timeout: 120_000,
    },
  );
}

export async function createPlayerUser(page: Page, name: string, password: string): Promise<void> {
  await page.evaluate(
    async ({ userName, userPassword }) => {
      const game = (
        window as unknown as {
          game: {
            users: {
              getName?: (name: string) => { id?: string } | undefined;
            };
          };
          User: { create: (data: Record<string, unknown>) => Promise<unknown> };
        }
      ).game;
      if (game.users.getName?.(userName)) return;
      await (
        window as unknown as {
          User: { create: (data: Record<string, unknown>) => Promise<unknown> };
        }
      ).User.create({
        name: userName,
        role: 1,
        password: userPassword,
      });
    },
    { userName: name, userPassword: password },
  );
}

export async function openOwnedContext(
  browser: Browser,
  storageState?: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(storageState ? { storageState } : {});
  attachErrorSink(context);
  const page = await context.newPage();
  return { context, page };
}

export function attachErrorSink(context: BrowserContext): void {
  const errors: string[] = [];
  context.on("page", (page) => {
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  });
  (
    context as BrowserContext & {
      pivotErrors?: string[];
    }
  ).pivotErrors = errors;
}

export function unexpectedErrors(context: BrowserContext): string[] {
  const errors = (context as BrowserContext & { pivotErrors?: string[] }).pivotErrors || [];
  return errors.filter(
    (message) =>
      !/favicon|Download the React DevTools|net::ERR_BLOCKED/i.test(message) &&
      !/license/i.test(message),
  );
}

export async function expectPackageIdentity(page: Page): Promise<FoundryIdentity> {
  const identity = await readIdentity(page);
  expect(identity.ready).toBe(true);
  expect(identity.systemId).toBe("pivot-fantasy");
  expect(identity.systemVersion).toBe(process.env.PIVOT_PACKAGE_VERSION || "0.1.0");
  expect(identity.worldId).toBe(process.env.PIVOT_E2E_WORLD_ID || "pivot-e2e");
  expect(identity.version.startsWith("14.")).toBe(true);
  return identity;
}
