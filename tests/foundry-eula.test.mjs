import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

function assignEnv(key, value) {
  if (key === "FOUNDRY_E2E_ACCEPT_EULA") {
    if (value === undefined) delete process.env.FOUNDRY_E2E_ACCEPT_EULA;
    else process.env.FOUNDRY_E2E_ACCEPT_EULA = value;
  } else if (key === "FOUNDRY_LICENSE_KEY") {
    if (value === undefined) delete process.env.FOUNDRY_LICENSE_KEY;
    else process.env.FOUNDRY_LICENSE_KEY = value;
  } else if (key === "PIVOT_E2E_SETUP_FAILURE") {
    if (value === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
    else process.env.PIVOT_E2E_SETUP_FAILURE = value;
  }
}

async function withEnv(env, run) {
  const previous = {
    FOUNDRY_E2E_ACCEPT_EULA: process.env.FOUNDRY_E2E_ACCEPT_EULA,
    FOUNDRY_LICENSE_KEY: process.env.FOUNDRY_LICENSE_KEY,
    PIVOT_E2E_SETUP_FAILURE: process.env.PIVOT_E2E_SETUP_FAILURE,
  };
  for (const [key, value] of Object.entries(env)) assignEnv(key, value);
  try {
    return await run();
  } finally {
    assignEnv("FOUNDRY_E2E_ACCEPT_EULA", previous.FOUNDRY_E2E_ACCEPT_EULA);
    assignEnv("FOUNDRY_LICENSE_KEY", previous.FOUNDRY_LICENSE_KEY);
    assignEnv("PIVOT_E2E_SETUP_FAILURE", previous.PIVOT_E2E_SETUP_FAILURE);
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

  it("does not enable the EULA opt-in in workflows or the env example", async () => {
    const workflowDir = fileURLToPath(new URL("../.github/workflows/", import.meta.url));
    const names = await readdir(workflowDir);
    for (const name of names) {
      const text = await readFile(join(workflowDir, name), "utf8");
      expect(text, name).not.toMatch(/FOUNDRY_E2E_ACCEPT_EULA/);
    }
    const example = await readFile(
      fileURLToPath(new URL("../.env.foundry.local.example", import.meta.url)),
      "utf8",
    );
    expect(example).not.toContain("FOUNDRY_E2E_ACCEPT_EULA");
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
