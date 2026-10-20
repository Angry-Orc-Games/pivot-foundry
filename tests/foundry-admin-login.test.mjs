import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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

function eulaThenAdminPage() {
  const events = [];
  let sawKey = false;
  let phase = "eula";
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

    expect(log).toBe("license\nadmin\neula\nadmin\n");
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
});
