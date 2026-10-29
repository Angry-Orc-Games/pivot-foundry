import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const composeModule = fileURLToPath(new URL("../scripts/foundry-compose.mjs", import.meta.url));

const childSource = `
import { waitForHttp } from ${JSON.stringify(composeModule)};
try {
  const status = await waitForHttp(process.argv[1], Number(process.argv[2]));
  console.log("STATUS " + status);
} finally {
  console.log("FINALLY_MARKER");
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

const cliSource = `
import { waitForHttp } from ${JSON.stringify(composeModule)};
try {
  await waitForHttp(process.argv[1], Number(process.argv[2]));
  console.log("STATUS_OK");
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = error.code === "TIMEOUT" ? 10 : 1;
} finally {
  console.log("FINALLY_MARKER");
}
`;

function runWait(url, timeoutMs, source = childSource, killAfterMs = 12_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", source, url, String(timeoutMs)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const killer = globalThis.setTimeout(() => child.kill("SIGKILL"), killAfterMs);
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

describe("waitForHttp process lifetime", () => {
  it("times out on a closed port, exits non-zero, and runs finally", async () => {
    const port = await closedPort();
    const url = `http://license:super-secret-key@127.0.0.1:${port}/join`;
    const started = Date.now();
    const result = await runWait(url, 2000);

    expect(result.code).not.toBe(13);
    expect(result.signal).toBeNull();
    expect(result.code).not.toBe(0);
    expect(result.output).toContain(`Foundry did not answer HTTP at 127.0.0.1:${port} within 2s`);
    expect(result.output).toContain("(credentials in URL)");
    expect(result.output).toContain("FINALLY_MARKER");
    expect(result.output).not.toContain("super-secret-key");
    expect(result.output).not.toContain("unsettled top-level await");
    expect(Date.now() - started).toBeGreaterThan(1500);
  }, 15_000);

  it("returns the status after the port starts answering", async () => {
    const port = await closedPort();
    const url = `http://127.0.0.1:${port}/`;
    const started = Date.now();
    const pending = runWait(url, 8000);
    const server = createServer((_request, response) => {
      response.writeHead(204);
      response.end();
    });
    const opener = globalThis.setTimeout(() => {
      server.listen(port, "127.0.0.1");
    }, 2200);

    let result;
    try {
      result = await pending;
    } finally {
      globalThis.clearTimeout(opener);
      if (server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
    }

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("STATUS 204");
    expect(result.stdout).toContain("FINALLY_MARKER");
    expect(Date.now() - started).toBeGreaterThan(2000);
  }, 15_000);

  it("rejects when the server accepts and never answers", async () => {
    const server = createServer(() => {});
    const port = await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve(server.address().port));
    });
    const started = Date.now();
    let result;
    try {
      result = await runWait(`http://127.0.0.1:${port}/`, 1500, cliSource, 5_000);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    expect(result.code).toBe(10);
    expect(result.signal).toBeNull();
    expect(result.output).toContain(`Foundry did not answer HTTP at 127.0.0.1:${port} within 1.5s`);
    expect(result.output).toContain("FINALLY_MARKER");
    expect(result.output).not.toContain("unsettled top-level await");
    expect(Date.now() - started).toBeLessThan(4000);
  }, 8_000);
});
