import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const promoteScript = fileURLToPath(new URL("../../scripts/ci/promote-source.sh", import.meta.url));
const recordScript = fileURLToPath(
  new URL("../../scripts/ci/record-staging-sha.sh", import.meta.url),
);
const deployScript = fileURLToPath(new URL("../../scripts/deploy-package.mjs", import.meta.url));

const repo = "Angry-Orc-Games/pivot-foundry";
const server = "https://github.com";
const head = "a".repeat(40);
const runId = "4242";
const zipBytes = "exact-staging-zip";
const zipSha = createHash("sha256").update(zipBytes).digest("hex");

const CURL_STUB = `#!/bin/sh
url=
method=GET
out=
prev=
for arg in "$@"; do
  printf '%s\\n' "$arg" >> "$PROMOTE_STUB_DIR/args"
  if [ "$prev" = "-X" ]; then method=$arg; fi
  if [ "$prev" = "-o" ]; then out=$arg; fi
  case "$arg" in
    http*) url=$arg ;;
  esac
  prev=$arg
done
printf '\\n' >> "$PROMOTE_STUB_DIR/args"
printf '%s\\n' "$url" >> "$PROMOTE_STUB_DIR/urls"
emit() {
  if [ -n "$out" ]; then
    cat > "$out"
  else
    cat
  fi
}
if [ "$method" = "POST" ]; then
  code=$(cat "$PROMOTE_STUB_DIR/post.code")
  exit "$code"
fi
case "$url" in
  */actions/runs/*)
    code=$(cat "$PROMOTE_STUB_DIR/run.code")
    if [ "$code" -ne 0 ]; then exit "$code"; fi
    emit < "$PROMOTE_STUB_DIR/run.json"
    ;;
  */statuses*)
    code=$(cat "$PROMOTE_STUB_DIR/statuses.code")
    if [ "$code" -ne 0 ]; then exit "$code"; fi
    emit < "$PROMOTE_STUB_DIR/statuses.json"
    ;;
  *)
    code=$(cat "$PROMOTE_STUB_DIR/post.code")
    if [ "$code" -ne 0 ]; then exit "$code"; fi
    ;;
esac
`;

function baseRun() {
  return {
    name: "Deploy staging",
    path: ".github/workflows/deploy-staging.yml",
    head_branch: "main",
    head_sha: head,
    conclusion: "success",
    status: "completed",
    event: "workflow_run",
    repository: { full_name: repo },
  };
}

function targetUrl(id = runId) {
  return `${server}/${repo}/actions/runs/${id}`;
}

function statusEntry(sha = zipSha, id = runId) {
  return {
    context: "pivot-staging-artifact",
    state: "success",
    description: `sha256:${sha}`,
    target_url: targetUrl(id),
    creator: { login: "github-actions[bot]" },
  };
}

async function stagingDir() {
  const dir = await mkdtemp(join(tmpdir(), "promote-bytes-"));
  await writeFile(join(dir, "system.zip"), zipBytes);
  await writeFile(
    join(dir, "artifact-identity.json"),
    JSON.stringify({ commit: head, artifact: { sha256: zipSha } }),
  );
  return dir;
}

async function withStub(files) {
  const dir = await mkdtemp(join(tmpdir(), "promote-stub-"));
  const bin = join(dir, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "curl"), CURL_STUB);
  await chmod(join(bin, "curl"), 0o755);
  await writeFile(join(dir, "args"), "");
  await writeFile(join(dir, "urls"), "");
  await writeFile(join(dir, "run.code"), "0");
  await writeFile(join(dir, "statuses.code"), "0");
  await writeFile(join(dir, "post.code"), "0");
  await writeFile(join(dir, "run.json"), JSON.stringify(baseRun()));
  await writeFile(join(dir, "statuses.json"), JSON.stringify([statusEntry()]));
  for (const [name, contents] of Object.entries(files ?? {})) {
    await writeFile(join(dir, name), contents);
  }
  return dir;
}

function runPromote(stub, args, env = {}) {
  return spawnSync("bash", [promoteScript, ...args], {
    encoding: "utf8",
    env: {
      PATH: `${join(stub, "bin")}:${process.env.PATH}`,
      HOME: process.env.HOME,
      LANG: "C",
      PROMOTE_STUB_DIR: stub,
      GITHUB_API_URL: "https://api.github.test",
      GITHUB_SERVER_URL: server,
      GITHUB_REPOSITORY: repo,
      GITHUB_TOKEN: "test-token",
      STAGING_RUN_ID: runId,
      ...env,
    },
  });
}

function runRecord(stub, dir, env = {}) {
  return spawnSync("bash", [recordScript, dir], {
    encoding: "utf8",
    env: {
      PATH: `${join(stub, "bin")}:${process.env.PATH}`,
      HOME: process.env.HOME,
      LANG: "C",
      PROMOTE_STUB_DIR: stub,
      GITHUB_API_URL: "https://api.github.test",
      GITHUB_SERVER_URL: server,
      GITHUB_REPOSITORY: repo,
      GITHUB_TOKEN: "test-token",
      GITHUB_RUN_ID: runId,
      ...env,
    },
  });
}

describe("promote source run", () => {
  it("accepts a successful staging run on main in this repo", async () => {
    const stub = await withStub();
    const result = runPromote(stub, ["run"]);
    const urls = await readFile(join(stub, "urls"), "utf8");
    await rm(stub, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(urls).toContain(`/repos/${repo}/actions/runs/${runId}`);
  });

  it.each([
    ["name", "CI"],
    ["path", ".github/workflows/ci.yml"],
    ["head_branch", "feature"],
    ["conclusion", "failure"],
    ["status", "in_progress"],
    ["event", "pull_request"],
    ["head_sha", "abc"],
  ])("refuses a run whose %s is %s", async (key, value) => {
    const run = baseRun();
    run[key] = value;
    const stub = await withStub({ "run.json": JSON.stringify(run) });
    const result = runPromote(stub, ["run"]);
    await rm(stub, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("refusing staging run");
  });

  it("refuses a run from another repository", async () => {
    const run = baseRun();
    run.repository = { full_name: "other/repo" };
    const stub = await withStub({ "run.json": JSON.stringify(run) });
    const result = runPromote(stub, ["run"]);
    await rm(stub, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
  });

  it("fails closed when the run API read fails", async () => {
    const stub = await withStub({ "run.code": "22" });
    const result = runPromote(stub, ["run"]);
    await rm(stub, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });

  it.each(["", "abc", "4242;touch /tmp/pwned", "4242\n99"])(
    "refuses a non-numeric run id %j before calling the API",
    async (id) => {
      const stub = await withStub();
      const result = runPromote(stub, ["run"], { STAGING_RUN_ID: id });
      const urls = await readFile(join(stub, "urls"), "utf8");
      await rm(stub, { recursive: true, force: true });

      expect(result.status).not.toBe(0);
      expect(urls.trim()).toBe("");
    },
  );
});

describe("promote source bytes", () => {
  it("prints the zip sha when the commit and the outside status match", async () => {
    const stub = await withStub();
    const dir = await stagingDir();
    const result = runPromote(stub, ["bytes", dir]);
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${zipSha}\n`);
  });

  it("ignores a newer status with a different context", async () => {
    const stub = await withStub({
      "statuses.json": JSON.stringify([
        { context: "ci", state: "success", description: "ok", target_url: targetUrl() },
        statusEntry(),
      ]),
    });
    const dir = await stagingDir();
    const result = runPromote(stub, ["bytes", dir]);
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${zipSha}\n`);
  });

  it("uses the newest staging status when an older one still matches", async () => {
    const stub = await withStub({
      "statuses.json": JSON.stringify([statusEntry("b".repeat(64)), statusEntry()]),
    });
    const dir = await stagingDir();
    const result = runPromote(stub, ["bytes", dir]);
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
  });

  it("loads the status for the packaged commit when it is not the workflow head", async () => {
    const packaged = "b".repeat(40);
    const stub = await withStub();
    const dir = await stagingDir();
    await writeFile(join(dir, "artifact-identity.json"), JSON.stringify({ commit: packaged }));
    const result = runPromote(stub, ["bytes", dir]);
    const urls = await readFile(join(stub, "urls"), "utf8");
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(urls).toContain(`/commits/${packaged}/statuses`);
    expect(urls).not.toContain(`/commits/${head}/statuses`);
  });

  it("refuses an artifact commit that is not 40 hex", async () => {
    const stub = await withStub();
    const dir = await stagingDir();
    await writeFile(join(dir, "artifact-identity.json"), JSON.stringify({ commit: "main" }));
    const result = runPromote(stub, ["bytes", dir]);
    const urls = await readFile(join(stub, "urls"), "utf8");
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("artifact commit");
    expect(urls).not.toContain("/statuses");
  });

  it.each([
    ["sha", () => statusEntry("c".repeat(64))],
    ["run", () => statusEntry(zipSha, "9999")],
    ["state", () => ({ ...statusEntry(), state: "failure" })],
    ["creator", () => ({ ...statusEntry(), creator: { login: "octocat" } })],
    [
      "creator missing",
      () => {
        const status = statusEntry();
        delete status.creator;
        return status;
      },
    ],
  ])("refuses a status whose %s does not match", async (_label, entry) => {
    const stub = await withStub({ "statuses.json": JSON.stringify([entry()]) });
    const dir = await stagingDir();
    const result = runPromote(stub, ["bytes", dir]);
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("staging sha256");
  });

  it("fails closed when the status API read fails", async () => {
    const stub = await withStub({ "statuses.code": "22" });
    const dir = await stagingDir();
    const result = runPromote(stub, ["bytes", dir]);
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("record staging sha", () => {
  it("posts the zip sha256 on the artifact commit for this run", async () => {
    const stub = await withStub();
    const dir = await stagingDir();
    const result = runRecord(stub, dir);
    const args = await readFile(join(stub, "args"), "utf8");
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    const body = JSON.parse(args.split("\n").find((line) => line.startsWith("{")));
    expect(body).toEqual({
      state: "success",
      context: "pivot-staging-artifact",
      description: `sha256:${zipSha}`,
      target_url: targetUrl(),
    });
    expect(args).toContain(`/repos/${repo}/statuses/${head}`);
  });

  it("fails closed when the status API write fails", async () => {
    const stub = await withStub({ "post.code": "22" });
    const dir = await stagingDir();
    const result = runRecord(stub, dir);
    await rm(stub, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
  });
});

describe("production deploy byte check", () => {
  const secrets = {
    FOUNDRY_DEPLOY_SSH_HOST: "deploy.example",
    FOUNDRY_DEPLOY_SSH_USER: "deploy",
    FOUNDRY_DEPLOY_TARGET_DIR: "/opt/foundry/systems/pivot-fantasy",
    FOUNDRY_DEPLOY_BACKUP_DIR: "/opt/foundry/backups",
    FOUNDRY_DEPLOY_SERVICE: "foundry",
    PIVOT_ALLOW_PRODUCTION_DEPLOY: "1",
    PIVOT_DEPLOY_DRY_RUN: "1",
    PIVOT_DEPLOY_PUBLIC_URL: "https://foundry.angryorcgames.com",
  };

  async function identityDir(stagingSha) {
    const dir = await mkdtemp(join(tmpdir(), "deploy-bytes-"));
    await writeFile(join(dir, "system.zip"), zipBytes);
    await writeFile(
      join(dir, "artifact-identity.json"),
      JSON.stringify({
        packageId: "pivot-fantasy",
        packageVersion: "0.1.0",
        commit: head,
        artifact: { sha256: zipSha },
        staging: { result: "passed", sha256: stagingSha },
      }),
    );
    return dir;
  }

  function deploy(dir, env) {
    return spawnSync(
      "node",
      [deployScript, "production", join(dir, "artifact-identity.json"), join(dir, "system.zip")],
      { encoding: "utf8", env: { ...process.env, ...secrets, ...env } },
    );
  }

  it("refuses when the outside sha is absent even if the artifact agrees with itself", async () => {
    const dir = await identityDir(zipSha);
    const result = deploy(dir, {});
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("recorded SHA-256");
  });

  it("dry-runs when the outside sha matches the zip and the artifact's own staging sha does not", async () => {
    const dir = await identityDir("d".repeat(64));
    const result = deploy(dir, { PIVOT_STAGING_ARTIFACT_SHA256: zipSha });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(zipSha);
  });

  it("refuses an outside sha that is not the zip", async () => {
    const dir = await identityDir(zipSha);
    const result = deploy(dir, { PIVOT_STAGING_ARTIFACT_SHA256: "e".repeat(64) });
    await rm(dir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
  });
});
