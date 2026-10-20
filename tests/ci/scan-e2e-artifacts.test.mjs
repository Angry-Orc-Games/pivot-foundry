import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  credentialLeakMessage,
  scanRoots,
  scanTree,
} from "../../scripts/ci/scan-e2e-artifacts.mjs";

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

  function scanCommand(workflow) {
    const scan = workflow.indexOf("- name: Scan diagnostics for credentials");
    const upload = workflow.indexOf("- name: Upload sanitized diagnostics");
    const line = workflow
      .slice(scan, upload)
      .split("\n")
      .find((entry) => entry.includes("scan-e2e-artifacts.mjs"));
    return line?.trim() ?? "";
  }

  it("ignores compose.env when it is outside the uploaded diagnostics", async () => {
    const workflow = await readFile(
      new URL("../../.github/workflows/e2e.yml", import.meta.url),
      "utf8",
    );
    const command = scanCommand(workflow);
    expect(command).toContain(".foundry/instances/*/diagnostics");

    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      const diagnostics = join(dir, ".foundry", "instances", "e2e", "diagnostics");
      await mkdir(diagnostics, { recursive: true });
      await writeFile(join(diagnostics, "foundry.log"), "Server started and listening\n");
      await writeFile(
        join(dir, ".foundry", "instances", "e2e", "compose.env"),
        `FOUNDRY_ADMIN_KEY=${FAKE_SECRET}\n`,
      );
      const roots = command
        .split("scan-e2e-artifacts.mjs")[1]
        .trim()
        .split(/\s+/)
        .map((root) => join(dir, root.replaceAll("*", "e2e")));
      const result = scanRoots(roots, { FOUNDRY_ADMIN_KEY: FAKE_SECRET, FOUNDRY_LICENSE_KEY: "" });
      expect(result.hit).toBeNull();
      expect(scanTree(join(dir, ".foundry", "instances", "e2e"), [FAKE_SECRET])).toBe(
        "compose.env",
      );
      expect(credentialLeakMessage("compose.env")).not.toContain(FAKE_SECRET);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("finds a credential inside a base64 zip embedded in html", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      const zip = await zipTrace(dir, "nested.zip", `Fill "${FAKE_SECRET}"`);
      const encoded = (await readFile(zip)).toString("base64");
      await rm(zip);
      await writeFile(
        join(dir, "index.html"),
        `<template id="playwrightReportBase64">data:application/zip;base64,${encoded}</template>`,
      );
      expect(scanTree(dir, [FAKE_SECRET])).toBe("index.html");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("finds a base64 and url-encoded credential that is not stored in plaintext", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    const secret = "scan/key value";
    try {
      await writeFile(join(dir, "encoded.txt"), Buffer.from(secret).toString("base64"));
      await writeFile(join(dir, "url.txt"), "scan%2Fkey%20value");
      expect(scanTree(dir, [secret])).not.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("finds a credential inside a zip that is stored inside another zip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      const inner = join(dir, "inner.zip");
      const packedInner = spawnSync("python3", [
        "-c",
        "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9); z.writestr('secret.txt', sys.argv[2]); z.close()",
        inner,
        FAKE_SECRET,
      ]);
      if (packedInner.status !== 0) throw new Error("inner zip failed");
      const innerBytes = await readFile(inner);
      expect(innerBytes.includes(FAKE_SECRET)).toBe(false);
      const outer = join(dir, "outer.zip");
      const packed = spawnSync("python3", [
        "-c",
        "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9); z.write(sys.argv[2], 'inner.zip'); z.close()",
        outer,
        inner,
      ]);
      if (packed.status !== 0) throw new Error("outer zip failed");
      await rm(inner);
      expect(scanTree(dir, [FAKE_SECRET])).toBe("outer.zip");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when an html data blob cannot be decoded", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-scan-"));
    try {
      await writeFile(
        join(dir, "index.html"),
        `<template>data:application/zip;base64,!!!!</template>`,
      );
      expect(() => scanTree(dir, [FAKE_SECRET])).toThrow(/Could not scan index\.html/);
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
