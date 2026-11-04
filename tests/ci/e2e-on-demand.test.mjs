import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { assertLaunchWindow } from "../../scripts/foundry-e2e.mjs";

const targetsScript = fileURLToPath(new URL("../../scripts/ci/e2e-targets.sh", import.meta.url));
const gateScript = fileURLToPath(new URL("../../scripts/ci/e2e-gate.sh", import.meta.url));
const reportScript = fileURLToPath(new URL("../../scripts/ci/e2e-report.sh", import.meta.url));
const recordScript = fileURLToPath(
  new URL("../../scripts/ci/e2e-record-result.sh", import.meta.url),
);
const publishScript = fileURLToPath(
  new URL("../../scripts/ci/e2e-publish-results.sh", import.meta.url),
);
const workflowPath = fileURLToPath(new URL("../../.github/workflows/e2e.yml", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const SAME = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FORK = "cccccccccccccccccccccccccccccccccccccccc";
const TOKEN = "super-secret-token";
const REPO = "Angry-Orc-Games/pivot-foundry";
const ON_DEMAND = "Foundry E2E (on-demand)";
const NIGHTLY = "Foundry E2E (nightly)";

const JSON_CURL = `#!/bin/sh
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
payload() {
  case "$url" in
    */pulls/*)
      cat "$E2E_STUB_DIR/pull.json"
      ;;
    */check-runs)
      printf '%s\\n' '{}'
      ;;
    */artifacts*)
      printf '%s\\n' '{"total_count":0,"artifacts":[]}'
      ;;
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

const DATE_STUB = `#!/bin/sh
if [ "$E2E_STUB_DATE_CODE" != 0 ]; then
  exit "$E2E_STUB_DATE_CODE"
fi
printf '%s\\n' "$E2E_STUB_HOUR"
`;

const STATUS_CURL = `#!/bin/sh
url=
for arg in "$@"; do
  case "$arg" in
    http*) url=$arg ;;
  esac
done
printf '%s\\n' "$url" >> "$E2E_STUB_DIR/curl-urls"
case "$url" in
  *foundry.angryorcgames.com*)
    cat "$E2E_STUB_DIR/foundry.body"
    ;;
  *build.angryorcgames.com*)
    cat "$E2E_STUB_DIR/build.body"
    ;;
  *)
    printf 'unexpected url %s\\n' "$url" >&2
    exit 97
    ;;
esac
`;

function outputValue(text, key) {
  const line = text.split("\n").find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : "";
}

async function runScript(script, args, env) {
  const child = spawnSync("bash", [script, ...args], { env, encoding: "utf8" });
  return {
    status: child.status ?? 1,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
  };
}

async function withJsonStub() {
  const dir = await mkdtemp(join(tmpdir(), "e2e-on-demand-"));
  const bin = join(dir, "bin");
  const stub = join(dir, "stub");
  const output = join(dir, "github-output");
  await mkdir(bin);
  await mkdir(stub);
  await writeFile(join(bin, "curl"), JSON_CURL);
  await chmod(join(bin, "curl"), 0o755);
  await writeFile(output, "");
  await writeFile(join(stub, "curl-urls"), "");
  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: process.env.HOME,
    LANG: "C",
    GITHUB_OUTPUT: output,
    GITHUB_API_URL: "https://api.github.test",
    GITHUB_TOKEN: TOKEN,
    E2E_STUB_DIR: stub,
    E2E_REPOSITORY: REPO,
    E2E_EVENT: "workflow_dispatch",
  };
  return { dir, stub, output, env };
}

function pull(overrides) {
  return {
    number: 78,
    state: "open",
    head: {
      sha: SAME,
      repo: { full_name: REPO, fork: false },
    },
    ...overrides,
  };
}

describe("on-demand pull request target", () => {
  it("resolves an open same-repo pull request to that head SHA", async () => {
    const ctx = await withJsonStub();
    await writeFile(join(ctx.stub, "pull.json"), JSON.stringify(pull()));
    const result = await runScript(targetsScript, [], { ...ctx.env, E2E_PR: "78" });
    const urls = await readFile(join(ctx.stub, "curl-urls"), "utf8");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ sha: SAME, name: "pr-78" }]);
    expect(urls).toContain(`/repos/${REPO}/pulls/78`);
    expect(urls).not.toContain("/pulls?");
    expect(result.stdout + result.stderr).not.toContain(TOKEN);
  });

  it("refuses a fork head even when the fork flag is omitted", async () => {
    const ctx = await withJsonStub();
    await writeFile(
      join(ctx.stub, "pull.json"),
      JSON.stringify(
        pull({
          head: { sha: FORK, repo: { full_name: "someone/pivot-foundry" } },
        }),
      ),
    );
    const result = await runScript(targetsScript, [], { ...ctx.env, E2E_PR: "78" });
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("someone/pivot-foundry");
    expect(result.stderr).toContain(REPO);
    expect(result.stderr).not.toContain(FORK);
    expect(result.stderr).not.toContain(TOKEN);
  });

  it("refuses a closed pull request from this repository", async () => {
    const ctx = await withJsonStub();
    await writeFile(join(ctx.stub, "pull.json"), JSON.stringify(pull({ state: "closed" })));
    const result = await runScript(targetsScript, [], { ...ctx.env, E2E_PR: "78" });
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("closed");
    expect(result.stderr).not.toContain(SAME);
    expect(result.stderr).not.toContain(TOKEN);
  });
});

describe("quiet-hours bypass", () => {
  async function runGate(mode, options = {}) {
    const dir = await mkdtemp(join(tmpdir(), "e2e-dispatch-gate-"));
    const bin = join(dir, "bin");
    const stub = join(dir, "stub");
    const output = join(dir, "github-output");
    await mkdir(bin);
    await mkdir(stub);
    await writeFile(join(bin, "date"), DATE_STUB);
    await writeFile(join(bin, "curl"), STATUS_CURL);
    await chmod(join(bin, "date"), 0o755);
    await chmod(join(bin, "curl"), 0o755);
    await writeFile(output, "");
    await writeFile(join(stub, "curl-urls"), "");
    await writeFile(join(stub, "foundry.body"), options.foundryBody ?? '{"users":0}\n');
    await writeFile(join(stub, "build.body"), options.buildBody ?? '{"users":0}\n');
    const child = spawnSync("bash", [gateScript, mode], {
      encoding: "utf8",
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: process.env.HOME,
        LANG: "C",
        GITHUB_OUTPUT: output,
        E2E_STUB_DIR: stub,
        E2E_STUB_HOUR: options.hour ?? "2300",
        E2E_STUB_DATE_CODE: "0",
        ...options.env,
      },
    });
    const githubOutput = await readFile(output, "utf8");
    const curls = await readFile(join(stub, "curl-urls"), "utf8");
    await rm(dir, { recursive: true, force: true });
    return {
      status: child.status ?? 1,
      stdout: child.stdout ?? "",
      stderr: child.stderr ?? "",
      ok: outputValue(githubOutput, "ok"),
      skipped: outputValue(githubOutput, "skipped"),
      skipReason: outputValue(githubOutput, "skip_reason"),
      curls: curls.split("\n").filter(Boolean),
    };
  }

  it("keeps the quiet-hours window for the nightly license gate", async () => {
    const result = await runGate("license", { hour: "2300" });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.skipped).toBe("");
    expect(result.curls).toEqual([]);
    expect(result.stdout).toContain("outside 02:00-05:30");
  });

  it("bypasses the quiet-hours window only for dispatch when nobody is signed in", async () => {
    const result = await runGate("license", {
      hour: "2300",
      env: { E2E_GATE_MODE: "dispatch" },
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("true");
    expect(result.skipped).toBe("");
    expect(result.curls).toEqual([
      "https://foundry.angryorcgames.com/api/status",
      "https://build.angryorcgames.com/api/status",
    ]);
  });

  it("skips a dispatch when somebody is signed in and does not report success", async () => {
    const result = await runGate("license", {
      hour: "2300",
      env: { E2E_GATE_MODE: "dispatch" },
      foundryBody: '{"users":1}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.skipped).toBe("true");
    expect(result.stdout).toContain("somebody is signed in");
    expect(result.stdout).not.toContain("success");
    expect(`${result.ok} ${result.skipped}`).not.toContain("ok=true");
  });

  it("lets a dispatch signed-in skip finish without an error annotation", async () => {
    const result = await runGate("license", {
      hour: "2300",
      env: { E2E_GATE_MODE: "dispatch", E2E_GATE_SOFT_SKIP: "true" },
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.skipped).toBe("true");
    expect(result.skipReason).toContain("build.angryorcgames.com");
    expect(result.skipReason).not.toContain("foundry.angryorcgames.com");
    expect(result.stdout).toContain("build.angryorcgames.com");
    expect(result.stdout).not.toContain("::error::");
    expect(result.stderr).not.toContain("::error::");
  });

  it("names both hosts when a dispatch skip finds both busy", async () => {
    const result = await runGate("license", {
      hour: "1200",
      env: { E2E_GATE_MODE: "dispatch", E2E_GATE_SOFT_SKIP: "true" },
      foundryBody: '{"users":2}\n',
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(0);
    expect(result.skipReason).toContain("foundry.angryorcgames.com and build.angryorcgames.com");
    expect(result.stdout).not.toContain("::error::");
  });

  it("still tells a required release gate to re-run inside the window", async () => {
    const result = await runGate("require", { hour: "2300" });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.skipped).toBe("");
    expect(result.stdout).toContain("Re-run inside the 02:00-05:30 ET window");
    expect(result.curls).toEqual([]);
  });
});

describe("on-demand check name", () => {
  it("posts Foundry E2E (on-demand) and leaves the nightly name as the default", async () => {
    const ctx = await withJsonStub();
    const onDemand = await runScript(reportScript, ["success"], {
      ...ctx.env,
      E2E_SHA: SAME,
      E2E_RUN_ID: "4242",
      E2E_SUMMARY: `Foundry started for E2E commit ${SAME}.`,
      E2E_CHECK_NAME: ON_DEMAND,
    });
    const onDemandBody = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    const nightly = await runScript(reportScript, ["success"], {
      ...ctx.env,
      E2E_SHA: SAME,
      E2E_RUN_ID: "4242",
      E2E_SUMMARY: `Foundry started for E2E commit ${SAME}.`,
    });
    const nightlyBody = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(onDemand.status).toBe(0);
    expect(onDemandBody.name).toBe(ON_DEMAND);
    expect(onDemandBody.output.title).toBe(ON_DEMAND);
    expect(onDemandBody.head_sha).toBe(SAME);
    expect(onDemandBody.conclusion).toBe("success");
    expect(onDemandBody.name).not.toBe(NIGHTLY);
    expect(nightly.status).toBe(0);
    expect(nightlyBody.name).toBe(NIGHTLY);
  });

  it("posts a signed-in skip as neutral, never success", async () => {
    const ctx = await withJsonStub();
    const result = await runScript(publishScript, [], {
      ...ctx.env,
      E2E_TARGETS: JSON.stringify([{ sha: SAME, name: "pr-78" }]),
      E2E_RUN_ID: "4242",
      E2E_MATRIX_RESULT: "skipped",
      E2E_SKIPPED: "true",
      E2E_GATE_OK: "false",
      E2E_CHECK_NAME: ON_DEMAND,
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body.name).toBe(ON_DEMAND);
    expect(body.head_sha).toBe(SAME);
    expect(body.conclusion).toBe("neutral");
    expect(body.conclusion).not.toBe("success");
    expect(body.output.summary).toContain("Skipped");
    expect(body.output.summary).toContain("signed in");
  });

  it("names the signed-in host on the neutral on-demand check", async () => {
    const ctx = await withJsonStub();
    const reason = "somebody is signed in on build.angryorcgames.com (shared Foundry license)";
    const result = await runScript(publishScript, [], {
      ...ctx.env,
      E2E_TARGETS: JSON.stringify([{ sha: SAME, name: "pr-78" }]),
      E2E_RUN_ID: "4242",
      E2E_MATRIX_RESULT: "skipped",
      E2E_SKIPPED: "true",
      E2E_GATE_OK: "false",
      E2E_SKIP_REASON: reason,
      E2E_CHECK_NAME: ON_DEMAND,
    });
    const body = JSON.parse(await readFile(join(ctx.stub, "request-body"), "utf8"));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body.name).toBe(ON_DEMAND);
    expect(body.head_sha).toBe(SAME);
    expect(body.conclusion).toBe("neutral");
    expect(body.conclusion).not.toBe("success");
    expect(body.output.summary).toContain("build.angryorcgames.com");
    expect(body.output.summary).not.toContain("foundry.angryorcgames.com or build");
  });

  it("records a dispatch skip as neutral", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-record-skip-"));
    const dest = join(dir, "pr-78.json");
    const result = await runScript(recordScript, [dest], {
      ...process.env,
      E2E_SHA: SAME,
      E2E_RUN_ID: "4242",
      E2E_OK: "false",
      E2E_SKIPPED: "true",
      E2E_JOB_STATUS: "failure",
    });
    const body = JSON.parse(await readFile(dest, "utf8"));
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(body.conclusion).toBe("neutral");
    expect(body.conclusion).not.toBe("success");
    expect(body.summary).toContain("Skipped");
  });
});

describe("launch window for dispatch", () => {
  async function launchEnv(hour, extra = {}) {
    const dir = await mkdtemp(join(tmpdir(), "e2e-launch-dispatch-"));
    const bin = join(dir, "bin");
    const stub = join(dir, "stub");
    await mkdir(bin);
    await mkdir(stub);
    await writeFile(join(bin, "date"), DATE_STUB);
    await writeFile(join(bin, "curl"), STATUS_CURL);
    await chmod(join(bin, "date"), 0o755);
    await chmod(join(bin, "curl"), 0o755);
    await writeFile(join(stub, "curl-urls"), "");
    await writeFile(join(stub, "foundry.body"), extra.foundryBody ?? '{"users":0}\n');
    await writeFile(join(stub, "build.body"), '{"users":0}\n');
    return {
      dir,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: process.env.HOME,
        LANG: "C",
        E2E_STUB_DIR: stub,
        E2E_STUB_HOUR: hour,
        E2E_STUB_DATE_CODE: "0",
        ...extra.env,
      },
    };
  }

  it("still aborts at 23:00 when the run is not a dispatch", async () => {
    const ctx = await launchEnv("2300");
    let error;
    try {
      assertLaunchWindow(repoRoot, { env: ctx.env, stdio: "pipe" });
    } catch (caught) {
      error = caught;
    }
    await rm(ctx.dir, { recursive: true, force: true });

    expect(error?.status).toBe(1);
  });

  it("still aborts a dispatch launch when somebody is signed in", async () => {
    const ctx = await launchEnv("2300", {
      env: { E2E_GATE_MODE: "dispatch" },
      foundryBody: '{"users":0}\n',
    });
    await writeFile(join(ctx.dir, "stub", "build.body"), '{"users":1}\n');
    let error;
    try {
      assertLaunchWindow(repoRoot, { env: ctx.env, stdio: "pipe" });
    } catch (caught) {
      error = caught;
    }
    await rm(ctx.dir, { recursive: true, force: true });

    expect(error?.status).toBe(1);
    expect(`${error?.stdout ?? ""}`).toContain("build.angryorcgames.com");
  });

  it("allows a dispatch launch at 23:00 when nobody is signed in", async () => {
    const ctx = await launchEnv("2300", { env: { E2E_GATE_MODE: "dispatch" } });
    assertLaunchWindow(repoRoot, { env: ctx.env, stdio: "pipe" });
    await rm(ctx.dir, { recursive: true, force: true });
  });
});

describe("on-demand workflow wiring", () => {
  it("dispatches pr or ref without a comment trigger and keeps the nightly check distinct", async () => {
    const yaml = await readFile(workflowPath, "utf8");
    const header = yaml.slice(0, yaml.indexOf("jobs:"));
    const concurrency = header.slice(header.indexOf("concurrency:"), header.indexOf("env:"));

    expect(header).toContain('cron: "23 7 * * *"');
    expect(header).toContain("pr:");
    expect(header).toContain("E2E_GATE_MODE:");
    expect(header).toContain("E2E_CHECK_NAME:");
    expect(header).toContain(ON_DEMAND);
    expect(header).toContain(NIGHTLY);
    expect(header.indexOf("github.event_name == 'workflow_dispatch'")).toBeLessThan(
      header.indexOf("inputs.pr"),
    );
    expect(header).not.toContain("inputs.pr != ''");
    expect(header).not.toContain("inputs.ref != ''");
    expect(yaml).not.toContain("issue_comment");
    expect(yaml).not.toContain("pull_request_target");
    expect(yaml).not.toContain("pull_request:");
    expect(concurrency).toContain("foundry-e2e");
    expect(concurrency).not.toContain("on-demand");
    expect(yaml).toContain("needs.gate.outputs.skipped");
    expect(yaml).toContain("needs.gate.outputs.on_demand");
    expect(yaml).toContain("needs.gate.outputs.skip_reason");
    expect(yaml).toContain("E2E_SKIPPED:");
    expect(yaml).toContain("E2E_SKIP_REASON:");
    expect(yaml).toContain("E2E_GATE_SOFT_SKIP:");
    const gateJob = yaml.slice(yaml.indexOf("  gate:\n"), yaml.indexOf("  secrets:\n"));
    const foundryStep = yaml.slice(
      yaml.indexOf("- name: Run packaged Foundry E2E"),
      yaml.indexOf("- name: Verify tests executed"),
    );
    expect(gateJob).toContain("E2E_GATE_SOFT_SKIP:");
    expect(foundryStep).not.toContain("E2E_GATE_SOFT_SKIP");
    expect(yaml).toContain(
      "if: (always() || cancelled()) && needs.gate.result != 'success' && needs.gate.result != 'skipped'",
    );
  });
});
