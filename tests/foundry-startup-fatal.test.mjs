import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chmod, cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { describeStartupFailure, waitForHttp } from "../scripts/foundry-compose.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const composeModule = fileURLToPath(new URL("../scripts/foundry-compose.mjs", import.meta.url));
const envModule = fileURLToPath(new URL("../scripts/foundry-env.mjs", import.meta.url));

const fatalLog = [
  "No Foundry Virtual Tabletop installation detected.",
  "Using CONTAINER_CACHE: /opt/foundry-dist",
  "Failure 1 detected (exit code 1).  Exiting immediately.",
  "Failed to write backoff state file '/opt/foundry-dist/backoff_state.json'.  Falling back to indefinite sleep.",
  "./entrypoint.sh: line 224: /opt/foundry-dist/CACHEDIR.TAG: Read-only file system",
  "FOUNDRY_LICENSE_KEY=super-secret-license",
].join("\n");

const installingLog = [
  "No Foundry Virtual Tabletop installation detected.",
  "Installing Foundry Virtual Tabletop 14.361",
  "Starting launcher.",
].join("\n");

describe("fatal Foundry startup", () => {
  it("fails immediately when the container gives up without exiting", () => {
    expect(describeStartupFailure(fatalLog, "running 0")).toMatch(
      /No Foundry installation detected/,
    );
    expect(describeStartupFailure(fatalLog, "running 0")).not.toContain("super-secret-license");
    expect(describeStartupFailure("Aborting startup", "running 0")).toMatch(/abort/i);
    expect(describeStartupFailure(installingLog, "running 0")).toBeNull();
    expect(describeStartupFailure("still booting", "exited 1")).toMatch(/stopped/);
  });

  it("stops the http wait and writes foundry.log", async () => {
    const started = Date.now();
    let error;
    try {
      await waitForHttp("http://127.0.0.1:1/", 3_000, {
        inspect: () => describeStartupFailure(fatalLog, "running 0"),
      });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe("STARTUP_FAILED");
    expect(error?.message).toMatch(/No Foundry installation detected/);
    expect(Date.now() - started).toBeLessThan(800);

    const root = await mkdtemp(join(tmpdir(), "pivot-fatal-"));
    const bin = join(root, "bin");
    await mkdir(join(root, "foundry"), { recursive: true });
    await mkdir(bin);
    await mkdir(join(root, "stub"));
    await cp(join(repoRoot, "foundry", "versions.json"), join(root, "foundry", "versions.json"));
    await writeFile(
      join(bin, "docker"),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$FATAL_STUB_DIR/argv"
if [ "$1" = "logs" ]; then
  printf '%s\\n' "No Foundry Virtual Tabletop installation detected."
  printf '%s\\n' "Failure 1 detected (exit code 1).  Exiting immediately."
  printf '%s\\n' "/opt/foundry-dist/CACHEDIR.TAG: Read-only file system"
  printf '%s\\n' "FOUNDRY_LICENSE_KEY=super-secret-license"
  exit 0
fi
if [ "$1" = "inspect" ]; then
  printf '%s\\n' "running 0"
  exit 0
fi
exit 1
`,
    );
    await chmod(join(bin, "docker"), 0o755);

    const port = await closedPort();
    const result = await runChild(`http://127.0.0.1:${port}/`, 4_000, {
      PATH: `${bin}:${process.env.PATH}`,
      FATAL_ROOT: root,
      FATAL_STUB_DIR: join(root, "stub"),
    });
    const logPath = join(
      root,
      ".foundry",
      "instances",
      "fatal-start",
      "diagnostics",
      "foundry.log",
    );
    const log = await readFile(logPath, "utf8").catch(() => "");

    expect(result.code).toBe(5);
    expect(result.signal).toBeNull();
    expect(result.output).toMatch(/No Foundry installation detected/);
    expect(result.output).not.toContain("unsettled top-level await");
    expect(log).toContain("Read-only file system");
    expect(log).toContain("FOUNDRY_LICENSE_KEY=<redacted>");
    expect(log).not.toContain("super-secret-license");
    expect(Date.now() - started).toBeLessThan(3_000);
  }, 8_000);
});

const childSource = `
import { collectDiagnostics, containerStartupProblem, waitForHttp } from ${JSON.stringify(composeModule)};
import { createFoundryPaths } from ${JSON.stringify(envModule)};

const paths = createFoundryPaths({
  root: process.env.FATAL_ROOT,
  role: "e2e",
  instanceId: "fatal-start",
  processEnv: {},
});

try {
  await waitForHttp(process.argv[1], Number(process.argv[2]), {
    inspect: () => containerStartupProblem(paths),
  });
  console.log("STATUS_OK");
} catch (error) {
  if (error.code === "STARTUP_FAILED") collectDiagnostics(paths);
  console.error(error.message || String(error));
  process.exitCode = error.code === "STARTUP_FAILED" ? 5 : error.code === "TIMEOUT" ? 10 : 1;
}
`;

function closedPort() {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function runChild(url, timeoutMs, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", childSource, url, String(timeoutMs)],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...env },
      },
    );
    let stdout = "";
    let stderr = "";
    const killer = globalThis.setTimeout(() => child.kill("SIGKILL"), 7_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      globalThis.clearTimeout(killer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      globalThis.clearTimeout(killer);
      resolve({ code, signal, stdout, stderr, output: `${stdout}\n${stderr}` });
    });
  });
}
