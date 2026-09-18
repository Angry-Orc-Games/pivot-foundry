import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  assertSafeTarget,
  loadVersions,
  parseEnv,
  pinnedImageRef,
  resolveInstanceId,
  slug,
  validateReleaseUrl,
} from "../scripts/foundry-env.mjs";

const checker = fileURLToPath(new URL("../scripts/foundry-cli.mjs", import.meta.url));
const node = process.execPath;
const versions = loadVersions();

function cleanEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      key.startsWith("FOUNDRY_") ||
      key.startsWith("PIVOT_FOUNDRY_") ||
      key === "PIVOT_REQUIRE_RELEASE_SHA256"
    ) {
      continue;
    }
    env[key] = value;
  }
  return { ...env, ...extra };
}

async function runCheck(contents, extraEnv = {}) {
  const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-env-"));
  const envPath = join(dir, ".env.foundry.local");
  await writeFile(envPath, contents);

  try {
    const stdout = execFileSync(node, [checker, "check-env"], {
      encoding: "utf8",
      env: cleanEnv({
        FOUNDRY_ENV_PATH: envPath,
        PIVOT_FOUNDRY_DIST_DIR: join(dir, "foundry-dist"),
        ...extraEnv,
      }),
    });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      code: error.status ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

describe("foundry env check", () => {
  it("requires the local env file or process secrets", async () => {
    const result = await runCheck("", {
      FOUNDRY_ENV_PATH: join(tmpdir(), "pivot-foundry-missing.env"),
    });

    expect(result.code).toBe(3);
    expect(result.stderr).toMatch(/Copy \.env\.foundry\.local\.example first/);
  });

  it("rejects the placeholder admin key", async () => {
    const result = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=change-me-local-only",
        "FOUNDRY_RELEASE_URL=https://example.com/releases/14.368/FoundryVTT-Node-14.368.zip",
        "",
      ].join("\n"),
    );

    expect(result.code).toBe(3);
    expect(result.stderr).toMatch(/FOUNDRY_ADMIN_KEY/);
  });

  it("accepts a v14 Node.js timed URL", async () => {
    const result = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=local-admin",
        "FOUNDRY_RELEASE_URL=https://example.com/releases/14.368/FoundryVTT-Node-14.368.zip",
        "",
      ].join("\n"),
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/14\.368/);
  });

  it("rejects a non-v14 or non-Node timed URL", async () => {
    const wrongVersion = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=local-admin",
        "FOUNDRY_RELEASE_URL=https://example.com/releases/13.351/FoundryVTT-Node-13.351.zip",
        "",
      ].join("\n"),
    );
    const wrongOs = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=local-admin",
        "FOUNDRY_RELEASE_URL=https://example.com/releases/14.368/FoundryVTT-Linux-14.368.zip",
        "",
      ].join("\n"),
    );

    expect(wrongVersion.code).toBe(3);
    expect(wrongVersion.stderr).toMatch(/v14 release/);
    expect(wrongOs.code).toBe(3);
    expect(wrongOs.stderr).toMatch(/Node\.js archive/);
  });

  it("accepts an operator-supplied v14 Node.js zip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-zip-"));
    const archive = join(dir, "FoundryVTT-Node-14.368.zip");
    await writeFile(archive, "");

    const result = await runCheck(
      ["FOUNDRY_ADMIN_KEY=local-admin", `FOUNDRY_RELEASE_ARCHIVE=${archive}`, ""].join("\n"),
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/14\.368/);
  });

  it("does not treat Foundry account login as an install method", async () => {
    const result = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=local-admin",
        "FOUNDRY_USERNAME=you@example.com",
        "FOUNDRY_PASSWORD=secret",
        "",
      ].join("\n"),
    );

    expect(result.code).toBe(3);
    expect(result.stderr).toMatch(/foundry-dist|FOUNDRY_RELEASE_URL|FOUNDRY_RELEASE_ARCHIVE/);
  });

  it("allows later starts when the distribution cache is present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-cache-"));
    const distDir = join(dir, "foundry-dist");
    await mkdir(distDir, { recursive: true });
    await writeFile(join(distDir, versions.cacheFileName), "");

    const result = await runCheck("FOUNDRY_ADMIN_KEY=local-admin\n", {
      PIVOT_FOUNDRY_DIST_DIR: distDir,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Distribution cache is present/);
  });
});

describe("foundry version pins", () => {
  it("pins Foundry 14.368 and an immutable Felddy digest", () => {
    expect(versions.foundryVersion).toBe("14.368");
    expect(versions.foundryNodeMajor).toBe(24);
    expect(versions.container.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pinnedImageRef(versions)).toContain("@sha256:");
    expect(versions.container.supportsFoundryVersion).toBe("14.368");
  });

  it("uses isolated instance ids for worktrees and CI runs", () => {
    expect(slug("Hello World")).toBe("hello-world");
    const localA = resolveInstanceId({ role: "dev", root: "/tmp/worktree-a", processEnv: {} });
    const localB = resolveInstanceId({ role: "dev", root: "/tmp/worktree-b", processEnv: {} });
    expect(localA).not.toBe(localB);
    expect(
      resolveInstanceId({
        role: "e2e",
        processEnv: { GITHUB_RUN_ID: "99", GITHUB_RUN_ATTEMPT: "2" },
      }),
    ).toMatch(/gha-e2e-99-2/);
  });
});

describe("safety guards", () => {
  it("refuses destructive tests against production", () => {
    expect(() =>
      assertSafeTarget({
        target: "production",
        baseUrl: "https://foundry.angryorcgames.com",
        destructive: true,
      }),
    ).toThrow(/production/);
  });

  it("refuses resets against the shared staging host", () => {
    expect(() =>
      assertSafeTarget({
        target: "staging",
        baseUrl: "https://build.angryorcgames.com",
        reset: true,
      }),
    ).toThrow(/reset/);
  });

  it("allows disposable local E2E", () => {
    expect(
      assertSafeTarget({
        target: "e2e",
        baseUrl: "http://127.0.0.1:30000",
        destructive: true,
        reset: true,
      }).isProduction,
    ).toBe(false);
  });
});

describe("env parsing helpers", () => {
  it("parses quoted values without printing them", () => {
    const values = parseEnv("FOUNDRY_ADMIN_KEY='local admin'\n");
    expect(values.get("FOUNDRY_ADMIN_KEY")).toBe("local admin");
  });

  it("accepts the official Node zip URL shape", () => {
    expect(
      validateReleaseUrl(
        "https://example.com/releases/14.368/FoundryVTT-Node-14.368.zip",
        versions,
      ),
    ).toBeNull();
  });
});

describe("command interface", () => {
  it("exposes the Compose-backed Foundry workflow", async () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.scripts["foundry:up"]).toBe("node scripts/foundry-cli.mjs up");
    expect(packageJson.scripts["foundry:e2e"]).toBe("node scripts/foundry-cli.mjs e2e");
    expect(packageJson.scripts["foundry:up"]).not.toMatch(/foundry-host/);
    expect(packageJson.devDependencies["@playwright/test"]).toBe("1.63.0");
  });
});
