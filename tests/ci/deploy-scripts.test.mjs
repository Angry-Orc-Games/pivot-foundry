import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const waitScript = fileURLToPath(new URL("../../scripts/ci/wait-for-foundry.sh", import.meta.url));
const compatScript = fileURLToPath(
  new URL("../../scripts/ci/check-production-compat.mjs", import.meta.url),
);
const configScript = fileURLToPath(
  new URL("../../scripts/ci/check-deploy-config.sh", import.meta.url),
);

const servers = [];

async function serve(routes) {
  const server = createServer((req, res) => {
    const body = routes[req.url];
    if (body === undefined) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

function runWait(args, env) {
  return new Promise((resolve) => {
    const child = spawn("bash", [waitScript, ...args], {
      env: {
        PATH: process.env.PATH,
        PIVOT_WAIT_ATTEMPTS: "2",
        PIVOT_WAIT_INTERVAL: "0",
        ...env,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});

describe("wait-for-foundry.sh", () => {
  it("succeeds once /api/status reports a version", async () => {
    const base = await serve({ "/api/status": '{"version":"14.367"}' });
    const result = await runWait(["Build server"], { PIVOT_FOUNDRY_BASE_URL: base });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Build server is up.");
  });

  it("fails when /api/status never answers", async () => {
    const base = await serve({});
    const result = await runWait(["Build server"], { PIVOT_FOUNDRY_BASE_URL: base });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("did not answer /api/status");
  });

  it("fails when /api/status has no version", async () => {
    const base = await serve({ "/api/status": '{"active":true}' });
    const result = await runWait(["Build server"], { PIVOT_FOUNDRY_BASE_URL: base });
    expect(result.status).toBe(1);
  });

  it("requires the manifest to serve the expected version", async () => {
    const base = await serve({
      "/api/status": '{"version":"14.367"}',
      "/system.json": '{"version":"1.2.3"}',
    });
    const env = { PIVOT_FOUNDRY_BASE_URL: base };
    const served = await runWait(["Production", `${base}/system.json`, "1.2.3"], env);
    expect(served.status).toBe(0);
    expect(served.stdout).toContain("Production is serving 1.2.3.");

    const stale = await runWait(["Production", `${base}/system.json`, "1.2.4"], env);
    expect(stale.status).toBe(1);
    expect(stale.stdout + stale.stderr).toContain("did not serve 1.2.4");
  });

  it("rejects a manifest URL without an expected version", async () => {
    const result = await runWait(["Production", "http://127.0.0.1:1/system.json"], {
      PIVOT_FOUNDRY_BASE_URL: "http://127.0.0.1:1",
    });
    expect(result.status).toBe(2);
  });
});

describe("check-deploy-config.sh", () => {
  const all = {
    HAVE_FOUNDRY_DEPLOY_SSH_HOST: "true",
    HAVE_FOUNDRY_DEPLOY_SSH_USER: "true",
    HAVE_FOUNDRY_DEPLOY_SSH_KEY: "true",
    HAVE_FOUNDRY_DEPLOY_TARGET_DIR: "true",
    HAVE_FOUNDRY_DEPLOY_BACKUP_DIR: "true",
    HAVE_FOUNDRY_DEPLOY_SERVICE: "true",
  };

  function run(env) {
    return spawnSync("bash", [configScript, "build"], {
      env: { PATH: process.env.PATH, ...env },
      encoding: "utf8",
    });
  }

  it("passes when every flag is true", () => {
    const result = run(all);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("All required build secrets are configured.");
  });

  it("names only the missing entries and exits 3", () => {
    const env = { ...all, HAVE_FOUNDRY_DEPLOY_SERVICE: "false" };
    delete env.HAVE_FOUNDRY_DEPLOY_SSH_KEY;
    const result = run(env);
    expect(result.status).toBe(3);
    expect(result.stdout).toContain(
      "Missing secrets/variables on GitHub Environment 'build': FOUNDRY_DEPLOY_SSH_KEY FOUNDRY_DEPLOY_SERVICE.",
    );
  });
});

describe("check-production-compat.mjs", () => {
  async function run(candidate, routes) {
    const base = await serve(routes);
    const dir = await mkdtemp(join(tmpdir(), "compat-"));
    try {
      await writeFile(join(dir, "system.json"), JSON.stringify(candidate));
      return await new Promise((resolve) => {
        const child = spawn("node", [compatScript], {
          cwd: dir,
          env: {
            PATH: process.env.PATH,
            PIVOT_PRODUCTION_MANIFEST_URL: `${base}/system.json`,
          },
        });
        let out = "";
        child.stdout.on("data", (chunk) => (out += chunk));
        child.stderr.on("data", (chunk) => (out += chunk));
        child.on("close", (status) => resolve({ status, out }));
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it("accepts a package that needs Foundry 14", async () => {
    const result = await run(
      { version: "1.1.0", compatibility: { minimum: "14" } },
      { "/system.json": '{"version":"1.0.0"}' },
    );
    expect(result.status).toBe(0);
    expect(result.out).toContain("1.0.0 -> 1.1.0");
  });

  it("refuses a package that needs a newer Foundry", async () => {
    const result = await run(
      { version: "1.1.0", compatibility: { minimum: "15" } },
      { "/system.json": '{"version":"1.0.0"}' },
    );
    expect(result.status).toBe(4);
  });

  it("fails when the production manifest cannot be read", async () => {
    const result = await run({ version: "1.1.0" }, {});
    expect(result.status).toBe(1);
    expect(result.out).toContain("Could not read the production manifest.");
  });
});
