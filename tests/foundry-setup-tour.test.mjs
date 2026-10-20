import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const INTERCEPTS = '<div class="tour-overlay"></div> intercepts pointer events';

function tourPage({ attached = true } = {}) {
  const events = [];
  let covered = attached;
  let evaluations = 0;
  const overlay = {
    first() {
      return overlay;
    },
    async waitFor(options = {}) {
      if (options.state === "detached") {
        if (covered) throw new Error("tour overlay still attached");
        return;
      }
      if (!covered) throw new Error("tour overlay hidden");
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
      covered = false;
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
      if (covered) throw new Error(INTERCEPTS);
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
          covered = false;
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

  it("records tour close and create world without the administrator key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-auth-steps-"));
    const marker = join(dir, "setup-failure.txt");
    const previous = process.env.PIVOT_E2E_SETUP_FAILURE;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    const page = tourPage();
    try {
      await ensureE2EWorld(page, "admin-key-secret");
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previous;
    }
    const log = await readFile(join(dir, "auth-steps.log"), "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(log).toBe("license\nadmin\neula\nadmin\ntour close\ncreate world\n");
    expect(log).not.toContain("admin-key-secret");
  });

  it("clicks Create World when no tour is showing", async () => {
    const page = tourPage({ attached: false });
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.events[0]).toBe("create-world");
    expect(page.events).not.toContain("tour-exit");
  });
});

describe("setup phase deadlines", () => {
  it("ends an active core tour before Create World when the overlay shows up late", async () => {
    const page = lateTourPage();
    await ensureE2EWorld(page, "admin-key-secret");

    expect(page.ended).toBe(true);
    expect(page.events).toContain("create-world");
  });

  it("names tour close when core tour completion never returns", async () => {
    vi.useFakeTimers();
    const page = lateTourPage({ hangComplete: true });
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
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during tour close/);
  });

  it("names create world when World.create never returns", async () => {
    vi.useFakeTimers();
    const page = tourPage();
    let evaluations = 0;
    page.evaluate = async () => {
      evaluations += 1;
      if (evaluations === 1) return false;
      if (evaluations === 2) return new Promise(() => {});
      return true;
    };
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
      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.race([pending, Promise.resolve()]);
    } finally {
      vi.useRealTimers();
    }

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(/stalled during create world/);
  });
});

function lateTourPage({ hangComplete = false } = {}) {
  const events = [];
  let ended = false;
  const tour = {
    namespace: "core",
    id: "backups-overview",
    status: "in-progress",
    exit() {
      if (hangComplete) return;
      ended = true;
      this.status = "completed";
    },
    complete() {
      if (hangComplete) return new Promise(() => {});
      ended = true;
      this.status = "completed";
      return Promise.resolve();
    },
  };
  let evaluations = 0;
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
      if (!ended) throw new Error(INTERCEPTS);
      events.push("create-world");
    },
  };
  return {
    events,
    get ended() {
      return ended;
    },
    async goto() {},
    async waitForFunction() {},
    async evaluate(fn) {
      if (typeof fn === "function" && fn.toString().includes("activeTour")) {
        globalThis.foundry = { nue: { Tour: { activeTour: tour } } };
        globalThis.game = { ready: false, tours: [tour] };
        try {
          return await fn();
        } finally {
          delete globalThis.foundry;
          delete globalThis.game;
        }
      }
      evaluations += 1;
      if (evaluations === 1) return "unavailable";
      return true;
    },
    locator(selector = "") {
      const text = String(selector);
      if (text.includes("tour-overlay")) return hidden;
      if (text.includes("title") || text.includes('name="name"')) return title;
      return hidden;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World"))
        return createWorld;
      if (role === "checkbox" || role === "heading") return hidden;
      if (role === "button") return hidden;
      throw new Error(`unexpected role ${role}`);
    },
    keyboard: { async press() {} },
  };
}
