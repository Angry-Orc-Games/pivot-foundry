import { describe, expect, it, vi } from "vitest";

import { e2eWorldId, ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const ACTION_MS = 15_000;
const EVALUATE_MS = 20_000;

function arm(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function dead() {
  const node = {
    first() {
      return node;
    },
    async waitFor() {
      throw new Error("hidden");
    },
    async click() {
      throw new Error("hidden");
    },
    async isVisible() {
      return false;
    },
    async fill() {},
    async inputValue() {
      return "";
    },
    async count() {
      return 0;
    },
  };
  return node;
}

function budgetPage(stall) {
  let budgeting = false;
  const events = [];
  const spend = (ms) => (budgeting ? arm(ms) : Promise.resolve());
  const limit = (options) => options?.timeout ?? ACTION_MS;

  const createButton = {
    first() {
      return createButton;
    },
    async waitFor(options) {
      await spend(limit(options));
    },
    async click(options) {
      await spend(limit(options));
      events.push("create-click");
    },
    async isVisible() {
      return true;
    },
  };

  const title = {
    first() {
      return title;
    },
    async fill() {
      await spend(ACTION_MS);
      events.push("title");
    },
  };

  const worldId = e2eWorldId();
  const worldIdField = {
    first() {
      return worldIdField;
    },
    async fill() {
      await spend(ACTION_MS);
      events.push("world-id");
    },
    async inputValue() {
      await spend(ACTION_MS);
      events.push("world-id-value");
      return worldId;
    },
  };

  const overlay = {
    first() {
      return overlay;
    },
    async waitFor(options) {
      await spend(limit(options));
      events.push("tour-wait");
    },
  };

  const tourClick = {
    first() {
      return tourClick;
    },
    async click(options) {
      await spend(limit(options));
      events.push("tour-click");
      throw new Error("hidden");
    },
  };

  return {
    events,
    async goto() {},
    async waitForFunction() {},
    async keyboardPress() {},
    keyboard: {
      async press() {
        events.push("escape");
      },
    },
    async evaluate(fn) {
      if (fn?.name === "silenceCoreTours") return { ready: false, notes: [] };
      if (fn?.name === "ensureWorldRecord") {
        await arm(EVALUATE_MS);
        budgeting = true;
        return "unavailable";
      }
      if (fn?.name === "launchInstalledWorld") return true;
      return false;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("tour-overlay")) return overlay;
      if (text.includes('data-action="exit"')) return tourClick;
      if (text.includes('name="title"') && text.includes('name="world-id"')) return worldIdField;
      if (text.includes('name="title"')) return title;
      return dead();
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World")) {
        return createButton;
      }
      if (role === "button" && name instanceof RegExp && name.test("Exit Tour")) {
        return tourClick;
      }
      if (role === "searchbox") {
        const field = {
          first() {
            return field;
          },
          async inputValue() {
            await spend(ACTION_MS);
            events.push("filter-value");
            return "core";
          },
          async fill() {
            await spend(ACTION_MS);
            events.push("filter-clear");
          },
        };
        return field;
      }
      if (role === "listitem") {
        const card = {
          first() {
            return card;
          },
          async click(clickOptions) {
            await spend(limit(clickOptions));
            events.push("pick-system");
          },
        };
        return {
          filter() {
            return card;
          },
        };
      }
      if (role === "button" && name === "Continue" && options.exact === true) {
        return {
          async click(clickOptions) {
            await spend(limit(clickOptions));
            events.push("continue");
          },
        };
      }
      if (role === "heading" && name === "User Management" && options.exact === true) {
        return {
          async waitFor(waitOptions) {
            await spend(limit(waitOptions));
            events.push("users");
          },
          async isVisible() {
            return true;
          },
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Launch")) {
        const launch = {
          first() {
            return launch;
          },
          async waitFor(waitOptions) {
            await spend(limit(waitOptions));
            throw new Error("hidden");
          },
          async isVisible() {
            return false;
          },
        };
        return launch;
      }
      if (role === "button" && name === "Save and Continue" && options.exact === true) {
        return {
          async click(clickOptions) {
            const ms = limit(clickOptions);
            if (stall === "save") {
              await spend(ms - 1);
              throw new Error("locator.click: Timeout 15000ms exceeded");
            }
            await spend(ms);
            events.push("save-users");
          },
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Join Game")) {
        const join = {
          first() {
            return join;
          },
          async waitFor(waitOptions) {
            const ms = limit(waitOptions);
            if (stall === "join") {
              await spend(ms - 1);
              events.push("join-timeout");
              throw new Error("locator.waitFor: Timeout 15000ms exceeded");
            }
            await spend(ms);
          },
          async isVisible() {
            return false;
          },
        };
        return join;
      }
      if (role === "button" || role === "checkbox" || role === "heading") return dead();
      throw new Error(`unexpected role ${role} ${String(name)}`);
    },
  };
}

async function runStall(stall) {
  vi.useFakeTimers();
  const page = budgetPage(stall);
  let outcome = "hung";
  const pending = ensureE2EWorld(page, "admin-key-secret").then(
    () => {
      outcome = "done";
    },
    (error) => {
      outcome = error;
    },
  );
  try {
    await vi.advanceTimersByTimeAsync(600_000);
    await Promise.race([pending, Promise.resolve()]);
  } finally {
    vi.useRealTimers();
  }
  return { outcome, events: page.events };
}

describe("create world phase budget", () => {
  it("reports the save click timeout when that click is still inside its own timeout", async () => {
    const { outcome, events } = await runStall("save");

    expect(events).toContain("world-id");
    expect(events).toContain("world-id-value");
    expect(events).toContain("users");
    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toBe("locator.click: Timeout 15000ms exceeded");
  });

  it("reaches the join wait timeout instead of the create world phase timer", async () => {
    const { outcome } = await runStall("join");

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.stack).toMatch(/helpers\/foundry\.ts/);
    expect(outcome.stack).not.toMatch(/foundry-setup\.mjs/);
  });
});
