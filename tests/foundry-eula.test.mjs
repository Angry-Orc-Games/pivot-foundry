import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ensureE2EWorld } from "../e2e/helpers/foundry.ts";
import { EXIT } from "../scripts/foundry-env.mjs";

const LICENSE = "ABCD-EFGH-IJKL-MNOP-QRST-UVWX";
const SETUP_FAILURE =
  "Foundry setup failed. The End User License Agreement is on screen. Set FOUNDRY_E2E_ACCEPT_EULA=1 to sign it for this run. Tests were not run.";

function eulaPage({ agreementVisible }) {
  const clicks = [];
  let agreed = false;
  let evals = 0;
  return {
    clicks,
    async goto() {},
    async waitForFunction() {},
    locator() {
      return {
        count: async () => 0,
        first() {
          return this;
        },
        isVisible: async () => false,
      };
    },
    async evaluate() {
      evals += 1;
      if (evals === 1) return agreed;
      return "unavailable";
    },
    getByRole(role, options = {}) {
      const name = String(options.name ?? "");
      if (role === "checkbox" && name.includes("I agree to these terms")) {
        return {
          isVisible: async () => agreementVisible && !agreed,
          check: async () => {
            clicks.push("check");
          },
        };
      }
      if (role === "button" && name === "Agree") {
        return {
          click: async () => {
            clicks.push("Agree");
            agreed = true;
          },
        };
      }
      if (role === "heading" && name.includes("End User License Agreement")) {
        return {
          waitFor: async () => {
            clicks.push("cleared");
          },
        };
      }
      if (role === "button" && name === "Decline") {
        return {
          click: async () => {
            clicks.push("Decline");
          },
        };
      }
      throw new Error("create world was queried");
    },
  };
}

async function withEnv(env, run) {
  const previous = new Map();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("Foundry EULA opt-in", () => {
  it("fails setup without signing when the agreement is on screen and the flag is off", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-eula-"));
    const marker = join(dir, "setup-failure.txt");
    const page = eulaPage({ agreementVisible: true });
    let error;
    try {
      await withEnv(
        {
          FOUNDRY_E2E_ACCEPT_EULA: undefined,
          FOUNDRY_LICENSE_KEY: LICENSE,
          PIVOT_E2E_SETUP_FAILURE: marker,
        },
        () => ensureE2EWorld(page, "admin-secret"),
      );
    } catch (caught) {
      error = caught;
    }
    const written = await readFile(marker, "utf8").catch(() => "");
    await rm(dir, { recursive: true, force: true });

    expect(error?.message).toBe(SETUP_FAILURE);
    expect(error?.code).toBe("SETUP");
    expect(page.clicks).toEqual([]);
    expect(written).toBe(`${SETUP_FAILURE}\n`);
    expect(`${error?.message}\n${written}`).not.toContain(LICENSE);
    expect(`${error?.message}\n${written}`).not.toContain("admin-secret");
  });

  it.each(["", "0", "true", "yes"])("treats FOUNDRY_E2E_ACCEPT_EULA=%j as off", async (value) => {
    const page = eulaPage({ agreementVisible: true });
    let error;
    try {
      await withEnv({ FOUNDRY_E2E_ACCEPT_EULA: value, FOUNDRY_LICENSE_KEY: LICENSE }, () =>
        ensureE2EWorld(page, "admin-secret"),
      );
    } catch (caught) {
      error = caught;
    }

    expect(error?.message).toBe(SETUP_FAILURE);
    expect(page.clicks).toEqual([]);
    expect(error?.message).not.toContain(LICENSE);
  });

  it("signs the agreement and continues when the flag is exactly 1", async () => {
    const page = eulaPage({ agreementVisible: true });
    await withEnv({ FOUNDRY_E2E_ACCEPT_EULA: "1", FOUNDRY_LICENSE_KEY: LICENSE }, () =>
      ensureE2EWorld(page, "admin-secret"),
    );
    await withEnv({ FOUNDRY_E2E_ACCEPT_EULA: "1", FOUNDRY_LICENSE_KEY: LICENSE }, () =>
      ensureE2EWorld(page, "admin-secret"),
    );

    expect(page.clicks).toEqual(["check", "Agree", "cleared"]);
    expect(page.clicks).not.toContain("Decline");
  });

  it("skips a world that is already past the agreement", async () => {
    const page = eulaPage({ agreementVisible: false });
    page.evaluate = async () => true;
    await withEnv({ FOUNDRY_E2E_ACCEPT_EULA: undefined, FOUNDRY_LICENSE_KEY: LICENSE }, () =>
      ensureE2EWorld(page, "admin-secret"),
    );

    expect(page.clicks).toEqual([]);
  });

  it("classifies the setup marker as a setup failure, not a test failure", async () => {
    const loaded = await import("../scripts/foundry-e2e.mjs");
    expect(typeof EXIT.setup).toBe("number");
    expect(EXIT.setup).not.toBe(EXIT.tests);
    expect(loaded.e2eFailureExit({ code: "TIMEOUT" }, "")).toBe(EXIT.timeout);
    expect(loaded.e2eFailureExit(new Error("Command failed"), "")).toBe(EXIT.tests);
    expect(loaded.e2eFailureExit(new Error("Command failed"), SETUP_FAILURE)).toBe(EXIT.setup);
    expect(loaded.e2eFailureExit({ code: "STARTUP_FAILED" }, SETUP_FAILURE)).toBe(EXIT.runtime);
  });
});
