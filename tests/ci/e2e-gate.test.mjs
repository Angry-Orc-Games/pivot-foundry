import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
    onDemand: outputValue(githubOutput, "on_demand"),
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

  it("fails closed when the status request is not HTTP success", async () => {
    const result = await runGate("license", {
      hour: "0200",
      foundryCode: 22,
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. status request to foundry.angryorcgames.com was not HTTP success (shared Foundry license)",
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

  it.each(['{"active":false}\n', '{"active":false,"version":"14.361"}\n'])(
    "allows a reachable inactive world with no users field: %s",
    async (buildBody) => {
      const result = await runGate("license", {
        hour: "0300",
        foundryBody: '{"active":true,"users":0}\n',
        buildBody,
      });

      expect(result.status).toBe(0);
      expect(result.ok).toBe("true");
      expect(result.stdout).toBe("");
      expect(result.curls).toEqual([
        "https://foundry.angryorcgames.com/api/status",
        "https://build.angryorcgames.com/api/status",
      ]);
      expect(result.stdout + result.stderr).not.toContain("super-secret-admin");
    },
  );

  it("allows both hosts when neither has loaded a world", async () => {
    const result = await runGate("license", {
      hour: "0300",
      foundryBody: '{"active":false}\n',
      buildBody: '{"active":false,"version":"14.361"}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("true");
    expect(result.stdout).toBe("");
  });

  it("allows an on-demand run outside quiet hours when the build host has no world", async () => {
    const result = await runGate("license", {
      hour: "2300",
      env: { E2E_GATE_MODE: "dispatch" },
      foundryBody: '{"active":true,"world":"pivot-test","users":0}\n',
      buildBody: '{"active":false,"version":"14.361"}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("true");
    expect(result.onDemand).toBe("true");
    expect(result.stdout).toBe("");
    expect(result.curls).toEqual([
      "https://foundry.angryorcgames.com/api/status",
      "https://build.angryorcgames.com/api/status",
    ]);
  });

  it("allows an active world that reports zero users", async () => {
    const result = await runGate("license", {
      hour: "0300",
      foundryBody: '{"active":true,"world":"pivot-test","users":0}\n',
      buildBody: '{"active":true,"users":0}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("true");
    expect(result.stdout).toBe("");
    expect(result.curls).toHaveLength(2);
  });

  it("refuses an active world with users signed in", async () => {
    const result = await runGate("license", {
      hour: "0400",
      buildBody: '{"active":true,"world":"pivot-test","users":2}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. somebody is signed in on build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("refuses an inactive world that still reports signed-in users", async () => {
    const result = await runGate("license", {
      hour: "0300",
      buildBody: '{"active":false,"users":1}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. somebody is signed in on build.angryorcgames.com (shared Foundry license)",
    );
  });

  it.each([6, 7, 28])(
    "fails closed when the status host is unreachable (curl %s)",
    async (buildCode) => {
      const result = await runGate("license", {
        hour: "0300",
        buildCode,
      });

      expect(result.status).toBe(1);
      expect(result.ok).toBe("false");
      expect(result.stdout.trim()).toBe(
        "::error::Foundry was not started. could not reach build.angryorcgames.com (shared Foundry license)",
      );
    },
  );

  it.each([
    ["not JSON", "not-json\n"],
    ["empty", ""],
    ["whitespace", "   \n"],
  ])("fails closed when the status body is %s", async (_label, buildBody) => {
    const result = await runGate("license", {
      hour: "0300",
      buildBody,
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not parse status JSON from build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("fails closed when the status JSON is not an object", async () => {
    const result = await runGate("license", {
      hour: "0300",
      buildBody: "[]\n",
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not read user count from build.angryorcgames.com (shared Foundry license)",
    );
  });

  it.each([
    ["fractional", '{"active":true,"users":1.5}\n'],
    ["a string", '{"active":true,"users":"0"}\n'],
    ["null", '{"active":true,"users":null}\n'],
    ["negative", '{"active":true,"users":-1}\n'],
  ])("fails closed when an active world has %s user count", async (_label, buildBody) => {
    const result = await runGate("license", {
      hour: "0300",
      buildBody,
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not read user count from build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("fails closed when an inactive world includes a non-numeric users field", async () => {
    const result = await runGate("license", {
      hour: "0300",
      buildBody: '{"active":false,"users":"none"}\n',
    });

    expect(result.status).toBe(1);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::error::Foundry was not started. could not read user count from build.angryorcgames.com (shared Foundry license)",
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

  it("allows a required run when a host is inactive and has no users field", async () => {
    const result = await runGate("require", {
      hour: "0300",
      foundryBody: '{"users":0}\n',
      buildBody: '{"active":false}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("true");
    expect(result.stdout).toBe("");
    expect(result.curls).toEqual([
      "https://foundry.angryorcgames.com/api/status",
      "https://build.angryorcgames.com/api/status",
    ]);
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
  it("keeps release off Foundry, fails staging closed before Foundry, and leaves production promotion alone", async () => {
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

    const releaseNightly = release.slice(
      release.indexOf("  nightly:\n"),
      release.indexOf("  package:\n"),
    );
    expect(releaseNightly).toContain("ref: ${{ github.sha }}");
    expect(releaseNightly).toContain("sparse-checkout: scripts/ci");
    expect(releaseNightly).toContain("bash trusted-gate/scripts/ci/require-nightly.sh");
    expect(releaseNightly).toContain("checks: read");
    expect(releaseNightly).toContain("actions: read");
    expect(releaseNightly).not.toContain("environment:");
    expect(releaseNightly).not.toContain("refs/tags/");
    expect(releaseNightly).not.toContain("FOUNDRY_");
    expect(release).not.toContain("refs/tags/");
    expect(release).not.toContain("foundry:e2e");
    expect(release).not.toContain("foundry-cli");
    expect(release).not.toContain("environment: foundry-e2e");
    expect(release).toContain("needs: [package, nightly]");
    expect(release).toContain(
      "needs.package.result == 'success' && needs.nightly.result == 'success'",
    );
    expect(release).not.toContain("group: foundry-e2e");

    expect(staging).not.toContain("ref: ${{ github.event.workflow_run.head_sha }}");
    expect(staging).toContain(
      "PIVOT_CI_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}",
    );
    expect(staging.indexOf("bash trusted-gate/scripts/ci/e2e-gate.sh require")).toBeLessThan(
      staging.indexOf("foundry:e2e"),
    );
    expect(staging.indexOf("accept-artifact.sh")).toBeLessThan(staging.indexOf("foundry:e2e"));
    expect(staging).toContain("export PIVOT_E2E_SUBJECT");
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
    const packageScan = packageJob.indexOf("- name: Scan packaged system for credentials");
    expect(packageScan).toBeGreaterThan(-1);
    const packageBeforeScan = packageJob.slice(0, packageScan);
    const packageScanStep = packageJob.slice(
      packageScan,
      packageJob.indexOf("\n      - name:", packageScan),
    );
    expect(packageBeforeScan).not.toContain("secrets.");
    expect(packageBeforeScan.replace("environment: foundry-e2e", "")).not.toContain("environment:");
    expect(packageJob).toContain("environment: foundry-e2e");
    expect(packageScanStep).toContain("FOUNDRY_ADMIN_KEY: ${{ secrets.FOUNDRY_ADMIN_KEY }}");
    expect(packageScanStep).toContain("FOUNDRY_LICENSE_KEY: ${{ secrets.FOUNDRY_LICENSE_KEY }}");
    expect(packageJob.slice(packageScan + packageScanStep.length)).not.toContain("secrets.");
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
      packageJob.indexOf("- name: Scan packaged system for credentials"),
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
    expect(staging).not.toContain("ref: ${{ github.event.workflow_run.head_sha }}");
    expect(staging).not.toContain("secrets.PIVOT_PACKAGE_VERSION");
    expect(promote).not.toContain("secrets.PIVOT_PACKAGE_VERSION");
    expect(release).not.toContain("secrets.PIVOT_PACKAGE_VERSION");
    expect(nightly).not.toContain("secrets.PIVOT_PACKAGE_VERSION");
    expect(staging).toContain("package-version.sh");
    expect(staging).toContain("steps.package-version.outputs.version");
    expect(staging).toContain("record-staging-sha.sh");
    expect(staging).toContain("statuses: write");
    expect(staging).toContain("set -o pipefail");
    expect(promote).toContain("promote-source.sh run");
    expect(promote).toContain("promote-source.sh bytes");
    expect(promote.indexOf("promote-source.sh run")).toBeLessThan(
      promote.indexOf("download-artifact"),
    );
    expect(promote.indexOf("promote-source.sh bytes")).toBeLessThan(
      promote.indexOf("deploy-package.mjs"),
    );
    expect(promote.indexOf("deploy-package.mjs")).toBeLessThan(promote.indexOf("/api/status"));
    expect(promote.indexOf("/api/status")).toBeLessThan(promote.indexOf("test:e2e:production"));
    expect(promote).toContain("set -o pipefail");
    expect(promote).toContain("PIVOT_STAGING_ARTIFACT_SHA256");
    expect(promote).not.toContain("identity.staging");
    expect(promote).not.toContain('JSON.parse(data || "{}")');

    const workflowDir = fileURLToPath(new URL("../../.github/workflows/", import.meta.url));
    const writers = [];
    for (const name of (await readdir(workflowDir)).sort()) {
      const text = await readFile(join(workflowDir, name), "utf8");
      if (text.includes("statuses: write")) writers.push(name);
    }
    expect(writers).toEqual(["deploy-staging.yml"]);

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
