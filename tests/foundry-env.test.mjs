import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const checker = fileURLToPath(new URL("../scripts/check-foundry-env.mjs", import.meta.url));
const node = process.execPath;

async function runCheck(contents, extraEnv = {}) {
  const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-env-"));
  const envPath = join(dir, ".env.foundry.local");
  await writeFile(envPath, contents);

  try {
    const stdout = execFileSync(node, [checker], {
      encoding: "utf8",
      env: {
        ...process.env,
        FOUNDRY_ENV_PATH: envPath,
        PIVOT_FOUNDRY_APP_DIR: join(dir, "foundry-app"),
        ...extraEnv,
      },
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
  it("requires the local env file", async () => {
    const result = await runCheck("", {
      FOUNDRY_ENV_PATH: join(tmpdir(), "pivot-foundry-missing.env"),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/Copy \.env\.foundry\.local\.example first/);
  });

  it("rejects the placeholder admin key", async () => {
    const result = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=change-me-local-only",
        "FOUNDRY_RELEASE_URL=https://example.com/releases/14.361/FoundryVTT-Node-14.361.zip",
        "",
      ].join("\n"),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/FOUNDRY_ADMIN_KEY/);
  });

  it("accepts a v14 Node.js timed URL", async () => {
    const result = await runCheck(
      [
        "FOUNDRY_ADMIN_KEY=local-admin",
        "FOUNDRY_RELEASE_URL=https://example.com/releases/14.361/FoundryVTT-Node-14.361.zip",
        "",
      ].join("\n"),
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/v14 Node\.js timed URL configured/);
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
        "FOUNDRY_RELEASE_URL=https://example.com/releases/14.361/FoundryVTT-Linux-14.361.zip",
        "",
      ].join("\n"),
    );

    expect(wrongVersion.code).toBe(1);
    expect(wrongVersion.stderr).toMatch(/v14 release/);
    expect(wrongOs.code).toBe(1);
    expect(wrongOs.stderr).toMatch(/Node\.js archive/);
  });

  it("accepts an operator-supplied v14 Node.js zip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-zip-"));
    const archive = join(dir, "FoundryVTT-Node-14.361.zip");
    await writeFile(archive, "");

    const result = await runCheck(
      ["FOUNDRY_ADMIN_KEY=local-admin", `FOUNDRY_RELEASE_ARCHIVE=${archive}`, ""].join("\n"),
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/v14 Node\.js archive configured/);
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

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/FOUNDRY_RELEASE_URL or FOUNDRY_RELEASE_ARCHIVE/);
  });

  it("allows later starts when foundry-app already has main.js", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pivot-foundry-app-"));
    const appDir = join(dir, "foundry-app");
    await mkdir(appDir, { recursive: true });
    await writeFile(join(appDir, "main.js"), "console.log('foundry');\n");

    const result = await runCheck("FOUNDRY_ADMIN_KEY=local-admin\n", {
      PIVOT_FOUNDRY_APP_DIR: appDir,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/v14 Node\.js install is present/);
  });
});

describe("local Foundry host scripts", () => {
  it("launches Foundry with Node, not Docker Compose", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.scripts["foundry:up"]).toBe("node scripts/foundry-host.mjs up");
    expect(packageJson.scripts["foundry:down"]).toBe("node scripts/foundry-host.mjs down");
    expect(packageJson.scripts["foundry:logs"]).toBe("node scripts/foundry-host.mjs logs");
    expect(packageJson.scripts["foundry:up"]).not.toMatch(/docker/i);
    expect(packageJson.scripts["foundry:down"]).not.toMatch(/docker/i);
    expect(packageJson.scripts["foundry:logs"]).not.toMatch(/docker/i);
    expect(
      existsSync(fileURLToPath(new URL("../docker-compose.foundry.yml", import.meta.url))),
    ).toBe(false);
  });
});
