import { Buffer } from "node:buffer";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { connect as connectTcp } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const targetsScript = fileURLToPath(new URL("../../scripts/ci/e2e-targets.sh", import.meta.url));
const overlayScript = fileURLToPath(new URL("../../scripts/ci/e2e-overlay.sh", import.meta.url));
const reportScript = fileURLToPath(new URL("../../scripts/ci/e2e-report.sh", import.meta.url));
const recordScript = fileURLToPath(
  new URL("../../scripts/ci/e2e-record-result.sh", import.meta.url),
);
const publishScript = fileURLToPath(
  new URL("../../scripts/ci/e2e-publish-results.sh", import.meta.url),
);

const MAIN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SAME = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FORK = "cccccccccccccccccccccccccccccccccccccccc";
const OTHER = "dddddddddddddddddddddddddddddddddddddddd";
const TOKEN = "super-secret-token";
const RUN_URL = "https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242";

const CURL_STUB = `#!/bin/sh
url=
prev=
body=
out=
for arg in "$@"; do
  if [ "$prev" = "--data-binary" ]; then
    body=$arg
  fi
  if [ "$prev" = "-o" ]; then
    out=$arg
  fi
  prev=$arg
  case "$arg" in
    http*) url=$arg ;;
  esac
done
printf '%s\\n' "$url" >> "$E2E_STUB_DIR/curl-urls"
if [ -n "$body" ]; then
  printf '%s' "$body" > "$E2E_STUB_DIR/request-body"
fi
case " $* " in
  *" %{http_code}"*|*' %{http_code} '*)
    if [ -f "$E2E_STUB_DIR/label-missing" ]; then
      printf '404'
    else
      printf '200'
    fi
    exit 0
    ;;
esac
payload() {
  case "$url" in
    */commits/main) cat "$E2E_STUB_DIR/main.json" ;;
    */pulls\\?*) cat "$E2E_STUB_DIR/pulls.json" ;;
    */commits/*)
      if [ -f "$E2E_STUB_DIR/commit.json" ]; then
        cat "$E2E_STUB_DIR/commit.json"
      else
        return 22
      fi
      ;;
    */check-runs) printf '%s\\n' '{}' ;;
    */labels) printf '%s\\n' '{}' ;;
    *)
      printf 'unexpected url %s\\n' "$url" >&2
      return 97
      ;;
  esac
}
if [ -n "$out" ]; then
  payload > "$out"
else
  payload
fi
exit $?
`;

function git(cwd, args) {
  // Throwaway fixtures must not inherit commit.gpgsign. The SSH signer stalls
  // past the test timeout often enough to fail this file at random.
  const result = spawnSync("git", ["-C", cwd, "-c", "commit.gpgsign=false", ...args], {
    encoding: "utf8",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

async function initReachabilityRepo() {
  const dir = await mkdtemp(join(tmpdir(), "e2e-git-"));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "dev@example.com"]);
  git(dir, ["config", "user.name", "Dev"]);
  await writeFile(join(dir, "readme.txt"), "main\n");
  git(dir, ["add", "readme.txt"]);
  git(dir, ["commit", "-m", "main"]);
  const main = git(dir, ["rev-parse", "HEAD"]);
  git(dir, ["checkout", "-b", "feature"]);
  await writeFile(join(dir, "readme.txt"), "feature\n");
  git(dir, ["add", "readme.txt"]);
  git(dir, ["commit", "-m", "feature"]);
  const same = git(dir, ["rev-parse", "HEAD"]);
  git(dir, ["checkout", "main"]);
  const tree = git(dir, ["rev-parse", "HEAD^{tree}"]);
  const fork = git(dir, ["commit-tree", tree, "-m", "fork-only"]);
  git(dir, ["update-ref", "refs/pull/7/head", fork]);
  return { dir, main, same, fork };
}

function outputValue(text, key) {
  const marker = `${key}<<`;
  const start = text.indexOf(marker);
  if (start === -1) return "";
  const delim = text.slice(start + marker.length, text.indexOf("\n", start));
  const bodyStart = text.indexOf("\n", start) + 1;
  const bodyEnd = text.indexOf(`\n${delim}`, bodyStart);
  return text.slice(bodyStart, bodyEnd);
}

async function runScript(script, args, env) {
  const child = spawnSync("bash", [script, ...args], {
    env,
    encoding: "utf8",
  });
  return {
    status: child.status ?? 1,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
  };
}

async function withStub(extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), "e2e-nightly-"));
  const bin = join(dir, "bin");
  const stub = join(dir, "stub");
  const output = join(dir, "github-output");
  await mkdir(bin);
  await mkdir(stub);
  await writeFile(join(bin, "curl"), CURL_STUB);
  await chmod(join(bin, "curl"), 0o755);
  await writeFile(output, "");
  await writeFile(join(stub, "curl-urls"), "");
  const pulls = extra.pulls ?? [
    {
      number: 80,
      base: { ref: "main" },
      labels: [{ name: "e2e-nightly" }],
      head: {
        sha: SAME,
        repo: { full_name: "Angry-Orc-Games/pivot-foundry", fork: false },
      },
    },
    {
      number: 7,
      base: { ref: "main" },
      labels: [{ name: "e2e-nightly" }],
      head: {
        sha: FORK,
        repo: { full_name: "someone/pivot-foundry", fork: true },
      },
    },
    {
      number: 9,
      base: { ref: "main" },
      labels: [{ name: "docs" }],
      head: {
        sha: OTHER,
        repo: { full_name: "Angry-Orc-Games/pivot-foundry", fork: false },
      },
    },
    {
      number: 11,
      base: { ref: "develop" },
      labels: [{ name: "e2e-nightly" }],
      head: {
        sha: OTHER,
        repo: { full_name: "Angry-Orc-Games/pivot-foundry", fork: false },
      },
    },
  ];
  await writeFile(join(stub, "pulls.json"), JSON.stringify(pulls));
  await writeFile(join(stub, "main.json"), JSON.stringify({ sha: MAIN }));
  if (extra.commit) {
    await writeFile(join(stub, "commit.json"), JSON.stringify(extra.commit));
  }
  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: process.env.HOME,
    LANG: "C",
    GITHUB_OUTPUT: output,
    GITHUB_API_URL: "https://api.github.test",
    GITHUB_TOKEN: TOKEN,
    E2E_STUB_DIR: stub,
    E2E_REPOSITORY: "Angry-Orc-Games/pivot-foundry",
    E2E_EVENT: extra.event ?? "schedule",
    E2E_REF: extra.ref ?? "",
    ...extra.env,
  };
  return { dir, stub, output, env };
}

describe("nightly target list", () => {
  it("keeps main and same-repo labeled heads, and drops forks", async () => {
    const ctx = await withStub();
    const result = await runScript(targetsScript, [], ctx.env);
    const targets = JSON.parse(result.stdout);
    const recorded = outputValue(await readFile(ctx.output, "utf8"), "targets");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(targets).toEqual([
      { sha: MAIN, name: "main" },
      { sha: SAME, name: "pr-80" },
    ]);
    expect(JSON.parse(recorded)).toEqual(targets);
    expect(result.stdout + result.stderr).not.toContain(TOKEN);
    expect(targets.map((target) => target.sha)).not.toContain(FORK);
  });

  it("creates the e2e-nightly label when it is missing and does not assign it", async () => {
    const ctx = await withStub();
    await writeFile(join(ctx.stub, "label-missing"), "");
    const result = await runScript(targetsScript, [], ctx.env);
    const urls = await readFile(join(ctx.stub, "curl-urls"), "utf8");
    const body = await readFile(join(ctx.stub, "request-body"), "utf8");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      { sha: MAIN, name: "main" },
      { sha: SAME, name: "pr-80" },
    ]);
    expect(urls).toContain("/repos/Angry-Orc-Games/pivot-foundry/labels");
    expect(JSON.parse(body).name).toBe("e2e-nightly");
    expect(body).not.toContain("issue");
  });

  it("tests a dispatch SHA only when a branch in this repository contains it", async () => {
    const repo = await initReachabilityRepo();
    const ctx = await withStub({
      event: "workflow_dispatch",
      ref: repo.same,
      env: { E2E_GIT_DIR: repo.dir },
    });
    const feature = await runScript(targetsScript, [], ctx.env);
    const mainResult = await runScript(targetsScript, [], { ...ctx.env, E2E_REF: repo.main });
    const urls = await readFile(join(ctx.stub, "curl-urls"), "utf8");
    await rm(ctx.dir, { recursive: true, force: true });
    await rm(repo.dir, { recursive: true, force: true });

    expect(feature.status).toBe(0);
    expect(JSON.parse(feature.stdout)).toEqual([{ sha: repo.same, name: "dispatch" }]);
    expect(mainResult.status).toBe(0);
    expect(JSON.parse(mainResult.stdout)).toEqual([{ sha: repo.main, name: "dispatch" }]);
    expect(urls).not.toContain("/pulls?");
    expect(feature.stdout + feature.stderr).not.toContain(TOKEN);
  });

  it("refuses a dispatch SHA that exists only as a fork pull-request head", async () => {
    const repo = await initReachabilityRepo();
    const present = spawnSync("git", ["-C", repo.dir, "cat-file", "-e", `${repo.fork}^{commit}`]);
    const ctx = await withStub({
      event: "workflow_dispatch",
      ref: repo.fork,
      env: { E2E_GIT_DIR: repo.dir },
    });
    const result = await runScript(targetsScript, [], ctx.env);
    await rm(ctx.dir, { recursive: true, force: true });
    await rm(repo.dir, { recursive: true, force: true });

    expect(present.status).toBe(0);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not reachable");
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain(TOKEN);
  });

  it("refuses a dispatch ref that is not a commit SHA", async () => {
    const ctx = await withStub({
      event: "workflow_dispatch",
      ref: "release/sheet-v2",
    });
    const result = await runScript(targetsScript, [], ctx.env);
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("40-character");
  });
});

describe("per-target license gate", () => {
  it("skips every Foundry step when the recheck closes", async () => {
    const yaml = await readFile(
      fileURLToPath(new URL("../../.github/workflows/e2e.yml", import.meta.url)),
      "utf8",
    );
    const lines = yaml.slice(yaml.indexOf("  e2e:\n")).split("\n");
    const steps = [];
    let current = null;
    for (const line of lines) {
      const name = line.match(/^ {6}- name: (.+)$/);
      if (name) {
        current = { name: name[1], guard: "" };
        steps.push(current);
        continue;
      }
      if (current && current.guard === "") {
        const cond = line.match(/^ {8}if: (.+)$/);
        if (cond) current.guard = cond[1];
      }
    }
    const start = steps.findIndex((step) => step.name === "Check Foundry secrets");
    const end = steps.findIndex((step) => step.name === "Record E2E result");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    for (const step of steps.slice(start, end)) {
      expect(step.guard, step.name).toContain("steps.recheck.outputs.ok == 'true'");
    }
    expect(steps.find((step) => step.name === "Record E2E result")?.guard).toContain("always()");
    expect(steps.find((step) => step.name === "Run packaged Foundry E2E")?.guard).toContain(
      "steps.creds.outputs.available == 'true'",
    );
    expect(steps.some((step) => step.name === "Install Playwright browser")).toBe(true);
  });
});

describe("trusted overlay", () => {
  it("copies the system under test and leaves the runner scripts in place", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-overlay-"));
    const runner = join(dir, "runner");
    const system = join(dir, "system");
    await mkdir(join(runner, "scripts"), { recursive: true });
    await mkdir(join(runner, "src"), { recursive: true });
    await mkdir(join(system, "scripts"), { recursive: true });
    await mkdir(join(system, "src"), { recursive: true });
    await writeFile(join(runner, "scripts", "foundry-cli.mjs"), "trusted-runner\n");
    await writeFile(join(runner, "package.json"), '{"name":"trusted"}\n');
    await writeFile(join(runner, "vite.config.ts"), "trusted-vite\n");
    await writeFile(join(system, "vite.config.js"), "untrusted-vite-js\n");
    await writeFile(join(runner, "src", "old.txt"), "old\n");
    await writeFile(join(system, "scripts", "foundry-cli.mjs"), "untrusted-runner\n");
    await writeFile(join(system, "package.json"), '{"name":"untrusted"}\n');
    await writeFile(join(system, "vite.config.ts"), "untrusted-vite\n");
    await writeFile(join(system, "src", "sheet.txt"), "from-pr\n");

    const result = await runScript(overlayScript, [runner, system], process.env);

    expect(result.status).toBe(0);
    expect(await readFile(join(runner, "scripts", "foundry-cli.mjs"), "utf8")).toBe(
      "trusted-runner\n",
    );
    expect(await readFile(join(runner, "package.json"), "utf8")).toBe('{"name":"trusted"}\n');
    expect(await readFile(join(runner, "vite.config.ts"), "utf8")).toBe("trusted-vite\n");
    await expect(readFile(join(runner, "vite.config.js"), "utf8")).rejects.toThrow();
    expect(await readFile(join(runner, "src", "sheet.txt"), "utf8")).toBe("from-pr\n");
    await expect(readFile(join(runner, "src", "old.txt"), "utf8")).rejects.toThrow();
    await rm(dir, { recursive: true, force: true });
  });
});

describe("nightly check run", () => {
  it("posts Foundry E2E (nightly) on the exact SHA", async () => {
    const ctx = await withStub();
    const result = await runScript(reportScript, ["success"], {
      ...ctx.env,
      E2E_SHA: SAME,
      E2E_RUN_ID: "4242",
      E2E_SUMMARY: `Foundry started for E2E commit ${SAME}.`,
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    const urls = await readFile(join(ctx.stub, "curl-urls"), "utf8");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body).toEqual({
      name: "Foundry E2E (nightly)",
      head_sha: SAME,
      status: "completed",
      conclusion: "success",
      details_url: "https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242",
      output: {
        title: "Foundry E2E (nightly)",
        summary: `Foundry started for E2E commit ${SAME}.\nhttps://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242`,
      },
    });
    expect(urls).toContain("/repos/Angry-Orc-Games/pivot-foundry/check-runs");
    expect(result.stdout + result.stderr).not.toContain(TOKEN);
  });
});

const PUBLISH_CURL = `#!/bin/sh
url=
prev=
body=
out=
for arg in "$@"; do
  if [ "$prev" = "--data-binary" ]; then
    body=$arg
  fi
  if [ "$prev" = "-o" ]; then
    out=$arg
  fi
  prev=$arg
  case "$arg" in
    http*) url=$arg ;;
  esac
done
printf '%s\\n' "$url" >> "$E2E_STUB_DIR/curl-urls"
if [ -n "$body" ]; then
  printf '%s' "$body" > "$E2E_STUB_DIR/request-body"
fi
case "$url" in
  */artifacts*)
    cat "$E2E_STUB_DIR/artifacts.json"
    ;;
  */download)
    cat "$E2E_STUB_DIR/artifact.zip" > "$out"
    ;;
  */check-runs)
    if [ -n "$out" ]; then
      printf '%s\\n' '{}' > "$out"
    fi
    ;;
  *)
    printf 'unexpected url %s\\n' "$url" >&2
    exit 97
    ;;
esac
`;

async function publishFixture({ doc, artifacts, matrix = "failure" } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "e2e-publish-"));
  const bin = join(dir, "bin");
  const stub = join(dir, "stub");
  await mkdir(bin);
  await mkdir(stub);
  await writeFile(join(bin, "curl"), PUBLISH_CURL);
  await chmod(join(bin, "curl"), 0o755);
  await writeFile(join(stub, "curl-urls"), "");
  const listed =
    artifacts ??
    (doc
      ? [
          {
            name: "e2e-result-pr-80",
            expired: false,
            archive_download_url: "https://artifact.test/download",
            workflow_run: { id: 4242 },
          },
        ]
      : []);
  await writeFile(
    join(stub, "artifacts.json"),
    JSON.stringify({ total_count: listed.length, artifacts: listed }),
  );
  if (doc) {
    const jsonPath = join(dir, "result.json");
    await writeFile(jsonPath, JSON.stringify(doc));
    execFileSync("python3", [
      "-c",
      "import sys, zipfile\n" +
        "with zipfile.ZipFile(sys.argv[1], 'w') as bundle:\n" +
        "    bundle.write(sys.argv[2], 'result.json')\n",
      join(stub, "artifact.zip"),
      jsonPath,
    ]);
  } else {
    await writeFile(join(stub, "artifact.zip"), "");
  }
  const result = await runScript(publishScript, [], {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: process.env.HOME,
    LANG: "C",
    GITHUB_API_URL: "https://api.github.test",
    GITHUB_TOKEN: TOKEN,
    E2E_STUB_DIR: stub,
    E2E_REPOSITORY: "Angry-Orc-Games/pivot-foundry",
    E2E_TARGETS: JSON.stringify([{ sha: SAME, name: "pr-80" }]),
    E2E_RUN_ID: "4242",
    E2E_MATRIX_RESULT: matrix,
  });
  const urls = await readFile(join(stub, "curl-urls"), "utf8");
  return { dir, stub, result, urls };
}

describe("nightly failure results", () => {
  it("records a closed gate as a failure", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-record-"));
    const dest = join(dir, "main.json");
    const result = await runScript(recordScript, [dest], {
      ...process.env,
      E2E_SHA: MAIN,
      E2E_RUN_ID: "4242",
      E2E_OK: "false",
      E2E_JOB_STATUS: "failure",
    });
    const body = JSON.parse(await readFile(dest, "utf8"));
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body).toEqual({
      sha: MAIN,
      run_id: "4242",
      conclusion: "failure",
      summary: "License gate closed. Foundry was not started.",
      started: false,
    });
  });

  it("records an unsigned EULA as a setup failure even after Foundry started", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-record-"));
    const dest = join(dir, "main.json");
    const log = join(dir, "foundry-e2e.log");
    const setup =
      "Foundry setup failed. The End User License Agreement is on screen. Set FOUNDRY_E2E_ACCEPT_EULA=1 to sign it for this run. Tests were not run.";
    await writeFile(
      log,
      `Foundry started for E2E commit ${SAME}.\nServer started and listening\n${setup}\n`,
    );
    const result = await runScript(recordScript, [dest], {
      ...process.env,
      E2E_SHA: SAME,
      E2E_RUN_ID: "4242",
      E2E_OK: "true",
      E2E_AVAILABLE: "true",
      E2E_JOB_STATUS: "failure",
      E2E_LOG: log,
    });
    const body = JSON.parse(await readFile(dest, "utf8"));
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body.conclusion).toBe("failure");
    expect(body.summary).toBe(setup);
    expect(body.summary).not.toContain("failed after Foundry started");
    expect(body.summary).not.toContain("did not start");
  });

  it("treats Server started and listening as Foundry having started", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-record-"));
    const dest = join(dir, "main.json");
    const log = join(dir, "foundry-e2e.log");
    await writeFile(log, "Server started and listening on port 30000\n");
    const result = await runScript(recordScript, [dest], {
      ...process.env,
      E2E_SHA: SAME,
      E2E_RUN_ID: "4242",
      E2E_OK: "true",
      E2E_AVAILABLE: "true",
      E2E_JOB_STATUS: "failure",
      E2E_LOG: log,
    });
    const body = JSON.parse(await readFile(dest, "utf8"));
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body.conclusion).toBe("failure");
    expect(body.summary).toContain("Server started and listening");
    expect(body.summary).toContain(`Foundry started for E2E commit ${SAME}.`);
    expect(body.summary).not.toContain("did not start");
    expect(body.summary).not.toContain("not reported as started");
  });

  it("posts a failure check when the run was cancelled before a result existed", async () => {
    const ctx = await publishFixture({ artifacts: [], matrix: "cancelled" });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(ctx.result.status).toBe(1);
    expect(body.conclusion).toBe("failure");
    expect(body.head_sha).toBe(SAME);
    expect(body.details_url).toBe(
      "https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242",
    );
    expect(body.output.summary).toContain("cancelled or timed out");
    expect(body.output.summary).toContain(
      "https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242",
    );
    expect(body.output.summary).not.toContain("Skipped");
    expect(ctx.urls).toContain("/actions/runs/4242/artifacts");
  });

  it("posts the recorded conclusion when the artifact matches this run and sha", async () => {
    const ctx = await publishFixture({
      doc: {
        sha: SAME,
        run_id: "4242",
        conclusion: "failure",
        summary: "License gate closed. Foundry was not started.",
        started: false,
      },
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(ctx.result.status).toBe(1);
    expect(body).toMatchObject({
      name: "Foundry E2E (nightly)",
      head_sha: SAME,
      conclusion: "failure",
      details_url: "https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242",
    });
    expect(body.output.summary).toContain("License gate closed. Foundry was not started.");
    expect(body.output.summary).toContain(
      "https://github.com/Angry-Orc-Games/pivot-foundry/actions/runs/4242",
    );
  });

  it("posts the listening signal from a recorded result", async () => {
    const summary = `Server started and listening. Foundry started for E2E commit ${SAME}. The run failed after Foundry started.`;
    const ctx = await publishFixture({
      doc: { sha: SAME, run_id: "4242", conclusion: "failure", summary, started: true },
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(ctx.result.status).toBe(1);
    expect(body.output.summary).toBe(`${summary}\n${RUN_URL}`);
    expect(body.output.summary).not.toContain("not reported as started");
  });

  it("posts a validation failure when the result download is not a zip", async () => {
    const ctx = await publishFixture({
      artifacts: [
        {
          name: "e2e-result-pr-80",
          expired: false,
          archive_download_url: "https://artifact.test/download",
          workflow_run: { id: 4242 },
        },
      ],
    });
    const bodyText = await readFile(join(ctx.stub, "request-body"), "utf8").catch(() => "");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(ctx.result.status).toBe(1);
    expect(bodyText).not.toBe("");
    const body = JSON.parse(bodyText);
    expect(body.conclusion).toBe("failure");
    expect(body.output.summary).toContain("failed validation");
    expect(ctx.result.stderr).not.toContain("BadZipFile");
  });

  it.each([
    ["sha", { sha: MAIN, run_id: "4242", conclusion: "success", summary: "forged" }],
    ["run_id", { sha: SAME, run_id: "9999", conclusion: "success", summary: "forged" }],
  ])("fails closed when the result %s does not match this run", async (_label, doc) => {
    const ctx = await publishFixture({ doc });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(ctx.result.status).toBe(1);
    expect(body.conclusion).toBe("failure");
    expect(body.head_sha).toBe(SAME);
    expect(body.output.summary).toContain("failed validation");
    expect(body.output.summary).not.toContain("forged");
  });

  it("appends a validation error to a readable summary instead of replacing it", async () => {
    const ctx = await publishFixture({
      doc: {
        sha: SAME,
        run_id: "4242",
        conclusion: "success",
        summary: "forged",
        extra: true,
      },
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(ctx.result.status).toBe(1);
    expect(body.conclusion).toBe("failure");
    expect(body.output.summary.startsWith("forged")).toBe(true);
    expect(body.output.summary).toContain("Foundry E2E result failed validation for this run.");
    expect(body.output.summary).not.toContain("not reported as started");
  });
});

const SETUP_FAILURE =
  "Foundry setup failed. The End User License Agreement is on screen. Set FOUNDRY_E2E_ACCEPT_EULA=1 to sign it for this run. Tests were not run.";

async function recordPublishedResult(logText) {
  const dir = await mkdtemp(join(tmpdir(), "e2e-record-"));
  const dest = join(dir, "pr-114.json");
  const log = join(dir, "foundry-e2e.log");
  await writeFile(log, logText);
  const recorded = await runScript(recordScript, [dest], {
    ...process.env,
    E2E_SHA: SAME,
    E2E_RUN_ID: "4242",
    E2E_OK: "true",
    E2E_AVAILABLE: "true",
    E2E_JOB_STATUS: "failure",
    E2E_LOG: log,
  });
  const doc = JSON.parse(await readFile(dest, "utf8"));
  const ctx = await publishFixture({ doc });
  const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
  await rm(dir, { recursive: true, force: true });
  await rm(ctx.dir, { recursive: true, force: true });
  return { recorded, doc, body };
}

describe("published result from the real writer", () => {
  it("publishes a setup failure after listening as started with the EULA summary intact", async () => {
    const { recorded, doc, body } = await recordPublishedResult(
      [
        "Server started and listening",
        `Foundry started for E2E commit ${SAME}.`,
        SETUP_FAILURE,
        "FOUNDRY_LICENSE_KEY=ABCD-EFGH-IJKL-MNOP-QRST-UVWX",
      ].join("\n"),
    );

    expect(recorded.status).toBe(0);
    expect(doc.started).toBe(true);
    expect(doc.summary).toBe(SETUP_FAILURE);
    expect(JSON.stringify(doc)).not.toContain("ABCD-EFGH");
    expect(body.output.summary).toBe(`${SETUP_FAILURE}\n${RUN_URL}`);
    expect(body.output.summary).not.toContain("failed validation");
    expect(body.output.text).toBe("started=true");
    expect(body.output.summary + body.output.text).not.toContain("ABCD-EFGH");
  });

  it("publishes a test failure after listening as started", async () => {
    const { doc, body } = await recordPublishedResult(
      ["Server started and listening", "Error: expect(locator).toBeVisible() failed"].join("\n"),
    );

    expect(doc.started).toBe(true);
    expect(doc.summary).toContain("The run failed after Foundry started.");
    expect(doc.summary).not.toContain("End User License Agreement");
    expect(body.output.summary).toBe(`${doc.summary}\n${RUN_URL}`);
    expect(body.output.text).toBe("started=true");
  });

  it("publishes a readiness timeout before listening as not started", async () => {
    const timeout = "Foundry did not log Server started and listening within 120s";
    const { doc, body } = await recordPublishedResult(`${timeout}\n`);

    expect(doc.started).toBe(false);
    expect(doc.summary).toBe(timeout);
    expect(body.output.summary).toBe(`${timeout}\n${RUN_URL}`);
    expect(body.output.summary).not.toContain("failed validation");
    expect(body.output.text).toBe("started=false");
  });
});

function listenOn(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port, host }, () => resolve(server.address().port));
  });
}

function collectRequestBody(req) {
  const chunks = [];
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    };
    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", finish);
    req.on("aborted", finish);
    req.on("error", finish);
  });
}

function assertPostedCheckRuns({ bodies, targets, stdout = "", stderr = "", secret }) {
  if (bodies.length !== targets) {
    const detail = stderr ? `\n${stderr}` : "";
    throw new Error(`expected ${targets} check-run body, received ${bodies.length}${detail}`);
  }
  const parsed = bodies.map((body) => JSON.parse(body));
  const visible = `${stdout}${stderr}${bodies.join("")}`;
  if (visible.includes(secret)) {
    throw new Error("Foundry E2E publish output contains the token");
  }
  return parsed;
}

function postCheckRun(port, payload, split) {
  const message = Buffer.from(
    `POST /repos/x/check-runs HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`,
  );
  return new Promise((resolve, reject) => {
    const socket = connectTcp(port, "127.0.0.1", () => {
      if (!split) {
        socket.end(message);
        return;
      }
      socket.write(message.subarray(0, 40));
      globalThis.setTimeout(() => {
        socket.write(message.subarray(40, 90));
        globalThis.setTimeout(() => socket.end(message.subarray(90)), 15);
      }, 15);
    });
    socket.on("data", () => {});
    socket.on("end", resolve);
    socket.on("error", reject);
  });
}

async function captureCheckRunPosts(payloads, { split = false } = {}) {
  const posted = [];
  const server = createHttpServer((req, res) => {
    res.on("error", () => {});
    collectRequestBody(req).then((raw) => {
      if ((req.url ?? "").endsWith("/check-runs")) {
        posted.push(raw.toString("utf8"));
      }
      if (!res.writableEnded) {
        res.writeHead(201, { "content-type": "application/json" });
        res.end("{}");
      }
    });
  });
  const port = await listenOn(server, 0, "127.0.0.1");
  let captured;
  try {
    for (const [index, payload] of payloads.entries()) {
      await postCheckRun(port, payload, split && index === 0);
    }
    await new Promise((resolve) => globalThis.setImmediate(resolve));
    captured = posted.slice();
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
  return captured;
}

describe("artifact download redirect", () => {
  it("joins a split check-run body into one recorded post", async () => {
    const payload = JSON.stringify({ ok: true, n: "x".repeat(50) });
    const bodies = await captureCheckRunPosts([payload], { split: true });
    const [body] = assertPostedCheckRuns({ bodies, targets: 1, secret: TOKEN });
    expect(bodies).toEqual([payload]);
    expect(body).toEqual({ ok: true, n: "x".repeat(50) });
  });

  it("fails when an extra empty check-run post is recorded", async () => {
    const payload = JSON.stringify({ ok: true });
    const bodies = await captureCheckRunPosts([payload, ""]);
    expect(bodies).toEqual([payload, ""]);
    expect(() => assertPostedCheckRuns({ bodies, targets: 1, secret: TOKEN })).toThrow(
      "expected 1 check-run body, received 2",
    );
  });

  it("fails when the only check-run body is malformed", async () => {
    const bodies = await captureCheckRunPosts(['{"ok":']);
    expect(bodies).toEqual(['{"ok":']);
    expect(() => assertPostedCheckRuns({ bodies, targets: 1, secret: TOKEN })).toThrow(SyntaxError);
    expect(() => assertPostedCheckRuns({ bodies, targets: 1, secret: TOKEN })).toThrow(
      "Unexpected end of JSON input",
    );
  });

  it("fails when a recorded check-run body contains the token", async () => {
    const payload = JSON.stringify({ output: { summary: TOKEN } });
    const bodies = await captureCheckRunPosts([payload]);
    expect(bodies).toEqual([payload]);
    expect(() =>
      assertPostedCheckRuns({ bodies, targets: 1, stdout: "", stderr: "", secret: TOKEN }),
    ).toThrow("Foundry E2E publish output contains the token");
  });

  it("follows a 302 to another host and posts the EULA summary as started", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-redirect-"));
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        join(dir, "ca.key"),
        "-out",
        join(dir, "ca.crt"),
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=e2e-test-ca",
      ],
      { stdio: "ignore" },
    );
    execFileSync(
      "openssl",
      [
        "req",
        "-newkey",
        "rsa:2048",
        "-keyout",
        join(dir, "srv.key"),
        "-out",
        join(dir, "srv.csr"),
        "-nodes",
        "-subj",
        "/CN=api.localtest.me",
      ],
      { stdio: "ignore" },
    );
    await writeFile(
      join(dir, "ext.cnf"),
      "subjectAltName=DNS:api.localtest.me,DNS:blob.localtest.me\n",
    );
    execFileSync(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        join(dir, "srv.csr"),
        "-CA",
        join(dir, "ca.crt"),
        "-CAkey",
        join(dir, "ca.key"),
        "-CAcreateserial",
        "-out",
        join(dir, "srv.crt"),
        "-days",
        "1",
        "-extfile",
        join(dir, "ext.cnf"),
      ],
      { stdio: "ignore" },
    );
    const doc = {
      sha: SAME,
      run_id: "4242",
      conclusion: "failure",
      summary: SETUP_FAILURE,
      started: true,
    };
    const jsonPath = join(dir, "pr-114.json");
    await writeFile(jsonPath, JSON.stringify(doc));
    execFileSync("python3", [
      "-c",
      "import sys, zipfile\n" +
        "with zipfile.ZipFile(sys.argv[1], 'w') as bundle:\n" +
        "    bundle.write(sys.argv[2], 'pr-114.json')\n",
      join(dir, "artifact.zip"),
      jsonPath,
    ]);
    const zip = await readFile(join(dir, "artifact.zip"));
    const tls = {
      key: await readFile(join(dir, "srv.key")),
      cert: await readFile(join(dir, "srv.crt")),
    };
    const blobHits = [];
    const downloadAuth = [];
    const posted = [];
    let apiPort = 0;
    const blobHandler = (req, res) => {
      blobHits.push(req.headers.authorization);
      res.on("error", () => {});
      collectRequestBody(req).then(() => {
        if (res.writableEnded) return;
        res.writeHead(200, { "content-type": "application/zip" });
        res.end(zip);
      });
    };
    const blob = createHttpsServer(tls, blobHandler);
    const blobPort = await listenOn(blob, 0, "127.0.0.1");
    const apiHandler = (req, res) => {
      res.on("error", () => {});
      collectRequestBody(req).then((raw) => {
        if (res.writableEnded) return;
        const path = new URL(req.url ?? "/", "https://api.localtest.me").pathname;
        const text = raw.toString("utf8");
        if (path.endsWith("/artifacts")) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              total_count: 1,
              artifacts: [
                {
                  name: "e2e-result-pr-114",
                  expired: false,
                  archive_download_url: `https://api.localtest.me:${apiPort}/download`,
                  workflow_run: { id: 4242 },
                },
              ],
            }),
          );
          return;
        }
        if (path === "/download") {
          downloadAuth.push(req.headers.authorization);
          res.writeHead(302, {
            location: `https://blob.localtest.me:${blobPort}/artifact.zip`,
          });
          res.end();
          return;
        }
        if (path.endsWith("/check-runs")) {
          posted.push(text);
          res.writeHead(201, { "content-type": "application/json" });
          res.end("{}");
          return;
        }
        res.writeHead(404);
        res.end();
      });
    };
    const api = createHttpsServer(tls, apiHandler);
    apiPort = await listenOn(api, 0, "127.0.0.1");
    const curlReal = execFileSync("bash", ["-c", "command -v curl"], { encoding: "utf8" }).trim();
    const bin = join(dir, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "curl"),
      `#!/bin/sh\nexec ${curlReal} --connect-to api.localtest.me::127.0.0.1: --connect-to blob.localtest.me::127.0.0.1: "$@"\n`,
    );
    await chmod(join(bin, "curl"), 0o755);
    const servers = [blob, api];
    let result;
    let captured;
    try {
      result = await new Promise((resolve) => {
        const child = spawn("bash", [publishScript], {
          env: {
            PATH: `${bin}:${process.env.PATH}`,
            HOME: process.env.HOME,
            LANG: "C",
            SSL_CERT_FILE: join(dir, "ca.crt"),
            GITHUB_API_URL: `https://api.localtest.me:${apiPort}`,
            GITHUB_TOKEN: TOKEN,
            E2E_REPOSITORY: "Angry-Orc-Games/pivot-foundry",
            E2E_TARGETS: JSON.stringify([{ sha: SAME, name: "pr-114" }]),
            E2E_RUN_ID: "4242",
            E2E_MATRIX_RESULT: "failure",
          },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.on("close", (status) => resolve({ status: status ?? 1, stdout, stderr }));
      });
      await new Promise((resolve) => globalThis.setImmediate(resolve));
      captured = posted.slice();
    } finally {
      for (const server of servers) {
        server.closeAllConnections?.();
        server.close();
      }
      await rm(dir, { recursive: true, force: true });
    }

    const [body] = assertPostedCheckRuns({
      bodies: captured,
      targets: 1,
      stdout: result.stdout,
      stderr: result.stderr,
      secret: TOKEN,
    });
    expect(blobHits.length).toBeGreaterThan(0);
    expect(blobHits.every((header) => header === undefined)).toBe(true);
    expect(downloadAuth).toContain(`Bearer ${TOKEN}`);
    expect(body.output.summary).toBe(`${SETUP_FAILURE}\n${RUN_URL}`);
    expect(body.output.text).toBe("started=true");
  }, 15000);
});
