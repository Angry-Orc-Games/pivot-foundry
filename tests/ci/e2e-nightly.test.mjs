import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
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
      output: {
        title: "Foundry E2E (nightly)",
        summary: `Foundry started for E2E commit ${SAME}.`,
      },
    });
    expect(urls).toContain("/repos/Angry-Orc-Games/pivot-foundry/check-runs");
    expect(result.stdout + result.stderr).not.toContain(TOKEN);
  });
});

describe("nightly failure results", () => {
  it("records a closed gate as a failure", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-record-"));
    const dest = join(dir, "main.json");
    const result = await runScript(recordScript, [dest], {
      ...process.env,
      E2E_SHA: MAIN,
      E2E_OK: "false",
      E2E_JOB_STATUS: "failure",
    });
    const body = JSON.parse(await readFile(dest, "utf8"));
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body).toEqual({
      sha: MAIN,
      conclusion: "failure",
      summary: "License gate closed. Foundry was not started.",
    });
  });

  it("posts a failure check when the run was cancelled before a result existed", async () => {
    const ctx = await withStub();
    const result = await runScript(publishScript, [], {
      ...ctx.env,
      E2E_TARGETS: JSON.stringify([{ sha: SAME, name: "pr-80" }]),
      E2E_RESULTS_DIR: join(ctx.dir, "missing-results"),
      E2E_MATRIX_RESULT: "cancelled",
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(body.conclusion).toBe("failure");
    expect(body.head_sha).toBe(SAME);
    expect(body.output.summary).toContain("cancelled or timed out");
    expect(body.output.summary).not.toContain("Skipped");
  });

  it("posts the recorded conclusion for a finished SHA", async () => {
    const ctx = await withStub();
    await writeFile(
      join(ctx.dir, "pr-80.json"),
      JSON.stringify({
        sha: SAME,
        conclusion: "failure",
        summary: "License gate closed. Foundry was not started.",
      }),
    );
    const result = await runScript(publishScript, [], {
      ...ctx.env,
      E2E_TARGETS: JSON.stringify([{ sha: SAME, name: "pr-80" }]),
      E2E_RESULTS_DIR: ctx.dir,
      E2E_MATRIX_RESULT: "failure",
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(body).toMatchObject({
      name: "Foundry E2E (nightly)",
      head_sha: SAME,
      conclusion: "failure",
      output: { summary: "License gate closed. Foundry was not started." },
    });
  });
});
