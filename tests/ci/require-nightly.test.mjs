import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci/require-nightly.sh", import.meta.url));
const releaseWorkflow = fileURLToPath(
  new URL("../../.github/workflows/release.yml", import.meta.url),
);

const SHA = "a".repeat(40);
const REPO = "Angry-Orc-Games/pivot-foundry";
const TOKEN = "test-token";
const RUN_ID = "39221528714";
const RUN_URL = `https://github.com/${REPO}/actions/runs/${RUN_ID}`;

function checkRun(overrides = {}) {
  return {
    name: "Foundry E2E (nightly)",
    head_sha: SHA,
    status: "completed",
    conclusion: "success",
    details_url: RUN_URL,
    app: { slug: "github-actions" },
    output: {
      title: "Foundry E2E (nightly)",
      summary: `Foundry started for E2E commit ${SHA}.\n${RUN_URL}`,
    },
    ...overrides,
  };
}

function workflowRun(overrides = {}) {
  return {
    name: "Foundry E2E",
    path: ".github/workflows/e2e.yml",
    event: "schedule",
    head_branch: "main",
    head_sha: SHA,
    conclusion: "success",
    status: "completed",
    ...overrides,
  };
}

function listen(handler) {
  const requests = [];
  const server = createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      requests.push({
        url: req.url ?? "",
        authorization: req.headers.authorization ?? "",
      });
      handler(req, res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("test server did not bind"));
        return;
      }
      resolve({
        requests,
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function api(checks, run = workflowRun()) {
  return listen((req, res) => {
    const url = req.url ?? "";
    if (url.startsWith(`/repos/${REPO}/commits/${SHA}/check-runs`)) {
      respond(res, 200, { total_count: checks.length, check_runs: checks });
      return;
    }
    if (url === `/repos/${REPO}/actions/runs/${RUN_ID}`) {
      respond(res, 200, run);
      return;
    }
    respond(res, 404, { message: "not found" });
  });
}

function runScript(apiUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [script], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: "C",
        GITHUB_API_URL: apiUrl,
        GITHUB_SHA: SHA,
        GITHUB_REPOSITORY: REPO,
        GITHUB_TOKEN: TOKEN,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status) => {
      resolve({ status: status ?? 1, stdout, stderr });
    });
  });
}

async function expectFailure(server, pattern) {
  const result = await runScript(server.url);
  await server.close();
  const output = `${result.stdout}${result.stderr}`;

  expect(result.status).toBe(1);
  expect(output).toContain("::error::");
  expect(output).toMatch(pattern);
  expect(output).not.toContain(TOKEN);
  expect(server.requests[0]?.authorization).toBe(`Bearer ${TOKEN}`);
  expect(server.requests[0]?.url).toContain(
    `/repos/${REPO}/commits/${SHA}/check-runs?check_name=Foundry%20E2E%20(nightly)&filter=latest`,
  );
}

describe("require nightly check", () => {
  it("passes when the latest check is green and came from the nightly workflow", async () => {
    const server = await api([checkRun()]);
    const result = await runScript(server.url);
    await server.close();
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toBe("");
    expect(output).not.toContain(TOKEN);
    expect(server.requests.map((request) => request.url)).toEqual([
      `/repos/${REPO}/commits/${SHA}/check-runs?check_name=Foundry%20E2E%20(nightly)&filter=latest`,
      `/repos/${REPO}/actions/runs/${RUN_ID}`,
    ]);
    expect(server.requests.every((request) => request.authorization === `Bearer ${TOKEN}`)).toBe(
      true,
    );
  });

  it("passes a workflow_dispatch nightly on main when the run id is only in the summary", async () => {
    const server = await api(
      [
        checkRun({
          details_url: `https://github.com/${REPO}/runs/117959225816`,
          output: {
            title: "Foundry E2E (nightly)",
            summary: `Foundry started for E2E commit ${SHA}.\n${RUN_URL}`,
          },
        }),
      ],
      workflowRun({ event: "workflow_dispatch", conclusion: "failure" }),
    );
    const result = await runScript(server.url);
    await server.close();

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toBe("");
  });

  it("fails when the check is missing", async () => {
    const server = await api([]);
    await expectFailure(server, /check is missing/);
    expect(server.requests).toHaveLength(1);
  });

  it("fails when the check is red", async () => {
    const server = await api([checkRun({ conclusion: "failure" })]);
    await expectFailure(server, /check failed/);
  });

  it("fails when the check is neutral", async () => {
    const server = await api([checkRun({ conclusion: "neutral" })]);
    await expectFailure(server, /check is neutral/);
  });

  it("fails when the check app is not github-actions", async () => {
    const server = await api([checkRun({ app: { slug: "other-app" } })]);
    await expectFailure(server, /github-actions/);
  });

  it.each([
    ["path", { path: ".github/workflows/ci.yml" }],
    ["event", { event: "push" }],
    ["head_branch", { head_branch: "feature" }],
  ])(
    "fails when the linked run %s is not the nightly workflow on main",
    async (_field, overrides) => {
      const server = await api([checkRun()], workflowRun(overrides));
      await expectFailure(server, /unverifiable/);
    },
  );

  it("fails when the details link and summary name different runs", async () => {
    const server = await api([
      checkRun({
        output: {
          title: "Foundry E2E (nightly)",
          summary: `Foundry started for E2E commit ${SHA}.\nhttps://github.com/${REPO}/actions/runs/111`,
        },
      }),
    ]);
    await expectFailure(server, /unverifiable/);
  });

  it("fails when the check does not identify an Actions run", async () => {
    const server = await api([
      checkRun({
        details_url: `https://github.com/${REPO}/runs/117959225816`,
        output: {
          title: "Foundry E2E (nightly)",
          summary: "Foundry E2E result failed validation for this run.",
        },
      }),
    ]);
    await expectFailure(server, /unverifiable/);
  });
});

describe("release workflow", () => {
  it("does not select foundry-e2e, read Foundry secrets, or start Foundry", async () => {
    const release = await readFile(releaseWorkflow, "utf8");

    expect(release).not.toContain("environment: foundry-e2e");
    expect(release).not.toMatch(/FOUNDRY_/);
    expect(release).not.toContain("foundry:e2e");
    expect(release).not.toContain("foundry-cli");
    expect(release).toContain("bash trusted-gate/scripts/ci/require-nightly.sh");
    expect(release).toContain("needs: [package, nightly]");
    expect(release).not.toContain("refs/tags/");
    expect(release).toContain("bash scripts/ci/assert-tag-sha.sh");
  });
});
