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

import {
  EULA_HIDDEN_MS,
  SCREEN_TIMEOUT_MS,
  handleFoundryEula,
  withPhaseTimeout,
} from "../../scripts/foundry-setup.mjs";

export interface FoundryIdentity {
  ready: boolean;
  systemId: string;
  systemVersion: string;
  worldId: string;
  worldTitle: string;
  version: string;
}

const LICENSE_PHASE_MS = 60_000;
const ADMIN_SCREEN_TIMEOUT_MS = 15_000;
const SETTLE_PHASE_MS = 15_000;
const TOUR_CLOSE_PHASE_MS = 15_000;
const LAUNCH_PHASE_MS = 30_000;
const JOIN_PHASE_MS = 60_000;
const GAME_READY_MS = 180_000;
const TOUR_WAIT_MS = 2_000;
const CREATE_WORLD_EVALUATE_MS = 20_000;
const CREATE_WORLD_UI_MS = ADMIN_SCREEN_TIMEOUT_MS * 10 + TOUR_WAIT_MS * 4;
export const CREATE_WORLD_PHASE_MS = CREATE_WORLD_EVALUATE_MS + CREATE_WORLD_UI_MS;
const FIELD_CLEAR_MS = 1_000;
const NAVIGATION_MS = 30_000;

export function setupPhaseBudgetMs(): number {
  const adminSignIn = ADMIN_SCREEN_TIMEOUT_MS * 3 + FIELD_CLEAR_MS;
  const eulaSign = SCREEN_TIMEOUT_MS * 3 + EULA_HIDDEN_MS;
  const launch = LAUNCH_PHASE_MS * 2 + ADMIN_SCREEN_TIMEOUT_MS;
  const join = NAVIGATION_MS + JOIN_PHASE_MS + ADMIN_SCREEN_TIMEOUT_MS + FIELD_CLEAR_MS;
  return (
    LICENSE_PHASE_MS +
    adminSignIn +
    eulaSign +
    SETTLE_PHASE_MS +
    adminSignIn +
    SETTLE_PHASE_MS +
    adminSignIn +
    TOUR_CLOSE_PHASE_MS +
    CREATE_WORLD_PHASE_MS +
    launch +
    join +
    GAME_READY_MS
  );
}

export function setupHookTimeoutMs(): number {
  return setupPhaseBudgetMs() + 5_000;
}

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

const ADMIN_SCREEN_MISSING =
  "Foundry setup did not show the administrator password field or the Setup screen.";

type ScreenLocator = {
  waitFor(options: { state: "visible"; timeout: number }): Promise<void>;
  or?(other: ScreenLocator): ScreenLocator;
  first?(): ScreenLocator;
  visible?(): ScreenLocator;
  isVisible?(): Promise<boolean>;
};

function asFirst<T>(locator: T): T {
  const withFirst = locator as T & { first?: () => T };
  return typeof withFirst.first === "function" ? withFirst.first() : locator;
}

type AuthPhase = "license" | "eula" | "admin" | "tour close" | "create world" | "launch" | "join";

function absentScreen(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  if (/hidden|did not appear/i.test(message)) return true;
  if (/^timeout \d+ms exceeded\.?$/i.test(message)) return true;
  return name === "TimeoutError" && !/test timeout/i.test(message);
}

function visibleUnion(entries: Array<[string, ScreenLocator]>): ScreenLocator | undefined {
  const [first, ...rest] = entries;
  if (!first || rest.length === 0 || typeof first[1].or !== "function") return undefined;
  let combined = first[1];
  for (const [, locator] of rest) {
    const widen = combined.or;
    if (typeof widen !== "function") return undefined;
    combined = widen.call(combined, locator);
  }
  return combined;
}

function firstVisible(entries: Array<[string, ScreenLocator]>, timeout: number): Promise<string> {
  const [first] = entries;
  const union = visibleUnion(entries);
  if (first && union) {
    const visible = typeof union.visible === "function" ? union.visible() : union;
    const target = typeof visible.first === "function" ? visible.first() : visible;
    return target.waitFor({ state: "visible", timeout }).then(async () => {
      for (const [name, locator] of entries) {
        if (await locator.isVisible?.().catch(() => false)) return name;
      }
      return first[0];
    });
  }
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
          if (settled) return;
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

function noteTourProblem(line: string): void {
  const marker = process.env.PIVOT_E2E_SETUP_FAILURE;
  if (!marker) return;
  let safe = line;
  for (const secret of [process.env.FOUNDRY_ADMIN_KEY, process.env.FOUNDRY_LICENSE_KEY]) {
    if (secret) safe = safe.split(secret).join("[redacted]");
  }
  const file = join(dirname(marker), "tour-notes.log");
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${safe}\n`);
}

function tourCloseOutcome(value: unknown): { ready: boolean; notes: string[] } {
  if (value && typeof value === "object" && "ready" in value) {
    const record = value as { ready?: unknown; notes?: unknown };
    const notes = Array.isArray(record.notes)
      ? record.notes.filter((line): line is string => typeof line === "string")
      : [];
    return { ready: record.ready === true, notes };
  }
  return { ready: value === true, notes: [] };
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
      if (typeof field.fill !== "function") continue;
      let wiped = false;
      const done = await Promise.race([
        Promise.resolve(field.fill("")).then(
          () => {
            wiped = true;
            return true;
          },
          () => false,
        ),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), FIELD_CLEAR_MS);
        }),
      ]);
      if (!done || !wiped) return false;
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
    await withPhaseTimeout("eula", SETTLE_PHASE_MS, page.waitForLoadState("domcontentloaded"));
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
      await submit.click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
    } else {
      await password.press("Enter", { timeout: ADMIN_SCREEN_TIMEOUT_MS });
    }
    await clearPasswordFields(page);
    await firstVisible(setup, ADMIN_SCREEN_TIMEOUT_MS);
    releaseFailureShots(page);
  } catch (error) {
    await clearPasswordFields(page);
    throw error;
  }
}

type SetupTourLike = {
  namespace?: string;
  id?: string;
  status?: string;
  steps?: unknown;
  exit?: () => void;
  complete?: () => Promise<unknown> | unknown;
};

async function silenceCoreTours(runtime: typeof globalThis = globalThis): Promise<{
  ready: boolean;
  notes: string[];
}> {
  const host = runtime as typeof globalThis & {
    foundry?: {
      nue?: {
        Tour?: { activeTour?: SetupTourLike | null };
        tours?: {
          SetupTour?: new (...args: never[]) => unknown;
          SidebarTour?: new (...args: never[]) => unknown;
        };
        SetupTour?: new (...args: never[]) => unknown;
        SidebarTour?: new (...args: never[]) => unknown;
      };
    };
    game?: {
      ready?: boolean;
      tours?: Iterable<SetupTourLike>;
    };
  };

  function stepsNeedUser(tour: SetupTourLike): boolean {
    try {
      const steps = tour.steps;
      if (!Array.isArray(steps)) return false;
      return steps.some(
        (step) =>
          Boolean(step) &&
          typeof step === "object" &&
          ("sidebarTab" in step || "layer" in step || "tool" in step),
      );
    } catch {
      return true;
    }
  }

  function setupContext(tour: SetupTourLike): boolean {
    const nue = host.foundry?.nue;
    const SetupTour = nue?.tours?.SetupTour ?? nue?.SetupTour;
    const SidebarTour = nue?.tours?.SidebarTour ?? nue?.SidebarTour;
    if (typeof SidebarTour === "function" && tour instanceof SidebarTour) return false;
    if (typeof SetupTour === "function" && tour instanceof SetupTour) return true;
    if (stepsNeedUser(tour)) return false;
    return tour.namespace === undefined || tour.namespace === "core";
  }

  function problem(tour: SetupTourLike, error: unknown): string {
    const id = [tour.namespace, tour.id].filter(Boolean).join(".") || "tour";
    const message = error instanceof Error ? error.message : String(error);
    return `${id}: ${message}`.slice(0, 240);
  }

  const notes: string[] = [];
  const active = host.foundry?.nue?.Tour?.activeTour;
  if (active && setupContext(active) && typeof active.exit === "function") {
    try {
      active.exit();
    } catch (error) {
      notes.push(problem(active, error));
    }
  }
  const tours = host.game?.tours;
  if (tours) {
    for (const tour of tours) {
      if (!tour || tour.status === "completed" || typeof tour.complete !== "function") continue;
      if (!setupContext(tour)) continue;
      try {
        const result = tour.complete();
        if (result && typeof (result as Promise<unknown>).then === "function") {
          void (result as Promise<unknown>).catch((error: unknown) => {
            notes.push(problem(tour, error));
          });
        }
      } catch (error) {
        notes.push(problem(tour, error));
      }
    }
  }
  return { ready: Boolean(host.game?.ready), notes };
}

async function dismissSuggestedNextTour(page: Page): Promise<void> {
  try {
    const root = page.locator(".dialog, .window-app, dialog");
    if (typeof root.filter !== "function") return;
    const matches = root.filter({ hasText: /suggested next tour/i });
    const dialog = typeof matches.last === "function" ? matches.last() : matches;
    const visible = await dialog
      .waitFor({ state: "visible", timeout: TOUR_WAIT_MS })
      .then(() => true)
      .catch(() => false);
    if (!visible) return;
    const decline = dialog.getByRole("button", { name: /^no$/i }).first();
    const declined = await decline
      .click({ timeout: TOUR_WAIT_MS })
      .then(() => true)
      .catch(() => false);
    if (declined) return;
    const close = dialog.getByRole("button", { name: /close window/i }).first();
    await close.click({ timeout: TOUR_WAIT_MS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    noteTourProblem(`suggested next tour: ${message}`.slice(0, 240));
  }
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

  noteAuthPhase("tour close");
  noteTourProblem("tour close");
  const ready = await withPhaseTimeout(
    "tour close",
    TOUR_CLOSE_PHASE_MS,
    (async () => {
      const outcome = tourCloseOutcome(await current.evaluate(silenceCoreTours));
      for (const line of outcome.notes) noteTourProblem(line);
      await dismissSuggestedNextTour(current);
      return outcome.ready;
    })(),
  );
  if (ready) return current;

  noteAuthPhase("create world");
  await withPhaseTimeout(
    "create world",
    CREATE_WORLD_PHASE_MS,
    (async () => {
      const created = await current.evaluate(
        async function ensureWorldRecord(world) {
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
      if (created === "unavailable") await createWorldThroughUi(current);
    })(),
  );

  await launchWorld(current);
  return current;
}

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

async function waitForJoinOrGame(page: Page): Promise<void> {
  const waits: Array<Promise<unknown>> = [
    page
      .getByRole("button", { name: /join game|join/i })
      .first()
      .waitFor({ state: "visible", timeout: ADMIN_SCREEN_TIMEOUT_MS }),
  ];
  if (typeof page.waitForURL === "function") {
    waits.push(page.waitForURL(/\/(?:join|game)(?:\/|$|\?)/, { timeout: ADMIN_SCREEN_TIMEOUT_MS }));
  }
  try {
    await Promise.any(waits);
  } catch {
    throw new Error("Foundry setup stalled during create world");
  }
}

async function screenShown(read: () => { isVisible: () => Promise<boolean> }): Promise<boolean> {
  try {
    return await read().isVisible();
  } catch {
    return false;
  }
}

async function worldAlreadyOpen(page: Page): Promise<boolean> {
  const url = typeof page.url === "function" ? page.url() : "";
  if (url.includes("/join") || url.includes("/game")) return true;
  if (
    await screenShown(() => page.getByRole("heading", { name: "User Management", exact: true }))
  ) {
    return true;
  }
  return screenShown(() => page.getByRole("button", { name: /join game|join/i }).first());
}

async function createWorldThroughUi(page: Page): Promise<void> {
  const create = page.getByRole("button", { name: /create world|new world/i }).first();
  await create.waitFor({ state: "visible", timeout: ADMIN_SCREEN_TIMEOUT_MS });
  await dismissSetupTour(page);
  await create.click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
  const title = page.locator('input[name="title"], input[name="name"]').first();
  await title.fill("Pivot Fantasy E2E");
  const filter = page.getByRole("searchbox", { name: /filter systems/i }).first();
  if ((await filter.inputValue()) !== "") await filter.fill("");
  const card = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Pivot Fantasy", exact: true }) })
    .first();
  await card.click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
  const outcome = await Promise.any([
    page
      .getByRole("button", { name: /launch/i })
      .first()
      .waitFor({ state: "visible", timeout: ADMIN_SCREEN_TIMEOUT_MS })
      .then(() => "launch" as const),
    page
      .getByRole("heading", { name: "User Management", exact: true })
      .waitFor({ state: "visible", timeout: ADMIN_SCREEN_TIMEOUT_MS })
      .then(() => "users" as const),
  ]).catch(() => {
    throw new Error("Foundry setup stalled during create world");
  });
  if (outcome !== "users") return;
  await page
    .getByRole("button", { name: "Save and Continue", exact: true })
    .click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
  await waitForJoinOrGame(page);
}

async function launchWorld(page: Page): Promise<void> {
  noteAuthPhase("launch");
  if (await worldAlreadyOpen(page)) return;
  const launched = await withPhaseTimeout(
    "launch",
    LAUNCH_PHASE_MS,
    page.evaluate(async function launchInstalledWorld(worldId) {
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
    }, process.env.PIVOT_E2E_WORLD_ID || "pivot-e2e"),
  );

  if (!launched) {
    const launch = page.getByRole("button", { name: /launch/i }).first();
    await expect(launch).toBeVisible({ timeout: LAUNCH_PHASE_MS });
    await launch.click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
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
      await page.goto("/join", { waitUntil: "domcontentloaded", timeout: NAVIGATION_MS });
    }
    await page.getByText(name, { exact: true }).first().click({ timeout: JOIN_PHASE_MS });
    const submitJoin = async () => {
      const join = page.getByRole("button", { name: /join game|join/i }).first();
      if (await join.isVisible().catch(() => false)) {
        await join.click({ timeout: ADMIN_SCREEN_TIMEOUT_MS });
      }
    };
    if (password) {
      const field = page.locator('input[type="password"]');
      if ((await field.count()) > 0) await fillSecret(field.first(), password);
      await submitJoin();
      await clearPasswordFields(page);
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
      timeout: GAME_READY_MS,
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
