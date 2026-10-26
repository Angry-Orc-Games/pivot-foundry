import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import config from "../e2e/playwright.config.ts";
import { authenticateSetup, ensureE2EWorld } from "../e2e/helpers/foundry.ts";

const ADMIN_KEY = "admin-key-secret";
const MISSING_SCREEN =
  "Foundry setup did not show the administrator password field or the Setup screen.";

function lateAdminPage({ adminAfterMs = null, setupAfterSubmit = false } = {}) {
  const started = Date.now();
  const events = [];
  let sawKey = false;
  let unlocked = false;
  const due = (delay) => delay !== null && Date.now() - started >= delay;
  const waitUntil = async (delay) => {
    if (delay === null) throw new Error("screen did not appear");
    while (!due(delay)) await new Promise((resolve) => globalThis.setTimeout(resolve, 5));
  };
  const field = {
    async count() {
      return due(adminAfterMs) ? 1 : 0;
    },
    first() {
      return field;
    },
    async isVisible() {
      return due(adminAfterMs);
    },
    waitFor: () => waitUntil(adminAfterMs),
    async fill(value) {
      if (value === "") return;
      sawKey = value === ADMIN_KEY;
      events.push("filled");
    },
    async evaluate(_fn, value) {
      if (value === "") return;
      sawKey = value === ADMIN_KEY;
      events.push("filled");
    },
    async press(key) {
      events.push(`press:${key}`);
    },
    async screenshot() {},
  };
  return {
    events,
    sawKey: () => sawKey,
    locator() {
      return field;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      if (role === "button" && name instanceof RegExp && name.test("Create World")) {
        return {
          async waitFor() {
            if (setupAfterSubmit && !unlocked) throw new Error("setup hidden");
            if (!setupAfterSubmit) throw new Error("setup hidden");
            events.push("setup-visible");
          },
        };
      }
      if (
        role === "button" &&
        name instanceof RegExp &&
        /submit|log in|unlock|continue/i.test(name.source)
      ) {
        return {
          async isVisible() {
            return true;
          },
          async click() {
            unlocked = true;
            events.push("submit");
          },
        };
      }
      if (role === "checkbox" || role === "heading") {
        return {
          async waitFor() {
            throw new Error("screen did not appear");
          },
        };
      }
      throw new Error(`unexpected role ${role}`);
    },
  };
}

function eulaThenAdminPage({ phase: initialPhase = "eula" } = {}) {
  const events = [];
  let sawKey = false;
  let phase = initialPhase;
  let notedEula = false;
  const password = {
    first() {
      return password;
    },
    async isVisible() {
      return phase === "admin";
    },
    async waitFor() {
      if (phase !== "admin") throw new Error("admin hidden");
    },
    async fill(value) {
      if (value === "") return;
      sawKey = value === ADMIN_KEY;
      events.push("filled");
    },
    async evaluate(_fn, value) {
      if (value === "") return;
      sawKey = value === ADMIN_KEY;
      events.push("filled");
    },
    async press(key) {
      events.push(`press:${key}`);
    },
  };
  return {
    events,
    sawKey: () => sawKey,
    async goto() {},
    async waitForFunction() {},
    async evaluate() {
      return true;
    },
    locator() {
      return password;
    },
    getByRole(role, options = {}) {
      const name = options.name;
      const label = name instanceof RegExp ? name.source : String(name ?? "");
      if (role === "checkbox" && label.includes("I agree to these terms")) {
        return {
          async waitFor() {
            if (phase !== "eula") throw new Error("agreement hidden");
            if (!notedEula) {
              notedEula = true;
              events.push("eula");
            }
          },
          async check() {},
        };
      }
      if (role === "button" && name === "Agree") {
        return {
          async click() {
            phase = "admin";
            events.push("agree");
          },
        };
      }
      if (role === "heading" && label.includes("End User License Agreement")) {
        return {
          async waitFor() {},
        };
      }
      if (role === "button" && name instanceof RegExp && name.test("Create World")) {
        return {
          async waitFor() {
            if (phase !== "setup") throw new Error("setup hidden");
            events.push("setup-visible");
          },
        };
      }
      if (role === "heading" && name === "Setup") {
        return {
          async waitFor() {
            throw new Error("setup heading hidden");
          },
        };
      }
      if (
        role === "button" &&
        name instanceof RegExp &&
        /submit|log in|unlock|continue/i.test(label)
      ) {
        return {
          async isVisible() {
            return phase === "admin";
          },
          async click() {
            phase = "setup";
            events.push("submit");
          },
        };
      }
      throw new Error(`unexpected role ${role} ${label}`);
    },
  };
}

describe("Foundry administrator login", () => {
  it("signs in when the admin field appears after the shell is ready", async () => {
    const page = lateAdminPage({ adminAfterMs: 40, setupAfterSubmit: true });
    await authenticateSetup(page, ADMIN_KEY);

    expect(page.events).toEqual(["filled", "submit", "setup-visible"]);
    expect(page.sawKey()).toBe(true);
    expect(page.events.join(" ")).not.toContain(ADMIN_KEY);
  });

  it("fails when neither the admin field nor the Setup screen appears", async () => {
    const page = lateAdminPage();
    let error;
    try {
      await authenticateSetup(page, ADMIN_KEY);
    } catch (caught) {
      error = caught;
    }

    expect(error?.message).toBe(MISSING_SCREEN);
    expect(`${error?.message ?? ""}`).not.toContain(ADMIN_KEY);
    expect(page.events).toEqual([]);
  });

  it("reports an exception thrown while waiting for the administrator field", async () => {
    const page = lateAdminPage({ adminAfterMs: 0, setupAfterSubmit: true });
    const password = page.locator();
    password.waitFor = async () => {
      throw new Error("Must start tracing before stopping");
    };
    let error;
    try {
      await authenticateSetup(page, ADMIN_KEY);
    } catch (caught) {
      error = caught;
    }

    expect(error?.message).toBe("Must start tracing before stopping");
    expect(`${error?.message ?? ""}`).not.toContain(ADMIN_KEY);
  });

  it("reports a test timeout instead of a missing administrator field", async () => {
    const page = lateAdminPage();
    const password = page.locator();
    const timeout = new Error("Test timeout of 120000ms exceeded.");
    timeout.name = "TimeoutError";
    password.waitFor = async () => {
      throw timeout;
    };
    let error;
    try {
      await authenticateSetup(page, ADMIN_KEY);
    } catch (caught) {
      error = caught;
    }

    expect(error?.message).toBe("Test timeout of 120000ms exceeded.");
    expect(`${error?.message ?? ""}`).not.toContain(ADMIN_KEY);
  });

  it("records license, eula, and admin without the administrator key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-auth-steps-"));
    const marker = join(dir, "setup-failure.txt");
    const previous = process.env.PIVOT_E2E_SETUP_FAILURE;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    const previousEula = process.env.FOUNDRY_E2E_ACCEPT_EULA;
    process.env.FOUNDRY_E2E_ACCEPT_EULA = "1";
    const page = eulaThenAdminPage();
    try {
      await ensureE2EWorld(page, ADMIN_KEY);
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previous;
      if (previousEula === undefined) delete process.env.FOUNDRY_E2E_ACCEPT_EULA;
      else process.env.FOUNDRY_E2E_ACCEPT_EULA = previousEula;
    }
    const log = await readFile(join(dir, "auth-steps.log"), "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(log).toBe("license\nadmin\neula\nadmin\ntour close\n");
    expect(log).not.toContain(ADMIN_KEY);
    expect(page.events.join(" ")).not.toContain(ADMIN_KEY);
  });

  it("signs in when the admin field appears after the agreement", async () => {
    const previous = process.env.FOUNDRY_E2E_ACCEPT_EULA;
    process.env.FOUNDRY_E2E_ACCEPT_EULA = "1";
    const page = eulaThenAdminPage();
    try {
      await ensureE2EWorld(page, ADMIN_KEY);
    } finally {
      if (previous === undefined) delete process.env.FOUNDRY_E2E_ACCEPT_EULA;
      else process.env.FOUNDRY_E2E_ACCEPT_EULA = previous;
    }

    expect(page.events).toEqual(["eula", "agree", "filled", "submit", "setup-visible"]);
    expect(page.sawKey()).toBe(true);
    expect(page.events.join(" ")).not.toContain(ADMIN_KEY);
  });

  it("signs in on a live page when the post-EULA admin wait loses its page", async () => {
    const previous = process.env.FOUNDRY_E2E_ACCEPT_EULA;
    process.env.FOUNDRY_E2E_ACCEPT_EULA = "1";
    const replacement = eulaThenAdminPage({ phase: "admin" });
    const page = eulaThenAdminPage();
    let closed = false;
    page.isClosed = () => closed;
    const password = page.locator();
    const originalWait = password.waitFor.bind(password);
    password.waitFor = async () => {
      if (page.events.includes("agree") && !closed) {
        closed = true;
        throw new Error("locator.waitFor: Target page, context or browser has been closed");
      }
      return originalWait();
    };
    const context = {
      pages() {
        return closed ? [page, replacement] : [page];
      },
    };
    page.context = () => context;
    replacement.context = () => context;
    replacement.isClosed = () => false;
    try {
      await ensureE2EWorld(page, ADMIN_KEY);
    } finally {
      if (previous === undefined) delete process.env.FOUNDRY_E2E_ACCEPT_EULA;
      else process.env.FOUNDRY_E2E_ACCEPT_EULA = previous;
    }

    expect(replacement.sawKey()).toBe(true);
    expect(replacement.events).toEqual(["filled", "submit", "setup-visible"]);
    expect(replacement.events.join(" ")).not.toContain(ADMIN_KEY);
  });

  it("reports the context error when the browser is gone after the EULA", async () => {
    const previous = process.env.FOUNDRY_E2E_ACCEPT_EULA;
    process.env.FOUNDRY_E2E_ACCEPT_EULA = "1";
    const page = eulaThenAdminPage();
    let closed = false;
    page.isClosed = () => closed;
    const password = page.locator();
    const originalWait = password.waitFor.bind(password);
    password.waitFor = async () => {
      if (page.events.includes("agree") && !closed) {
        closed = true;
        throw new Error("locator.waitFor: Target page, context or browser has been closed");
      }
      return originalWait();
    };
    page.context = () => ({
      pages() {
        throw new Error("browserContext.pages: Target page, context or browser has been closed");
      },
    });
    let error;
    try {
      await ensureE2EWorld(page, ADMIN_KEY);
    } catch (caught) {
      error = caught;
    } finally {
      if (previous === undefined) delete process.env.FOUNDRY_E2E_ACCEPT_EULA;
      else process.env.FOUNDRY_E2E_ACCEPT_EULA = previous;
    }

    expect(error?.message).toBe(
      "browserContext.pages: Target page, context or browser has been closed",
    );
    expect(`${error?.message ?? ""}`).not.toContain(ADMIN_KEY);
  });

  it("sees Setup when a hidden password is earlier in the DOM", async () => {
    const events = [];
    const password = {
      first() {
        return password;
      },
      async isVisible() {
        return false;
      },
      async waitFor() {
        throw new Error("password hidden");
      },
      or(other) {
        return union.add(other);
      },
    };
    const setup = {
      first() {
        return setup;
      },
      async isVisible() {
        return true;
      },
      async waitFor() {
        events.push("setup-visible");
      },
    };
    const visibleSet = {
      first() {
        return setup;
      },
      async waitFor() {
        events.push("setup-visible");
      },
    };
    const union = {
      parts: [],
      add(other) {
        union.parts.push(other);
        return union;
      },
      or(other) {
        return union.add(other);
      },
      first() {
        return password;
      },
      visible() {
        return visibleSet;
      },
      async waitFor() {
        events.push("union-visible");
      },
    };
    const page = {
      locator() {
        return password;
      },
      getByRole(role, options = {}) {
        const name = options.name;
        if (role === "button" && name instanceof RegExp && name.test("Create World")) return setup;
        return {
          async isVisible() {
            return false;
          },
          async waitFor() {
            throw new Error("screen did not appear");
          },
        };
      },
    };

    await authenticateSetup(page, ADMIN_KEY);

    expect(events).toContain("setup-visible");
    expect(events.join(" ")).not.toContain(ADMIN_KEY);
  });

  it("finishes the admin phase when clearing the password field never settles", async () => {
    const page = lateAdminPage({ adminAfterMs: 0, setupAfterSubmit: true });
    const password = page.locator();
    password.fill = () => new Promise(() => {});
    let outcome = "hung";
    const pending = authenticateSetup(page, ADMIN_KEY).then(
      () => {
        outcome = "done";
      },
      (error) => {
        outcome = error;
      },
    );
    await Promise.race([pending, new Promise((resolve) => globalThis.setTimeout(resolve, 15_000))]);

    expect(outcome).not.toBe("hung");
    expect(page.events).toContain("setup-visible");
    expect(page.events.join(" ")).not.toContain(ADMIN_KEY);
  }, 20_000);

  it("logs tour close, create world, and launch when each phase starts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-auth-steps-"));
    const marker = join(dir, "setup-failure.txt");
    const previous = process.env.PIVOT_E2E_SETUP_FAILURE;
    const previousEula = process.env.FOUNDRY_E2E_ACCEPT_EULA;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    process.env.FOUNDRY_E2E_ACCEPT_EULA = "1";
    const page = eulaThenAdminPage();
    const seen = [];
    let calls = 0;
    page.evaluate = async () => {
      calls += 1;
      seen.push(await readFile(join(dir, "auth-steps.log"), "utf8").catch(() => ""));
      if (calls === 1) return false;
      if (calls === 2) return "created";
      return true;
    };
    try {
      await ensureE2EWorld(page, ADMIN_KEY);
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previous;
      if (previousEula === undefined) delete process.env.FOUNDRY_E2E_ACCEPT_EULA;
      else process.env.FOUNDRY_E2E_ACCEPT_EULA = previousEula;
      await rm(dir, { recursive: true, force: true });
    }

    expect(seen[0]).toContain("tour close\n");
    expect(seen[1]).toContain("create world\n");
    expect(seen[2]).toContain("launch\n");
    expect(seen.join("")).not.toContain(ADMIN_KEY);
  });

  it("bounds actions and keeps the setup hook longer than its phase budgets", async () => {
    expect(config.use?.actionTimeout).toBe(15_000);
    expect(config.use?.navigationTimeout).toBe(30_000);
    const spec = await readFile(
      new URL("../e2e/tests/package-and-sheet.spec.ts", import.meta.url),
      "utf8",
    );
    expect(spec).toContain("setupHookTimeoutMs()");
    const { setupHookTimeoutMs, setupPhaseBudgetMs } = await import("../e2e/helpers/foundry.ts");
    expect(setupHookTimeoutMs()).toBeGreaterThan(setupPhaseBudgetMs());
  });
});
