import { describe, expect, it } from "vitest";

import { ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const INTERCEPTS = '<div class="tour-overlay"></div> intercepts pointer events';

function tourPage() {
  const events = [];
  let attached = true;
  let evaluations = 0;
  const overlay = {
    first() {
      return overlay;
    },
    async waitFor(options = {}) {
      if (options.state === "detached") {
        if (attached) throw new Error("tour overlay still attached");
        return;
      }
      if (!attached) throw new Error("tour overlay hidden");
    },
  };
  const hidden = {
    first() {
      return hidden;
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
  const title = {
    first() {
      return title;
    },
    async fill() {
      events.push("title");
    },
  };
  const exitTour = {
    first() {
      return exitTour;
    },
    async click() {
      attached = false;
      events.push("tour-exit");
    },
  };
  const createWorld = {
    first() {
      return createWorld;
    },
    last() {
      return createWorld;
    },
    async waitFor() {},
    async isVisible() {
      return true;
    },
    async click() {
      if (attached) throw new Error(INTERCEPTS);
      events.push("create-world");
    },
  };
  return {
    events,
    async goto() {},
    async waitForFunction() {},
    async evaluate() {
      evaluations += 1;
      if (evaluations === 1) return false;
      if (evaluations === 2) return "unavailable";
      return true;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("tour-overlay")) return overlay;
      if (text.includes("title") || text.includes('name="name"')) return title;
      return hidden;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      const label = name instanceof RegExp ? name.source : String(name ?? "");
      if (role === "button" && name instanceof RegExp && name.test("Exit Tour")) {
        return exitTour;
      }
      if (role === "button" && name instanceof RegExp && name.test("Create World")) {
        return createWorld;
      }
      if (role === "checkbox" || role === "heading") return hidden;
      throw new Error(`unexpected role ${role} ${label}`);
    },
    keyboard: {
      async press(key) {
        if (key === "Escape") {
          attached = false;
          events.push("tour-exit");
        }
      },
    },
  };
}

describe("Foundry setup tour", () => {
  it("closes the tour overlay before Create World", async () => {
    const page = tourPage();
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events[0]).toBe("tour-exit");
    expect(page.events).toContain("create-world");
    expect(page.events.indexOf("create-world")).toBeGreaterThan(page.events.indexOf("tour-exit"));
  });
});
