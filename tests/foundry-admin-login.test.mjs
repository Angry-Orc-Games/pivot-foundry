import { describe, expect, it } from "vitest";

import { authenticateSetup } from "../e2e/helpers/foundry.ts";

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
});
