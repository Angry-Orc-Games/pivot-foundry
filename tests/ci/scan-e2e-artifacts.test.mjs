import { Buffer } from "node:buffer";
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

const PRODUCED_BY_COMMAND = [
  ["npm run package:system", ["system.json", "system.zip"]],
  ["record-acceptance.mjs", ["artifact-identity.json"]],
  [
    "foundry-cli.mjs e2e",
    ["playwright-report", "test-results", ".foundry/instances/*/diagnostics"],
  ],
];

function workflowJobs(workflow) {
  return workflow.split(/\n {2}(?=\S)/).flatMap((chunk) => {
    const steps = [];
    let current = null;
    for (const line of chunk.split("\n")) {
      const named = line.match(/^ {6}- name: (.*)$/);
      if (named) {
        if (current) steps.push(current);
        current = { name: named[1], body: `${line}\n` };
      } else if (current) {
        current.body += `${line}\n`;
      }
    }
    if (current) steps.push(current);
    if (steps.length === 0) return [];
    return [{ name: chunk.match(/^(\S+):/)?.[1] ?? "workflow", steps }];
  });
}

function isUpload(step) {
  return step.body.includes("actions/upload-artifact");
}

function isScan(step) {
  return /^\s+id:\s+scan\s*$/m.test(step.body);
}

function scanArguments(step) {
  const line = step.body.split("\n").find((item) => item.includes("scan-e2e-artifacts.mjs"));
  if (!line) return [];
  const rest = line.slice(line.indexOf("scan-e2e-artifacts.mjs") + "scan-e2e-artifacts.mjs".length);
  return (rest.match(/"[^"]+"|'[^']+'|\S+/g) ?? []).map((token) =>
    token.replace(/^["']|["']$/g, ""),
  );
}

function uploadPaths(step) {
  const paths = [];
  const lines = step.body.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const inline = lines[index].match(/^ {10}path:\s*(.*)$/);
    if (!inline) continue;
    const value = inline[1].trim();
    if (value === "|") {
      for (let next = index + 1; next < lines.length; next += 1) {
        const entry = lines[next].match(/^ {12}(\S.*?)\s*$/);
        if (!entry) break;
        paths.push(entry[1]);
      }
    } else if (value) {
      paths.push(value);
    }
  }
  return paths;
}

function normalizeArtifact(path) {
  return path.replace(/^trusted-gate\//, "");
}

function scanCovers(args, output) {
  const file = normalizeArtifact(output);
  return args.some((arg) => {
    const root = normalizeArtifact(arg);
    return root === file || file.startsWith(`${root}/`) || root.startsWith(`${file}/`);
  });
}

function producedPaths(step) {
  const paths = [];
  for (const [command, outputs] of PRODUCED_BY_COMMAND) {
    if (step.body.includes(command)) paths.push(...outputs);
  }
  const recorded = step.body.match(/e2e-record-result\.sh\s+"([^"]+)"/);
  if (recorded) paths.push(recorded[1]);
  const accepted = step.body.match(/accept-artifact\.sh\s+\S+\s+\S+\s+(\S+)\s+(\S+)/);
  if (accepted) paths.push(accepted[1], accepted[2]);
  return paths;
}

function pathsNamedInStep(step, artifactPaths) {
  const named = [];
  for (const artifactPath of artifactPaths) {
    const normalized = normalizeArtifact(artifactPath);
    if (normalized && (step.body.includes(artifactPath) || step.body.includes(normalized))) {
      named.push(normalized);
    }
  }
  return named;
}

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

  it("scans every artifact input before upload and gates each upload", async () => {
    const workflow = await readFile(
      new URL("../../.github/workflows/e2e.yml", import.meta.url),
      "utf8",
    );
    const problems = [];
    const records = workflow.match(/- name: Record E2E result\n/g) ?? [];
    if (records.length !== 1) {
      problems.push(`workflow has ${records.length} Record E2E result steps`);
    }

    for (const job of workflowJobs(workflow)) {
      const scans = job.steps.filter(isScan);
      const uploads = job.steps.filter(isUpload);
      const artifactPaths = [...scans.flatMap(scanArguments), ...uploads.flatMap(uploadPaths)];
      const writers = job.steps.flatMap((step, index) => {
        if (isScan(step) || isUpload(step)) return [];
        const outputs = [
          ...new Set([...producedPaths(step), ...pathsNamedInStep(step, artifactPaths)]),
        ];
        return outputs.length === 0 ? [] : [{ step, index, outputs }];
      });
      if (uploads.length === 0 && writers.length === 0) continue;

      if (scans.length !== 1) {
        problems.push(`${job.name}: expected one credential scan, found ${scans.length}`);
        for (const upload of uploads) {
          if (!upload.body.includes("steps.scan.outcome == 'success'")) {
            problems.push(
              `${job.name}: upload "${upload.name}" is not gated on the credential scan`,
            );
          }
        }
        continue;
      }

      const scan = scans[0];
      const scanIndex = job.steps.indexOf(scan);
      if (!/if: always\(\)/.test(scan.body)) {
        problems.push(`${job.name}: credential scan does not run with if: always()`);
      }
      const args = scanArguments(scan);
      for (const writer of writers) {
        if (writer.index > scanIndex) {
          problems.push(
            `${job.name}: "${writer.step.name}" writes an artifact input after the credential scan`,
          );
        }
        for (const output of writer.outputs) {
          if (!scanCovers(args, output)) {
            problems.push(
              `${job.name}: "${writer.step.name}" writes ${output}, which the scan arguments do not cover`,
            );
          }
        }
      }
      for (const upload of uploads) {
        if (job.steps.indexOf(upload) < scanIndex) {
          problems.push(`${job.name}: upload "${upload.name}" runs before the credential scan`);
        }
        if (!upload.body.includes("steps.scan.outcome == 'success'")) {
          problems.push(`${job.name}: upload "${upload.name}" is not gated on the credential scan`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
