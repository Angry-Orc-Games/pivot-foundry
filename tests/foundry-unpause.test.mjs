import { createContext, runInContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { ensureUnpaused } from "../e2e/helpers/foundry.ts";

function gamePage({ isGM, paused }) {
  const calls = [];
  const state = { paused };
  const context = createContext({
    window: {
      game: {
        user: { isGM },
        get paused() {
          return state.paused;
        },
        togglePause(next, options) {
          calls.push({ paused: next, options });
          state.paused = next;
        },
      },
    },
  });
  const run = (fn) => runInContext(`(${fn.toString()})()`, context);
  return {
    calls,
    state,
    async evaluate(fn) {
      return run(fn);
    },
    async waitForFunction(fn) {
      const open = await run(fn);
      if (!open) throw new Error("game stayed paused");
    },
  };
}

describe("ensureUnpaused", () => {
  it("does not toggle pause when the GM world is already open", async () => {
    const page = gamePage({ isGM: true, paused: false });
    await ensureUnpaused(page);
    expect(page.calls).toEqual([]);
    expect(page.state.paused).toBe(false);
  });

  it("unpauses a GM world once and leaves a second call alone", async () => {
    const page = gamePage({ isGM: true, paused: true });
    await ensureUnpaused(page);
    await ensureUnpaused(page);
    expect(page.calls).toEqual([{ paused: false, options: { broadcast: true } }]);
    expect(page.state.paused).toBe(false);
  });

  it("does not toggle pause for a player", async () => {
    const page = gamePage({ isGM: false, paused: true });
    await ensureUnpaused(page);
    expect(page.calls).toEqual([]);
    expect(page.state.paused).toBe(true);
  });
});
