import { describe, expect, it } from "vitest";

import { authenticateSetup, createPlayerUser, joinAs } from "../e2e/helpers/foundry.ts";

const ADMIN_KEY = "admin-key-secret";

function tracing() {
  let recording = true;
  return {
    recording: () => recording,
    controls: {
      async stopChunk() {
        recording = false;
      },
      async startChunk() {
        recording = true;
      },
    },
  };
}

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
  return {
    leaked: () => leaked,
    url() {
      return "http://127.0.0.1:30000/join";
    },
    context() {
      return { tracing: trace.controls };
    },
    getByText() {
      return {
        first() {
          return {
            async click() {},
          };
        },
      };
    },
    locator() {
      const field = {
        async fill(value) {
          if (trace.recording() && value === ADMIN_KEY) leaked = true;
        },
      };
      return {
        async count() {
          return 1;
        },
        first() {
          return field;
        },
      };
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

describe("Foundry secret traces", () => {
  it("does not record the administrator key", async () => {
    const trace = tracing();
    const page = tracedAdminPage(trace);
    await authenticateSetup(page, ADMIN_KEY);
    expect(page.leaked()).toBe(false);
  });

  it("does not record the join password", async () => {
    const trace = tracing();
    const page = tracedJoinPage(trace);
    await joinAs(page, { name: "Player", password: ADMIN_KEY });
    expect(page.leaked()).toBe(false);
  });

  it("does not record the player password passed into the page", async () => {
    const trace = tracing();
    const page = tracedPlayerPage(trace);
    await createPlayerUser(page, "Player", ADMIN_KEY);
    expect(page.leaked()).toBe(false);
  });
});
