import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { assertLaunchWindow } from "../../scripts/foundry-e2e.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const foundryE2e = fileURLToPath(new URL("../../scripts/foundry-e2e.mjs", import.meta.url));

const DATE_STUB = `#!/bin/sh
printf '%s\\n' "$TZ" >> "$E2E_STUB_DIR/date-tz"
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
printf '%s\\n' '{"users":0}'
`;

async function launchEnv(hour) {
  const dir = await mkdtemp(join(tmpdir(), "e2e-launch-"));
  const bin = join(dir, "bin");
  const stub = join(dir, "stub");
  await mkdir(bin);
  await mkdir(stub);
  await writeFile(join(bin, "date"), DATE_STUB);
  await writeFile(join(bin, "curl"), CURL_STUB);
  await chmod(join(bin, "date"), 0o755);
  await chmod(join(bin, "curl"), 0o755);
  await writeFile(join(stub, "curl-urls"), "");
  return {
    dir,
    stub,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: process.env.HOME,
      LANG: "C",
      E2E_STUB_DIR: stub,
      E2E_STUB_HOUR: hour,
      E2E_STUB_DATE_CODE: "0",
    },
  };
}

describe("launch window", () => {
  it("aborts before Foundry starts when the clock is 05:30", async () => {
    const ctx = await launchEnv("0530");
    let error;
    try {
      assertLaunchWindow(repoRoot, { env: ctx.env, stdio: "pipe" });
    } catch (caught) {
      error = caught;
    }
    const curls = await readFile(join(ctx.stub, "curl-urls"), "utf8");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(error?.status).toBe(1);
    expect(`${error?.stdout ?? ""}`).toContain("Foundry was not started.");
    expect(curls.trim()).toBe("");
  });

  it("allows the launch at 05:29 when nobody is signed in", async () => {
    const ctx = await launchEnv("0529");
    assertLaunchWindow(repoRoot, { env: ctx.env, stdio: "pipe" });
    const curls = await readFile(join(ctx.stub, "curl-urls"), "utf8");
    await rm(ctx.dir, { recursive: true, force: true });

    expect(curls).toContain("https://foundry.angryorcgames.com/api/status");
    expect(curls).toContain("https://build.angryorcgames.com/api/status");
  });

  it("checks the window after the zip install and before the container starts", async () => {
    const source = await readFile(foundryE2e, "utf8");
    const install = source.indexOf("installPackagedSystem(paths, zipPath)");
    const gate = source.indexOf("assertLaunchWindow(paths.root)");
    const launch = source.indexOf('compose(paths, ["up"');

    expect(install).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(install);
    expect(launch).toBeGreaterThan(gate);
  });
});
