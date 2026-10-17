import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci/e2e-gate.sh", import.meta.url));

const QUIET_HOURS_NOTICE =
  "::notice::Skipped: outside 02:00-06:00 ET quiet hours (shared Foundry license)";

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
    E2E_STUB_HOUR: options.hour ?? "03",
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
  it.each(["02", "03", "04", "05"])(
    "allows Foundry at hour %s when both hosts have zero users",
    async (hour) => {
      const result = await runGate("license", { hour });

      expect(result.status).toBe(0);
      expect(result.ok).toBe("true");
      expect(result.stdout).toBe("");
      expect(result.dateTz).toBe("America/New_York");
      expect(result.dateArgs).toBe("+%H");
      expect(result.curls).toEqual([
        "https://foundry.angryorcgames.com/api/status",
        "https://build.angryorcgames.com/api/status",
      ]);
      expect(result.stdout + result.stderr).not.toContain("super-secret-admin");
    },
  );

  it.each(["01", "06", "23"])("skips hour %s without calling the status hosts", async (hour) => {
    const result = await runGate("license", {
      hour,
      foundryCode: 22,
      buildCode: 22,
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(QUIET_HOURS_NOTICE);
    expect(result.curls).toEqual([]);
  });

  it("names foundry when somebody is signed in there", async () => {
    const result = await runGate("license", {
      hour: "03",
      foundryBody: '{"users":1}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::notice::Skipped: somebody is signed in on foundry.angryorcgames.com (shared Foundry license)",
    );
  });

  it("names build when somebody is signed in there", async () => {
    const result = await runGate("license", {
      hour: "04",
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::notice::Skipped: somebody is signed in on build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("names both hosts when both have a signed-in user", async () => {
    const result = await runGate("license", {
      hour: "05",
      foundryBody: '{"users":2}\n',
      buildBody: '{"users":1}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::notice::Skipped: somebody is signed in on foundry.angryorcgames.com and build.angryorcgames.com (shared Foundry license)",
    );
  });

  it("skips when a status request fails", async () => {
    const result = await runGate("license", {
      hour: "02",
      foundryCode: 22,
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::notice::Skipped: could not read user count from foundry.angryorcgames.com (shared Foundry license)",
    );
  });

  it("skips when users is missing", async () => {
    const result = await runGate("license", {
      hour: "03",
      foundryBody: '{"active":true}\n',
    });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::notice::Skipped: could not read user count from foundry.angryorcgames.com (shared Foundry license)",
    );
  });

  it("skips when the clock cannot be read", async () => {
    const result = await runGate("license", { dateCode: 1, foundryCode: 22 });

    expect(result.status).toBe(0);
    expect(result.ok).toBe("false");
    expect(result.stdout.trim()).toBe(
      "::notice::Skipped: could not read America/New_York hour (shared Foundry license)",
    );
    expect(result.curls).toEqual([]);
  });

  it("follows the machine clock in America/New_York", async () => {
    const hour = execFileSync("date", ["+%H"], {
      encoding: "utf8",
      env: { ...process.env, TZ: "America/New_York" },
    }).trim();
    const result = await runGate("license", { realDate: true });
    const inWindow = ["02", "03", "04", "05"].includes(hour);

    expect(result.status).toBe(0);
    if (inWindow) {
      expect(result.ok).toBe("true");
      expect(result.curls).toHaveLength(2);
    } else {
      expect(result.ok).toBe("false");
      expect(result.stdout.trim()).toBe(QUIET_HOURS_NOTICE);
      expect(result.curls).toEqual([]);
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
