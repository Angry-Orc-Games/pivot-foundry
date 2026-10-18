import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci/e2e-gate.sh", import.meta.url));

const QUIET_HOURS_NOTICE =
  "::error::Foundry was not started. outside 02:00-05:30 ET quiet hours (shared Foundry license)";

const DATE_STUB = `#!/bin/sh
printf '%s\\n' "$TZ" >> "$E2E_STUB_DIR/date-tz"
printf '%s\\n' "$*" >> "$E2E_STUB_DIR/date-args"
if [ "$E2E_STUB_DATE_CODE" != 0 ]; then
  exit "$E2E_STUB_DATE_CODE"
fi
printf '%s\\n' "$E2E_STUB_HOUR"
`;

const CURL_STUB = `#!/bin/sh
url=
for arg in "$@"; do
  case "$arg" in
    http*) url=$arg ;;
  esac
done
printf '%s\\n' "$url" >> "$E2E_STUB_DIR/curl-urls"
case "$url" in
  *foundry.angryorcgames.com*)
    code=$(cat "$E2E_STUB_DIR/foundry.code")
    if [ "$code" -ne 0 ]; then
      exit "$code"
    fi
    cat "$E2E_STUB_DIR/foundry.body"
    ;;
  *build.angryorcgames.com*)
    code=$(cat "$E2E_STUB_DIR/build.code")
    if [ "$code" -ne 0 ]; then
      exit "$code"
    fi
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

async function runGate(mode, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "e2e-gate-"));
  const bin = join(dir, "bin");
  const stub = join(dir, "stub");
  const output = join(dir, "github-output");
  await mkdir(bin);
  await mkdir(stub);
  await writeFile(join(bin, "curl"), CURL_STUB);
  await chmod(join(bin, "curl"), 0o755);
  if (options.realDate !== true) {
    await writeFile(join(bin, "date"), DATE_STUB);
    await chmod(join(bin, "date"), 0o755);
  }
  await writeFile(output, "");
  await writeFile(join(stub, "foundry.body"), options.foundryBody ?? '{"users":0}\n');
  await writeFile(join(stub, "build.body"), options.buildBody ?? '{"users":0}\n');
  await writeFile(join(stub, "foundry.code"), String(options.foundryCode ?? 0));
  await writeFile(join(stub, "build.code"), String(options.buildCode ?? 0));
  await writeFile(join(stub, "curl-urls"), "");

  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: process.env.HOME,
    LANG: "C",
    GITHUB_OUTPUT: output,
    E2E_STUB_DIR: stub,
    E2E_STUB_HOUR: options.hour ?? "0300",
    E2E_STUB_DATE_CODE: String(options.dateCode ?? 0),
    FOUNDRY_ADMIN_KEY: "super-secret-admin",
    ...options.env,
  };

  const child = spawnSync("bash", [script, mode], {
    env,
    encoding: "utf8",
  });

  const githubOutput = await readFile(output, "utf8");
  const curlLog = await readFile(join(stub, "curl-urls"), "utf8").catch(() => "");
  const dateTz = await readFile(join(stub, "date-tz"), "utf8").catch(() => "");
  const dateArgs = await readFile(join(stub, "date-args"), "utf8").catch(() => "");
  await rm(dir, { recursive: true, force: true });

  return {
    status: child.status ?? 1,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    ok: outputValue(githubOutput, "ok"),
    available: outputValue(githubOutput, "available"),
    curls: curlLog.split("\n").filter(Boolean),
    dateTz: dateTz.trim(),
    dateArgs: dateArgs.trim(),
  };
}

describe("e2e license gate", () => {
  it.each(["0200", "0300", "0400", "0500", "0529"])(
    "allows Foundry at %s when both hosts have zero users",
    async (hour) => {
      const result = await runGate("license", { hour });

      expect(result.status).toBe(0);
      expect(result.ok).toBe("true");
      expect(result.stdout).toBe("");
      expect(result.dateTz).toBe("America/New_York");
      expect(result.dateArgs).toBe("+%H%M");
      expect(result.curls).toEqual([
        "https://foundry.angryorcgames.com/api/status",
        "https://build.angryorcgames.com/api/status",
      ]);
      expect(result.stdout + result.stderr).not.toContain("super-secret-admin");
    },
  );

  it.each(["0100", "0530", "0559", "0600", "2300"])(
    "fails closed at %s without calling the status hosts",
    async (hour) => {
      const result = await runGate("license", {
        hour,
        foundryCode: 22,
        buildCode: 22,
      });

      expect(result.status).toBe(1);
      expect(result.ok).toBe("false");
      expect(result.stdout.trim()).toBe(QUIET_HOURS_NOTICE);
      expect(result.curls).toEqual([]);
    },
  );

  it("names foundry when somebody is signed in there", async () => {
    const result = await runGate("license", {
      hour: "0300",
      foundryBody: '{"users":1}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. somebody is signed in on foundry.angryorcgames.com (shared Foundry license)",
    );
  });

  it("names build when somebody is signed in there", async () => {
    const result = await runGate("license", {
      hour: "0400",
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. somebody is signed in on build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("names both hosts when both have a signed-in user", async () => {
    const result = await runGate("license", {
      hour: "0529",
      foundryBody: '{"users":2}\n',
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. somebody is signed in on foundry.angryorcgames.com and build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("skips when a status request fails", async () => {
    const result = await runGate("license", {
      hour: "0200",
      foundryCode: 22,
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not read user count from foundry.angryorcgames.com (shared Foundry license)",
    );
  });

  it("skips when users is missing", async () => {
    const result = await runGate("license", {
      hour: "0300",
      foundryBody: '{"active":true}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not read user count from foundry.angryorcgames.com (shared Foundry license)",
    );
  });

  it("skips when the clock cannot be read", async () => {
    const result = await runGate("license", { dateCode: 1, foundryCode: 22 });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not read America/New_York clock (shared Foundry license)",
    );
    expect(result.curls).toEqual([]);
  });

  it("follows the machine clock in America/New_York", async () => {
    const clock = execFileSync("date", ["+%H%M"], {
      encoding: "utf8",
      env: { ...process.env, TZ: "America/New_York" },
    }).trim();
    const hour = Number(clock.slice(0, 2));
    const minute = Number(clock.slice(2, 4));
    const inWindow = (hour >= 2 && hour <= 4) || (hour === 5 && minute < 30);
    const result = await runGate("license", { realDate: true });

    if (inWindow) {
      expect(result.curls).toHaveLength(2);
      expect(result.status).toBe(result.ok === "true" ? 0 : 1);
    } else {
      expect(result.status).toBe(1);
      expect(result.ok).toBe("false");
      expect(result.stdout.trim()).toBe(QUIET_HOURS_NOTICE);
      expect(result.curls).toEqual([]);
    }
  });
});

const RERUN_NOTICE = "::error::Re-run inside the 02:00-05:30 ET window. Foundry was not started.";

describe("required license gate", () => {
  it("fails closed outside the window and tells the caller to re-run", async () => {
    const result = await runGate("require", {
      hour: "0530",
      foundryCode: 22,
      buildCode: 22,
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      `${RERUN_NOTICE} outside 02:00-05:30 ET quiet hours (shared Foundry license)`,
    );
    expect(result.curls).toEqual([]);
  });

  it("fails closed when somebody is signed in", async () => {
    const result = await runGate("require", {
      hour: "0300",
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      `${RERUN_NOTICE} somebody is signed in on build.angryorcgames.com (shared Foundry license)`,
    );
  });

  it("allows the caller at hour 03 when both hosts have zero users", async () => {
    const result = await runGate("require", { hour: "0300" });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("true");
    expect(result.stdout).toBe("");
    expect(result.curls).toEqual([
      "https://foundry.angryorcgames.com/api/status",
      "https://build.angryorcgames.com/api/status",
    ]);
  });
});

describe("workflows that start Foundry", () => {
  it("fails release and staging closed before Foundry, and leaves production promotion alone", async () => {
    const release = await readFile(
      fileURLToPath(new URL("../../.github/workflows/release.yml", import.meta.url)),
      "utf8",
    );
    const staging = await readFile(
      fileURLToPath(new URL("../../.github/workflows/deploy-staging.yml", import.meta.url)),
      "utf8",
    );
    const promote = await readFile(
      fileURLToPath(new URL("../../.github/workflows/promote-production.yml", import.meta.url)),
      "utf8",
    );
    const nightly = await readFile(
      fileURLToPath(new URL("../../.github/workflows/e2e.yml", import.meta.url)),
      "utf8",
    );

    const releaseGate = release.slice(
      release.indexOf("  gate:\n"),
      release.indexOf("  package:\n"),
    );
    expect(releaseGate).toContain("ref: ${{ github.sha }}");
    expect(releaseGate).toContain("sparse-checkout: scripts/ci");
    expect(releaseGate).toContain("bash trusted-gate/scripts/ci/e2e-gate.sh require");
    expect(releaseGate).not.toContain("refs/tags/");
    expect(release.indexOf("bash trusted-gate/scripts/ci/e2e-gate.sh require")).toBeLessThan(
      release.indexOf("foundry:e2e"),
    );
    expect(release).toContain("ref: refs/tags/${{ github.ref_name }}");
    const releaseE2e = release.slice(release.indexOf("  e2e:\n"), release.indexOf("  publish:\n"));
    expect(releaseE2e).toContain("path: package-artifact");
    expect(releaseE2e).toContain("accept-artifact.sh");
    expect(releaseE2e).not.toContain("refs/tags/");
    expect(releaseE2e.indexOf("accept-artifact.sh")).toBeLessThan(
      releaseE2e.indexOf("foundry:e2e"),
    );
    expect(release).toContain("needs.e2e.result == 'success'");
    expect(release).toContain("group: foundry-e2e");

    expect(staging).not.toContain("github.event.workflow_run.head_sha");
    expect(staging.indexOf("bash trusted-gate/scripts/ci/e2e-gate.sh require")).toBeLessThan(
      staging.indexOf("foundry:e2e"),
    );
    expect(staging.indexOf("accept-artifact.sh")).toBeLessThan(staging.indexOf("foundry:e2e"));
    expect(staging).toContain("path: package-artifact");
    expect(staging).toContain("working-directory: trusted-gate");
    expect(staging).toContain("group: foundry-e2e");

    const nightlyGate = nightly.slice(
      nightly.indexOf("  gate:\n"),
      nightly.indexOf("  secrets:\n"),
    );
    expect(nightlyGate).toContain("ref: ${{ github.sha }}");
    expect(nightlyGate).toContain("sparse-checkout: scripts/ci");
    expect(nightlyGate).toContain("bash trusted-gate/scripts/ci/e2e-gate.sh license");
    expect(nightlyGate).not.toContain("inputs.ref");
    expect(nightlyGate).not.toContain("matrix.target.sha");
    const nightlyE2e = nightly.slice(nightly.indexOf("  e2e:\n"));
    expect(nightlyE2e.indexOf("bash trusted-gate/scripts/ci/e2e-gate.sh license")).toBeLessThan(
      nightlyE2e.indexOf("matrix.target.sha"),
    );

    expect(promote).toContain("path: package-artifact");
    expect(promote).toContain("accept-artifact.sh");
    expect(promote).toContain("persist-credentials: false");
    expect(promote.indexOf("accept-artifact.sh")).toBeLessThan(
      promote.indexOf("deploy-package.mjs"),
    );
    expect(promote).not.toContain("foundry:e2e");
    expect(promote).not.toContain("foundry-cli.mjs");
    expect(nightly).not.toContain("e2e-gate.sh require");

    const nightlyHeader = nightly.slice(0, nightly.indexOf("jobs:"));
    expect(nightlyHeader).toContain("contents: read");
    expect(nightlyHeader).not.toContain("checks: write");
    expect(nightlyHeader).not.toContain("issues: write");
    const nightlyPlan = nightly.slice(
      nightly.indexOf("  plan:\n"),
      nightly.indexOf("  package:\n"),
    );
    expect(nightlyPlan).toContain("issues: write");
    expect(nightlyPlan).not.toContain("npm ");
    const packageJob = nightly.slice(nightly.indexOf("  package:\n"), nightly.indexOf("  e2e:\n"));
    expect(packageJob).not.toContain("secrets.");
    expect(packageJob).not.toContain("environment:");
    expect(packageJob).toContain("npm run package:system");
    expect(packageJob).toContain("name: e2e-package-");
    expect(packageJob.indexOf("e2e-gate.sh license")).toBeLessThan(
      packageJob.indexOf("matrix.target.sha"),
    );
    const nightlyE2eJob = nightly.slice(
      nightly.indexOf("  e2e:\n"),
      nightly.indexOf("  report:\n"),
    );
    expect(packageJob).toContain('ACTIONS_RUNTIME_TOKEN: ""');
    expect(packageJob).toContain("docker run --rm --network none");
    expect(packageJob).toContain("-e HOME=/tmp");
    expect(packageJob).toContain("apt-get install -y --no-install-recommends zip unzip");
    expect(packageJob).toContain('-v "$GITHUB_WORKSPACE:/work"');
    expect(packageJob).not.toContain("artifact-identity.json");
    expect(nightlyE2eJob).not.toContain("package:system");
    expect(nightlyE2eJob).not.toContain("path: under-test");
    expect(nightlyE2eJob).not.toContain("ref: ${{ matrix.target.sha }}");
    expect(nightlyE2eJob).toContain("working-directory: trusted-gate");
    expect(nightlyE2eJob).toContain("sparse-checkout-cone-mode: false");
    expect(nightlyE2eJob).toContain("name: e2e-package-");
    expect(nightlyE2eJob).toContain("path: package-artifact");
    expect(nightlyE2eJob).toContain("Accept only the system zip");
    const nightlyE2ePerms = nightlyE2eJob.slice(0, nightlyE2eJob.indexOf("steps:"));
    expect(nightlyE2ePerms).toContain("contents: read");
    expect(nightlyE2ePerms).toContain("actions: read");
    expect(nightlyE2ePerms).not.toContain("checks:");
    expect(nightlyE2ePerms).not.toContain("issues:");
    const nightlyReport = nightly.slice(
      nightly.indexOf("  report:\n"),
      nightly.indexOf("  closed:\n"),
    );
    expect(nightlyReport).toContain("checks: write");
    expect(nightlyReport).toContain("actions: read");
    expect(nightlyReport).not.toContain("matrix.target");
    expect(nightlyReport).not.toContain("download-artifact");
    expect(nightlyReport).toContain("E2E_RUN_ID: ${{ github.run_id }}");
    expect(nightlyReport).toContain("bash trusted-gate/scripts/ci/e2e-publish-results.sh");
    const buildStep = packageJob.slice(
      packageJob.indexOf("- name: Build the system package"),
      packageJob.indexOf("- name: Upload packaged system"),
    );
    expect(buildStep).not.toContain("FOUNDRY_");
    expect(buildStep).toContain('GITHUB_TOKEN: ""');
    const foundryStep = nightlyE2eJob.slice(
      nightlyE2eJob.indexOf("- name: Run packaged Foundry E2E"),
      nightlyE2eJob.indexOf("- name: Verify tests executed"),
    );
    expect(foundryStep).toContain("FOUNDRY_LICENSE_KEY: ${{ secrets.FOUNDRY_LICENSE_KEY }}");
    expect(foundryStep).toContain("--skip-package");
    expect(foundryStep).toContain('GITHUB_TOKEN: ""');
    expect(nightly).toContain(
      "if: (always() || cancelled()) && needs.gate.result != 'success' && needs.gate.result != 'skipped'",
    );

    expect(staging).toContain("github.event.workflow_run.event == 'push'");
    expect(staging).toContain(
      "github.event.workflow_run.head_repository.full_name == github.repository",
    );
    expect(staging).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(staging).toContain("github.ref == 'refs/heads/main'");
    expect(staging).not.toContain("head_sha");

    for (const workflow of [nightly, release, staging, promote]) {
      const checkouts = workflow.split("uses: actions/checkout@").length - 1;
      const persisted = workflow.split("persist-credentials: false").length - 1;
      expect(persisted).toBe(checkouts);
    }
  });
});

describe("e2e secret presence", () => {
  const present = {
    HAVE_ADMIN: "true",
    HAVE_LICENSE: "true",
    HAVE_CACHE: "true",
    HAVE_SHA: "true",
  };

  it("exits green when every required secret flag is true", async () => {
    const result = await runGate("secrets", { env: present });

    expect(result.status).toBe(0);
    expect(result.available).toBe("true");
    expect(result.ok).toBe("");
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.curls).toEqual([]);
    expect(result.dateTz).toBe("");
  });

  it("fails closed and names only the missing secrets", async () => {
    const result = await runGate("secrets", {
      env: {
        HAVE_LICENSE: "true",
        HAVE_CACHE: "true",
      },
    });

    expect(result.status).toBe(1);
    expect(result.available).toBe("");
    expect(result.stderr.trim()).toBe(
      "::error::Foundry E2E cannot run. Missing required secrets in GitHub Environment 'foundry-e2e': FOUNDRY_ADMIN_KEY FOUNDRY_RELEASE_SHA256",
    );
    expect(result.stderr).not.toContain("super-secret-admin");
    expect(result.curls).toEqual([]);
  });
});
