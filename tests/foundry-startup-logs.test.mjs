import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chmod, cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const composeModule = fileURLToPath(new URL("../scripts/foundry-compose.mjs", import.meta.url));
const envModule = fileURLToPath(new URL("../scripts/foundry-env.mjs", import.meta.url));

const dockerStub = `#!/bin/sh
printf '%s\\n' "$*" >> "$STARTUP_STUB_DIR/argv"
if [ "$1" = "logs" ]; then
  printf '%s\\n' "foundry-booting FOUNDRY_LICENSE_KEY=super-secret-license"
  printf '%s\\n' "EULA signature: 9b1c0d2e3f4a5678"
  printf '%s\\n' "cache https://cache-user:p%3Ass%40word@cache.example/foundry.zip"
  exit 0
fi
printf '%s\\n' "unexpected docker $*" >&2
exit 1
`;

const childSource = `
import { collectDiagnostics, waitForHttp } from ${JSON.stringify(composeModule)};
import { createFoundryPaths } from ${JSON.stringify(envModule)};

const paths = createFoundryPaths({
  root: process.env.STARTUP_ROOT,
  role: "e2e",
  instanceId: "failed-start",
  processEnv: {},
});

try {
  await waitForHttp(process.argv[1], Number(process.argv[2]));
  console.log("STATUS_OK");
} catch (error) {
  collectDiagnostics(paths);
  console.error(error.message);
  process.exitCode = 1;
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

describe("failed Foundry start", () => {
  it("writes redacted docker logs and names the last connection error", async () => {
    const root = await mkdtemp(join(tmpdir(), "pivot-startup-"));
    const bin = join(root, "bin");
    const stubDir = join(root, "stub");
    await mkdir(join(root, "foundry"), { recursive: true });
    await mkdir(bin);
    await mkdir(stubDir);
    await cp(join(repoRoot, "foundry", "versions.json"), join(root, "foundry", "versions.json"));
    await writeExecutable(join(bin, "docker"), dockerStub);

    const port = await closedPort();
    const url = `http://127.0.0.1:${port}/`;
    const result = await runChild(url, 1500, {
      PATH: `${bin}:${process.env.PATH}`,
      STARTUP_ROOT: root,
      STARTUP_STUB_DIR: stubDir,
    });
    const logPath = join(
      root,
      ".foundry",
      "instances",
      "failed-start",
      "diagnostics",
      "foundry.log",
    );
    const log = await readFile(logPath, "utf8").catch(() => "");
    const argv = await readFile(join(stubDir, "argv"), "utf8").catch(() => "");

    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.output).toContain(`Foundry did not answer HTTP at 127.0.0.1:${port} within 1.5s`);
    expect(result.output).toContain("(ECONNREFUSED)");
    expect(result.output).not.toContain("unsettled top-level await");
    expect(argv).toMatch(/^logs /m);
    expect(log).toContain("foundry-booting");
    expect(log).toContain("EULA signature: 9b1c0d2e3f4a5678");
    expect(log).toContain("FOUNDRY_LICENSE_KEY=<redacted>");
    expect(log).toContain("https://<redacted>@cache.example/foundry.zip");
    expect(log).not.toContain("super-secret-license");
    expect(log).not.toContain("cache-user");
    expect(log).not.toContain("p%3Ass%40word");
  }, 15_000);
});

async function writeExecutable(path, contents) {
  await writeFile(path, contents);
  await chmod(path, 0o755);
}

function runChild(url, timeoutMs, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", childSource, url, String(timeoutMs)],
      { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } },
    );
    let stdout = "";
    let stderr = "";
    const killer = globalThis.setTimeout(() => child.kill("SIGKILL"), 12_000);
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
