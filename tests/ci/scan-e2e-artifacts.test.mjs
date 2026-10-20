import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { credentialLeakMessage, scanTree } from "../../scripts/ci/scan-e2e-artifacts.mjs";

const FAKE_SECRET = "zip-trace-secret";

async function zipTrace(dir, name, contents) {
  const folder = join(dir, "playwright-report", "data");
  await mkdir(folder, { recursive: true });
  const entry = join(folder, "trace.network");
  await writeFile(entry, contents);
  const zip = join(folder, name);
  const packed = spawnSync("zip", ["-q", "-9", zip, "trace.network"], { cwd: folder });
  if (packed.status !== 0) throw new Error("zip failed");
  await rm(entry);
  return zip;
}

describe("E2E artifact credential scan", () => {
  it("finds a credential inside a zipped trace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      const zip = await zipTrace(
        dir,
        "trace.zip",
        JSON.stringify({ params: { selector: "input", value: FAKE_SECRET, password: true } }),
      );
      const raw = await readFile(zip);
      expect(raw.includes(FAKE_SECRET)).toBe(false);

      const hit = scanTree(dir, [FAKE_SECRET]);
      const message = credentialLeakMessage(hit);

      expect(hit).toBe("playwright-report/data/trace.zip");
      expect(message).toBe(
        "Found a credential in playwright-report/data/trace.zip. Diagnostics were not uploaded.",
      );
      expect(message).not.toContain(FAKE_SECRET);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores a zipped trace with no credential", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      await zipTrace(dir, "trace.zip", JSON.stringify({ params: { value: "visible-label" } }));
      expect(scanTree(dir, [FAKE_SECRET])).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("finds a credential in a plain diagnostic log", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      await writeFile(join(dir, "foundry.log"), `boot\n${FAKE_SECRET}\n`);
      expect(scanTree(dir, [FAKE_SECRET])).toBe("foundry.log");
      expect(credentialLeakMessage("foundry.log")).not.toContain(FAKE_SECRET);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not upload diagnostics unless the credential scan passes", async () => {
    const workflow = await readFile(
      new URL("../../.github/workflows/e2e.yml", import.meta.url),
      "utf8",
    );
    const scan = workflow.indexOf("- name: Scan diagnostics for credentials");
    const upload = workflow.indexOf("- name: Upload sanitized diagnostics");
    expect(scan).toBeGreaterThan(-1);
    expect(scan).toBeLessThan(upload);
    const uploadStep = workflow.slice(upload, workflow.indexOf("\n      - name:", upload + 1));
    expect(uploadStep).toContain("steps.scan.outcome == 'success'");
    expect(uploadStep).toContain("playwright-report");
    expect(uploadStep).toContain("test-results");
  });
});
