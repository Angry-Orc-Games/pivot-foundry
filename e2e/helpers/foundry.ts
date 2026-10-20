import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { handleFoundryEula } from "../../scripts/foundry-setup.mjs";

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

const ADMIN_SCREEN_TIMEOUT_MS = 15_000;
const ADMIN_SCREEN_MISSING =
  "Foundry setup did not show the administrator password field or the Setup screen.";

type ScreenLocator = {
  waitFor(options: { state: "visible"; timeout: number }): Promise<void>;
};

function asFirst<T>(locator: T): T {
  const withFirst = locator as T & { first?: () => T };
  return typeof withFirst.first === "function" ? withFirst.first() : locator;
}

function firstVisible(entries: Array<[string, ScreenLocator]>, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let pending = entries.length;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      reject(new Error(ADMIN_SCREEN_MISSING));
    };
    const timer = globalThis.setTimeout(fail, timeout);
    for (const [name, locator] of entries) {
      Promise.resolve()
        .then(() => locator.waitFor({ state: "visible", timeout }))
        .then(() => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timer);
          resolve(name);
        })
        .catch(() => {
          pending -= 1;
          if (!settled && pending === 0) fail();
        });
    }
  });
}

function savedTraceChunkPath(): string {
  try {
    const info = test.info() as {
      outputPath: (name: string) => string;
      _tracing?: { maybeGenerateNextTraceRecordingPath?: () => string | undefined };
    };
    const generated = info._tracing?.maybeGenerateNextTraceRecordingPath?.();
    if (generated) return generated;
    return info.outputPath("trace-chunk.zip");
  } catch {
    return "trace-chunk.zip";
  }
}

async function withoutTrace(page: Page, action: () => Promise<void>): Promise<void> {
  const tracing = typeof page.context === "function" ? page.context().tracing : undefined;
  const canPause =
    typeof tracing?.stopChunk === "function" && typeof tracing.startChunk === "function";
  let paused = false;
  if (canPause && tracing) {
    try {
      await tracing.stopChunk({ path: savedTraceChunkPath() });
      paused = true;
    } catch {
      paused = false;
    }
  }
  try {
    await action();
  } finally {
    if (paused && tracing) await tracing.startChunk();
  }
}

function maskPasswordShots(page: Page, field: Locator): void {
  if (typeof page.screenshot !== "function") return;
  const shoot = page.screenshot.bind(page);
  page.screenshot = (options) =>
    shoot({
      ...options,
      mask: [...(options?.mask ?? []), field],
    });
}

export async function authenticateSetup(page: Page, adminKey: string): Promise<void> {
  const password = asFirst(
    page.locator('input[type="password"], input[name="adminPassword"], input[name="password"]'),
  );
  maskPasswordShots(page, password);
  const setup: Array<[string, ScreenLocator]> = [
    ["setup", asFirst(page.getByRole("button", { name: /create world|new world/i }))],
    ["setup", asFirst(page.getByRole("checkbox", { name: "I agree to these terms" }))],
    ["setup", asFirst(page.getByRole("heading", { name: "Setup", exact: true }))],
  ];
  const screen = await firstVisible([["admin", password], ...setup], ADMIN_SCREEN_TIMEOUT_MS);
  if (screen !== "admin") return;

  await withoutTrace(page, async () => {
    await password.fill(adminKey);
    const submit = asFirst(page.getByRole("button", { name: /submit|log in|unlock|continue/i }));
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await password.press("Enter");
    }
    await password.fill("").catch(() => undefined);
  });
  await firstVisible(setup, ADMIN_SCREEN_TIMEOUT_MS);
}

export async function ensureE2EWorld(page: Page, adminKey: string): Promise<void> {
  await waitForFoundryShell(page);
  await authenticateSetup(page, adminKey);
  await handleFoundryEula(page);
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

const TOUR_WAIT_MS = 2_000;

async function dismissSetupTour(page: Page): Promise<void> {
  const overlay = page.locator("div.tour-overlay").first();
  const visible = await overlay
    .waitFor({ state: "visible", timeout: TOUR_WAIT_MS })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;

  const exit = page.getByRole("button", { name: /exit tour|skip tour|end tour|skip/i }).first();
  const exited = await exit
    .click({ timeout: TOUR_WAIT_MS })
    .then(() => true)
    .catch(() => false);
  if (!exited) {
    const action = page.locator('button[data-action="exit"]').first();
    const clicked = await action
      .click({ timeout: TOUR_WAIT_MS })
      .then(() => true)
      .catch(() => false);
    if (!clicked) await page.keyboard.press("Escape");
  }
  await overlay.waitFor({ state: "detached", timeout: TOUR_WAIT_MS });
}

async function createWorldThroughUi(page: Page): Promise<void> {
  const create = page.getByRole("button", { name: /create world|new world/i }).first();
  await create.waitFor({ state: "visible", timeout: 30_000 });
  await dismissSetupTour(page);
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
  const submitJoin = async () => {
    const join = page.getByRole("button", { name: /join game|join/i }).first();
    if (await join.isVisible().catch(() => false)) await join.click();
  };
  if (password) {
    await withoutTrace(page, async () => {
      const field = page.locator('input[type="password"]');
      if ((await field.count()) > 0) await field.first().fill(password);
      await submitJoin();
      if ((await field.count()) > 0)
        await field
          .first()
          .fill("")
          .catch(() => undefined);
    });
  } else {
    await submitJoin();
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
  await withoutTrace(page, () =>
    page.evaluate(
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
    ),
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
