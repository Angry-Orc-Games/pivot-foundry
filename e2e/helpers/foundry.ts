import { Buffer } from "node:buffer";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { handleFoundryEula, withPhaseTimeout } from "../../scripts/foundry-setup.mjs";

export interface FoundryIdentity {
  ready: boolean;
  systemId: string;
  systemVersion: string;
  worldId: string;
  worldTitle: string;
  version: string;
}

const LICENSE_PHASE_MS = 60_000;

export async function waitForFoundryShell(page: Page): Promise<void> {
  await withPhaseTimeout(
    "license",
    LICENSE_PHASE_MS,
    (async () => {
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: LICENSE_PHASE_MS });
      await page.waitForFunction(
        () => {
          const title = document.title || "";
          return (
            title.includes("Foundry") ||
            Boolean(document.querySelector("#join-game, #setup, .setup, .join-game")) ||
            Boolean((window as unknown as { game?: { ready?: boolean } }).game)
          );
        },
        { timeout: LICENSE_PHASE_MS },
      );
    })(),
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

type AuthPhase = "license" | "eula" | "admin" | "tour close" | "create world" | "join";

function absentScreen(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  if (/hidden|did not appear/i.test(message)) return true;
  if (/^timeout \d+ms exceeded\.?$/i.test(message)) return true;
  return name === "TimeoutError" && !/test timeout/i.test(message);
}

function firstVisible(entries: Array<[string, ScreenLocator]>, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let pending = entries.length;
    let settled = false;
    let fault: unknown;
    const finish = (error: unknown) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      reject(error);
    };
    const timer = globalThis.setTimeout(() => {
      finish(fault ?? new Error(ADMIN_SCREEN_MISSING));
    }, timeout);
    for (const [name, locator] of entries) {
      Promise.resolve()
        .then(() => locator.waitFor({ state: "visible", timeout }))
        .then(() => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timer);
          resolve(name);
        })
        .catch((error: unknown) => {
          if (!absentScreen(error)) fault = fault ?? error;
          pending -= 1;
          if (settled) return;
          if (fault) finish(fault);
          else if (pending === 0) finish(new Error(ADMIN_SCREEN_MISSING));
        });
    }
  });
}

function noteAuthPhase(phase: AuthPhase): void {
  const marker = process.env.PIVOT_E2E_SETUP_FAILURE;
  if (!marker) return;
  const file = join(dirname(marker), "auth-steps.log");
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${phase}\n`);
}

const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type ShotState = Page & { __pivotHoldShots?: boolean; __pivotShotWrapped?: boolean };

async function clearPasswordFields(page: Page): Promise<boolean> {
  try {
    const fields = page.locator('input[type="password"]');
    if (typeof fields.count !== "function") return true;
    const count = await fields.count();
    for (let index = 0; index < count; index += 1) {
      const field = typeof fields.nth === "function" ? fields.nth(index) : fields;
      if (typeof field.fill === "function") await field.fill("");
    }
    return true;
  } catch {
    return false;
  }
}

function holdFailureShots(page: Page): void {
  const state = page as ShotState;
  state.__pivotHoldShots = true;
  if (state.__pivotShotWrapped || typeof page.screenshot !== "function") return;
  state.__pivotShotWrapped = true;
  const shoot = page.screenshot.bind(page);
  page.screenshot = (async (options?: Parameters<Page["screenshot"]>[0]) => {
    if (state.__pivotHoldShots) {
      const cleared = await clearPasswordFields(page);
      if (!cleared) return BLANK_PNG;
    }
    return shoot(options);
  }) as Page["screenshot"];
}

function releaseFailureShots(page: Page): void {
  (page as ShotState).__pivotHoldShots = false;
}

export async function fillSecret(locator: Locator, value: string): Promise<void> {
  const write = () =>
    locator.evaluate((element, secret) => {
      const input = element as HTMLInputElement;
      input.value = secret;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  try {
    await test.step("fill secret field", write);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message !== "test.step() can only be called from a test") throw error;
    await write();
  }
}

const CLOSED_TARGET = /target page, context or browser has been closed/i;

function closedTarget(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return CLOSED_TARGET.test(message);
}

async function openPage(page: Page, closedError?: unknown): Promise<Page> {
  if (typeof page.isClosed !== "function" || !page.isClosed()) return page;
  const pages = page.context().pages();
  const next = pages.filter((candidate) => !candidate.isClosed()).at(-1);
  if (!next) {
    if (closedError instanceof Error) throw closedError;
    throw new Error("Foundry closed the page during setup and left no open page.");
  }
  return next;
}

async function settle(page: Page): Promise<void> {
  if (typeof page.waitForLoadState !== "function") return;
  try {
    await withPhaseTimeout("eula", 15_000, page.waitForLoadState("domcontentloaded"));
  } catch (error) {
    if (!closedTarget(error)) throw error;
  }
}

export async function authenticateSetup(page: Page, adminKey: string): Promise<void> {
  noteAuthPhase("admin");
  holdFailureShots(page);
  const password = asFirst(
    page.locator('input[type="password"], input[name="adminPassword"], input[name="password"]'),
  );
  try {
    const setup: Array<[string, ScreenLocator]> = [
      ["setup", asFirst(page.getByRole("button", { name: /create world|new world/i }))],
      ["setup", asFirst(page.getByRole("checkbox", { name: "I agree to these terms" }))],
      ["setup", asFirst(page.getByRole("heading", { name: "Setup", exact: true }))],
    ];
    const screen = await firstVisible([["admin", password], ...setup], ADMIN_SCREEN_TIMEOUT_MS);
    if (screen !== "admin") {
      releaseFailureShots(page);
      return;
    }

    await fillSecret(password, adminKey);
    const submit = asFirst(page.getByRole("button", { name: /submit|log in|unlock|continue/i }));
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await password.press("Enter");
    }
    await password.fill("").catch(() => undefined);
    await firstVisible(setup, ADMIN_SCREEN_TIMEOUT_MS);
    releaseFailureShots(page);
  } catch (error) {
    await clearPasswordFields(page);
    throw error;
  }
}

async function silenceCoreTours(runtime: typeof globalThis = globalThis): Promise<boolean> {
  const host = runtime as typeof globalThis & {
    foundry?: {
      nue?: {
        Tour?: {
          activeTour?: { namespace?: string; exit?: () => void } | null;
        };
      };
    };
    game?: {
      ready?: boolean;
      tours?: Iterable<{
        namespace?: string;
        status?: string;
        complete?: () => Promise<unknown> | unknown;
      }>;
    };
  };
  const active = host.foundry?.nue?.Tour?.activeTour;
  if (
    active &&
    (active.namespace === undefined || active.namespace === "core") &&
    typeof active.exit === "function"
  ) {
    active.exit();
  }
  const tours = host.game?.tours;
  if (tours) {
    const pending: Array<Promise<unknown>> = [];
    for (const tour of tours) {
      if (
        tour?.namespace === "core" &&
        tour.status !== "completed" &&
        typeof tour.complete === "function"
      ) {
        pending.push(Promise.resolve(tour.complete()));
      }
    }
    await Promise.all(pending);
  }
  return Boolean(host.game?.ready);
}

export async function ensureE2EWorld(page: Page, adminKey: string): Promise<Page> {
  await waitForFoundryShell(page);
  noteAuthPhase("license");
  await authenticateSetup(page, adminKey);
  noteAuthPhase("eula");
  await handleFoundryEula(page);
  let current = await openPage(page);
  await settle(current);
  current = await openPage(current);
  try {
    await authenticateSetup(current, adminKey);
  } catch (error) {
    if (!closedTarget(error)) throw error;
    const recovered = await openPage(current, error);
    if (recovered === current) throw error;
    await settle(recovered);
    await authenticateSetup(recovered, adminKey);
    current = recovered;
  }

  const ready = await withPhaseTimeout("tour close", 15_000, current.evaluate(silenceCoreTours));
  if (ready) return current;

  const created = await withPhaseTimeout(
    "create world",
    20_000,
    current.evaluate(
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
    ),
  );

  if (created === "unavailable") {
    await createWorldThroughUi(current);
  } else if (created === "created") {
    noteAuthPhase("create world");
  }

  await launchWorld(current);
  return current;
}

const TOUR_WAIT_MS = 2_000;

async function dismissSetupTour(page: Page): Promise<void> {
  noteAuthPhase("tour close");
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
  noteAuthPhase("create world");
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
  noteAuthPhase("join");
  holdFailureShots(page);
  try {
    if (!page.url().includes("/join")) {
      await page.goto("/join", { waitUntil: "domcontentloaded" });
    }
    await page.getByText(name, { exact: true }).first().click({ timeout: 60_000 });
    const submitJoin = async () => {
      const join = page.getByRole("button", { name: /join game|join/i }).first();
      if (await join.isVisible().catch(() => false)) await join.click();
    };
    if (password) {
      const field = page.locator('input[type="password"]');
      if ((await field.count()) > 0) await fillSecret(field.first(), password);
      await submitJoin();
      if ((await field.count()) > 0)
        await field
          .first()
          .fill("")
          .catch(() => undefined);
    } else {
      await submitJoin();
    }
    await waitForGameReady(page);
    releaseFailureShots(page);
  } catch (error) {
    await clearPasswordFields(page);
    throw error;
  }
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
  holdFailureShots(page);
  try {
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
    releaseFailureShots(page);
  } catch (error) {
    await clearPasswordFields(page);
    throw error;
  }
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
