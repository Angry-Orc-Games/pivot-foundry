import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it } from "vitest";

import { saveSecondaryPageFailure } from "../e2e/helpers/foundry.ts";

const ADMIN_KEY = "admin-key-secret";
const PLAYER_PASSWORD = "player-secret-value";

function passwordPage({ failClear = false, failShot = false } = {}) {
  const events = [];
  const field = {
    async count() {
      return 1;
    },
    nth() {
      return field;
    },
    async fill(value) {
      events.push(`fill:${value}`);
      if (failClear) throw new Error("clear failed");
    },
  };
  return {
    events,
    locator() {
      return field;
    },
    async screenshot() {
      events.push("screenshot");
      if (failShot) throw new Error("shot failed");
      return Buffer.from("png-bytes");
    },
  };
}

describe("secondary page failure diagnostics", () => {
  const previousFailure = process.env.PIVOT_E2E_SETUP_FAILURE;
  const previousAdmin = process.env.FOUNDRY_ADMIN_KEY;
  const previousLicense = process.env.FOUNDRY_LICENSE_KEY;

  afterEach(() => {
    if (previousFailure === undefined) delete process.env.PIVOT_E2E_SETUP_FAILURE;
    else process.env.PIVOT_E2E_SETUP_FAILURE = previousFailure;
    if (previousAdmin === undefined) delete process.env.FOUNDRY_ADMIN_KEY;
    else process.env.FOUNDRY_ADMIN_KEY = previousAdmin;
    if (previousLicense === undefined) delete process.env.FOUNDRY_LICENSE_KEY;
    else process.env.FOUNDRY_LICENSE_KEY = previousLicense;
  });

  it("screenshots after the password clear and redacts the console tail", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-player-diag-"));
    process.env.PIVOT_E2E_SETUP_FAILURE = join(dir, "setup-failure.txt");
    process.env.FOUNDRY_ADMIN_KEY = ADMIN_KEY;
    process.env.FOUNDRY_LICENSE_KEY = "ABCD-EFGH-IJKL-MNOP-QRST-UVWX";
    const page = passwordPage();
    const lines = Array.from({ length: 60 }, (_, index) => `line ${index}`);
    lines[55] = `joined with ${PLAYER_PASSWORD} and ${ADMIN_KEY}`;
    try {
      await saveSecondaryPageFailure(page, lines, [PLAYER_PASSWORD, ADMIN_KEY]);
      expect(page.events).toEqual(["fill:", "screenshot"]);
      const shot = await readFile(join(dir, "player-page.png"));
      expect(shot.equals(Buffer.from("png-bytes"))).toBe(true);
      expect(shot.includes(PLAYER_PASSWORD)).toBe(false);
      const log = await readFile(join(dir, "player-console.log"), "utf8");
      expect(log.split("\n").filter(Boolean)).toHaveLength(50);
      expect(log).not.toContain("line 9");
      expect(log).toContain("line 10");
      expect(log).toContain("line 59");
      expect(log).toContain("joined with [redacted] and [redacted]");
      expect(log).not.toContain(PLAYER_PASSWORD);
      expect(log).not.toContain(ADMIN_KEY);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips the screenshot when the password clear fails and still writes the log", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-player-diag-"));
    process.env.PIVOT_E2E_SETUP_FAILURE = join(dir, "setup-failure.txt");
    const page = passwordPage({ failClear: true });
    try {
      await saveSecondaryPageFailure(page, [`password ${PLAYER_PASSWORD}`], [PLAYER_PASSWORD]);
      expect(page.events).toEqual(["fill:"]);
      await expect(readFile(join(dir, "player-page.png"))).rejects.toThrow();
      const log = await readFile(join(dir, "player-console.log"), "utf8");
      expect(log).toBe("password [redacted]\n");
      expect(log).not.toContain(PLAYER_PASSWORD);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes the console tail when the screenshot throws", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-player-diag-"));
    process.env.PIVOT_E2E_SETUP_FAILURE = join(dir, "setup-failure.txt");
    const page = passwordPage({ failShot: true });
    try {
      await saveSecondaryPageFailure(page, ["ready"], []);
      expect(page.events).toEqual(["fill:", "screenshot"]);
      await expect(readFile(join(dir, "player-page.png"))).rejects.toThrow();
      expect(await readFile(join(dir, "player-console.log"), "utf8")).toBe("ready\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
