import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import config from "../e2e/playwright.config.ts";
import { authenticateSetup, createPlayerUser, joinAs } from "../e2e/helpers/foundry.ts";

const ADMIN_KEY = "admin-key-secret";

function tracedAdminPage(trace) {
  let leaked = false;
  let unlocked = false;
  const password = {
    first() {
      return password;
    },
    async isVisible() {
      return true;
    },
    async waitFor() {},
    async fill(value) {
      if (trace.recording() && value === ADMIN_KEY) leaked = true;
    },
    async evaluate(_fn, value) {
      if (trace.recording() && value === ADMIN_KEY) leaked = true;
    },
    async press() {},
  };
  return {
    leaked: () => leaked,
    context() {
      return { tracing: trace.controls };
    },
    locator() {
      return password;
    },
    getByRole(role, options = {}) {
      const name = options.name;
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
          },
        };
      }
      return {
        async waitFor() {
          if (!unlocked) throw new Error("setup hidden");
        },
      };
    },
  };
}

function tracedJoinPage(trace) {
  let leaked = false;
  const password = {
    async count() {
      return 1;
    },
    first() {
      return password;
    },
    nth() {
      return password;
    },
    async fill(value) {
      if (trace.recording() && value === ADMIN_KEY) leaked = true;
    },
    async evaluate(_fn, value) {
      if (trace.recording() && value === ADMIN_KEY) leaked = true;
    },
  };
  const user = {
    first() {
      return user;
    },
    async selectOption() {},
    async evaluate(read) {
      return read({ selectedOptions: [{ label: "Player" }] });
    },
  };
  const section = {
    filter() {
      return section;
    },
    first() {
      return section;
    },
    locator() {
      return password;
    },
    getByRole(role, options = {}) {
      if (role === "combobox") return user;
      if (role === "button" && options.name === "Join Game Session") {
        return { async click() {} };
      }
      return {
        first() {
          return this;
        },
        async isVisible() {
          return true;
        },
        async click() {},
      };
    },
  };
  return {
    leaked: () => leaked,
    url() {
      return "http://127.0.0.1:30000/join";
    },
    context() {
      return { tracing: trace.controls };
    },
    locator(selector = "") {
      if (String(selector).includes("#join-game")) return section;
      return password;
    },
    getByRole() {
      return {
        first() {
          return {
            async isVisible() {
              return true;
            },
            async click() {},
          };
        },
      };
    },
    async waitForFunction() {},
    async evaluate() {
      return {
        ready: true,
        systemId: "pivot-fantasy",
        systemVersion: "0.0.0",
        worldId: "pivot-e2e",
        worldTitle: "Pivot Fantasy E2E",
        version: "14.361",
      };
    },
  };
}

function tracedPlayerPage(trace) {
  let leaked = false;
  return {
    leaked: () => leaked,
    context() {
      return { tracing: trace.controls };
    },
    async evaluate(_fn, arg) {
      if (trace.recording() && arg?.userPassword === ADMIN_KEY) leaked = true;
    },
  };
}

function tracingTouch() {
  let touched = false;
  return {
    touched: () => touched,
    recording: () => false,
    context() {
      touched = true;
      return {
        tracing: {
          async stopChunk() {},
          async startChunk() {},
        },
      };
    },
  };
}

describe("Foundry traces stay off", () => {
  it("ships the Foundry E2E config with tracing off", () => {
    expect(config.use?.trace).toBe("off");
    expect(config.use?.screenshot).toBe("only-on-failure");
    expect(config.use?.video).toBe("off");
    for (const project of config.projects ?? []) {
      expect(project.use?.trace ?? "off").toBe("off");
    }
  });

  it("ships the external smoke config with tracing off", async () => {
    const previousBase = process.env.PIVOT_FOUNDRY_BASE_URL;
    const previousTarget = process.env.PIVOT_FOUNDRY_TARGET;
    process.env.PIVOT_FOUNDRY_BASE_URL = "https://staging.example.test";
    process.env.PIVOT_FOUNDRY_TARGET = "staging";
    try {
      const external = await import("../e2e/external/playwright.config.ts");
      expect(external.default.use?.trace).toBe("off");
      for (const project of external.default.projects ?? []) {
        expect(project.use?.trace ?? "off").toBe("off");
      }
    } finally {
      if (previousBase === undefined) delete process.env.PIVOT_FOUNDRY_BASE_URL;
      else process.env.PIVOT_FOUNDRY_BASE_URL = previousBase;
      if (previousTarget === undefined) delete process.env.PIVOT_FOUNDRY_TARGET;
      else process.env.PIVOT_FOUNDRY_TARGET = previousTarget;
    }
  });

  it("does not touch context.tracing while signing in", async () => {
    const trace = tracingTouch();
    const page = tracedAdminPage(trace);
    Object.assign(page, { context: trace.context });
    await authenticateSetup(page, ADMIN_KEY);
    expect(trace.touched()).toBe(false);
    expect(page.leaked()).toBe(false);
  });

  it("does not touch context.tracing while joining", async () => {
    const trace = tracingTouch();
    const page = tracedJoinPage(trace);
    Object.assign(page, { context: trace.context });
    await joinAs(page, { name: "Player", password: ADMIN_KEY });
    expect(trace.touched()).toBe(false);
    expect(page.leaked()).toBe(false);
  });

  it("does not touch context.tracing while creating a player", async () => {
    const trace = tracingTouch();
    const page = tracedPlayerPage(trace);
    Object.assign(page, { context: trace.context });
    await createPlayerUser(page, "Player", ADMIN_KEY);
    expect(trace.touched()).toBe(false);
    expect(page.leaked()).toBe(false);
  });

  it("does not photograph a filled password field", async () => {
    let filled = false;
    const shots = [];
    const password = {
      first() {
        return password;
      },
      async isVisible() {
        return true;
      },
      async waitFor() {},
      async fill(value) {
        filled = value === ADMIN_KEY;
      },
      async evaluate(_fn, value) {
        filled = value === ADMIN_KEY;
      },
      async count() {
        return 1;
      },
      nth() {
        return password;
      },
    };
    const page = {
      async screenshot() {
        shots.push(filled ? "secret" : "clear");
      },
      locator() {
        return password;
      },
      getByRole(role, options = {}) {
        const name = options.name;
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
              throw new Error("admin submit failed");
            },
          };
        }
        return {
          async waitFor() {
            throw new Error("setup hidden");
          },
        };
      },
    };

    let error;
    try {
      await authenticateSetup(page, ADMIN_KEY);
    } catch (caught) {
      error = caught;
    }
    await page.screenshot();

    expect(error?.message).toBe("admin submit failed");
    expect(shots).not.toContain("secret");
    expect(shots).not.toContain(ADMIN_KEY);
  });

  it("does not photograph a password when the clear never settles", async () => {
    let filled = false;
    const shots = [];
    const password = {
      first() {
        return password;
      },
      async isVisible() {
        return true;
      },
      async waitFor() {},
      fill() {
        return new Promise(() => {});
      },
      async evaluate(_fn, value) {
        filled = value === ADMIN_KEY;
      },
      async count() {
        return 1;
      },
      nth() {
        return password;
      },
    };
    const page = {
      async screenshot() {
        shots.push(filled ? "secret" : "clear");
      },
      locator() {
        return password;
      },
      getByRole(role, options = {}) {
        const name = options.name;
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
              throw new Error("admin submit failed");
            },
          };
        }
        return {
          async waitFor() {
            throw new Error("setup hidden");
          },
        };
      },
    };

    let error;
    try {
      await authenticateSetup(page, ADMIN_KEY);
    } catch (caught) {
      error = caught;
    }
    await page.screenshot();

    expect(error?.message).toBe("admin submit failed");
    expect(shots).not.toContain("secret");
    expect(shots).not.toContain(ADMIN_KEY);
  }, 20_000);

  it("writes a join phase without the password", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-auth-steps-"));
    const marker = join(dir, "setup-failure.txt");
    const previous = process.env.PIVOT_E2E_SETUP_FAILURE;
    process.env.PIVOT_E2E_SETUP_FAILURE = marker;
    const trace = tracingTouch();
    const page = tracedJoinPage(trace);
    try {
      await joinAs(page, { name: "Player", password: ADMIN_KEY });
    } finally {
      if (previous === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
      else process.env.PIVOT_E2E_SETUP_FAILURE = previous;
    }
    const log = await readFile(join(dir, "auth-steps.log"), "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(log).toBe("join\n");
    expect(log).not.toContain(ADMIN_KEY);
  });
});
