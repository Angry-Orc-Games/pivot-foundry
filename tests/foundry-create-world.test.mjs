import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const SNAPSHOT = fileURLToPath(
  new URL("./fixtures/foundry-v14-create-world.snapshot.txt", import.meta.url),
);

function hidden() {
  const node = {
    first() {
      return node;
    },
    async count() {
      return 0;
    },
    async isVisible() {
      return false;
    },
    async waitFor() {
      throw new Error("hidden");
    },
    async fill() {},
  };
  return node;
}

function v14CreateWorldPage({ hangCard = false, decoySelect = false, stepDelayMs = 0 } = {}) {
  const events = [];
  const selectCalls = [];
  let worldReady = false;
  const pause = () =>
    stepDelayMs === 0
      ? Promise.resolve()
      : new Promise((resolve) => globalThis.setTimeout(resolve, stepDelayMs));
  const title = {
    first() {
      return title;
    },
    async fill() {
      await pause();
      events.push("title");
    },
  };
  const systemSelect = {
    first() {
      return systemSelect;
    },
    async count() {
      return decoySelect ? 1 : 0;
    },
    async selectOption(option) {
      selectCalls.push(option);
      if (option && "label" in option && typeof option.label !== "string") {
        throw new Error("locator.selectOption: options[0].label: expected string, got object");
      }
      throw new Error("option not found");
    },
  };
  const openForm = {
    first() {
      return openForm;
    },
    last() {
      return openForm;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
    async click() {
      await pause();
      events.push("open-form");
    },
  };
  const pivotHeading = { pivotHeading: true };
  const card = {
    first() {
      return card;
    },
    async click() {
      await pause();
      events.push("pick-system");
      if (hangCard) return new Promise(() => {});
    },
  };
  return {
    events,
    selectCalls,
    async goto() {},
    async waitForFunction() {},
    async evaluate(fn) {
      if (fn?.name === "silenceCoreTours") return { ready: false, notes: [] };
      if (fn?.name === "ensureWorldRecord") return "unavailable";
      if (fn?.name === "launchInstalledWorld") return true;
      return false;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("select")) return systemSelect;
      if (text.includes("title") || text.includes('name="name"')) return title;
      return hidden();
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World")) return openForm;
      if (role === "searchbox" && name instanceof RegExp && name.test("Filter systems")) {
        const field = {
          first() {
            return field;
          },
          async fill(value) {
            await pause();
            events.push(`filter:${value}`);
          },
        };
        return field;
      }
      if (role === "heading" && name === "Pivot Fantasy" && options.exact === true) {
        return pivotHeading;
      }
      if (role === "listitem") {
        return {
          filter(filterOptions = {}) {
            if (!filterOptions.has?.pivotHeading) {
              throw new Error("listitem was not the Pivot Fantasy card");
            }
            return card;
          },
        };
      }
      if (role === "button" && name === "Continue" && options.exact === true) {
        return {
          async click() {
            await pause();
            events.push("continue");
            worldReady = true;
          },
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Launch")) {
        const launch = {
          first() {
            return launch;
          },
          async waitFor() {
            await pause();
            if (!worldReady) throw new Error("launch hidden");
            events.push("world-ready");
          },
          async isVisible() {
            return worldReady;
          },
        };
        return launch;
      }
      if (role === "checkbox" || role === "heading") return hidden();
      if (role === "button") return hidden();
      throw new Error(`unexpected role ${role}`);
    },
  };
}

describe("v14 create world", () => {
  it("clicks the Pivot Fantasy card and Continue without a RegExp selectOption", async () => {
    const snapshot = await readFile(SNAPSHOT, "utf8");
    expect(snapshot).toContain('searchbox "Filter systems"');
    expect(snapshot).toContain('heading "Pivot Fantasy"');
    expect(snapshot).toContain('button "Continue"');
    expect(snapshot).not.toMatch(/combobox "System"|select "System"/);

    const page = v14CreateWorldPage({ decoySelect: true });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events).toEqual([
      "open-form",
      "title",
      "filter:Pivot Fantasy",
      "pick-system",
      "continue",
      "world-ready",
    ]);
    expect(page.selectCalls.some((call) => call?.label instanceof RegExp)).toBe(false);
  });

  it("finishes a create-world form that takes longer than 20s", async () => {
    vi.useFakeTimers();
    const page = v14CreateWorldPage({ stepDelayMs: 4_000 });
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
      await vi.advanceTimersByTimeAsync(24_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBe("done");
    expect(page.events).toContain("world-ready");
  });

  it("stalls create world when the system card click never returns", async () => {
    vi.useFakeTimers();
    const page = v14CreateWorldPage({ hangCard: true });
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
      await vi.advanceTimersByTimeAsync(20_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during create world/);
    expect(page.events).toContain("pick-system");
    expect(page.events).not.toContain("continue");
  });
});
