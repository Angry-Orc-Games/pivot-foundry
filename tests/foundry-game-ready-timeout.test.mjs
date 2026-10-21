import { createContext, runInContext } from "node:vm";

import { describe, expect, it } from "vitest";

import config from "../e2e/playwright.config.ts";
import {
  ensureUnpaused,
  joinAsCeilingMs,
  playerSyncTimeoutMs,
  sceneCanvasTimeoutMs,
  sheetSpecTimeoutMs,
  waitForCanvasReady,
  waitForFoundryShell,
  waitForGameReady,
} from "../e2e/helpers/foundry.ts";

const GAME_READY_MS = 180_000;
const LICENSE_PHASE_MS = 60_000;
const UNPAUSE_MS = 15_000;
const CANVAS_READY_MS = 120_000;

function recordingPage(evaluate) {
  const calls = [];
  return {
    calls,
    async goto() {},
    async evaluate(fn, arg) {
      if (evaluate) return evaluate(fn, arg);
      return {
        ready: true,
        systemId: "pivot-fantasy",
        systemVersion: "0.1.0",
        worldId: "pivot-e2e",
        worldTitle: "Pivot",
        version: "14.361",
      };
    },
    async waitForFunction(fn, arg, options) {
      calls.push({ fn, arg, options });
    },
  };
}

function pausedGmPage() {
  const calls = [];
  const waits = [];
  const state = { paused: true };
  const context = createContext({
    window: {
      game: {
        user: { isGM: true },
        get paused() {
          return state.paused;
        },
        togglePause(next) {
          calls.push(next);
          state.paused = next;
        },
      },
    },
  });
  return {
    waits,
    async evaluate(fn) {
      return runInContext(`(${fn.toString()})()`, context);
    },
    async waitForFunction(fn, arg, options) {
      waits.push({ fn, arg, options });
    },
  };
}

describe("waitForFunction timeouts", () => {
  it("passes the game-ready budget as waitForFunction options", async () => {
    const page = recordingPage();
    await waitForGameReady(page);
    expect(page.calls).toHaveLength(1);
    expect(page.calls[0].arg).toBeUndefined();
    expect(page.calls[0].options?.timeout).toBe(GAME_READY_MS);
  });

  it("passes the license budget as waitForFunction options", async () => {
    const page = recordingPage();
    await waitForFoundryShell(page);
    expect(page.calls).toHaveLength(1);
    expect(page.calls[0].arg).toBeUndefined();
    expect(page.calls[0].options?.timeout).toBe(LICENSE_PHASE_MS);
  });

  it("passes the unpause budget as waitForFunction options", async () => {
    const page = pausedGmPage();
    await ensureUnpaused(page);
    expect(page.waits).toHaveLength(1);
    expect(page.waits[0].arg).toBeUndefined();
    expect(page.waits[0].options?.timeout).toBe(UNPAUSE_MS);
  });

  it("passes the canvas budget as waitForFunction options", async () => {
    const page = recordingPage();
    await waitForCanvasReady(page);
    expect(page.calls).toHaveLength(1);
    expect(page.calls[0].arg).toBeUndefined();
    expect(page.calls[0].options?.timeout).toBe(CANVAS_READY_MS);
  });
});

describe("spec timeouts", () => {
  it("leaves 180s for the player join after the GM join", () => {
    const gm = joinAsCeilingMs(false);
    const player = joinAsCeilingMs(true);
    expect(gm).toBe(30_000 + 60_000 + 180_000);
    expect(player).toBe(30_000 + 60_000 + 1_000 + 180_000);
    expect(gm + 180_000).toBeGreaterThan(360_000);
    expect(playerSyncTimeoutMs()).toBe(gm + player + config.expect.timeout);
    expect(playerSyncTimeoutMs()).toBeGreaterThan(360_000);
  });

  it("leaves the scene test room for the canvas wait after the GM join", () => {
    expect(sceneCanvasTimeoutMs()).toBe(
      joinAsCeilingMs(false) + config.expect.timeout + 15_000 + 120_000,
    );
    expect(sceneCanvasTimeoutMs()).toBeGreaterThan(360_000);
  });

  it("leaves the sheet test room for two GM joins and a reload", () => {
    expect(sheetSpecTimeoutMs()).toBe(
      joinAsCeilingMs(false) * 2 + config.expect.timeout * 2 + config.use.navigationTimeout,
    );
    expect(sheetSpecTimeoutMs()).toBeGreaterThan(360_000);
  });
});
