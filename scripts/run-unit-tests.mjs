#!/usr/bin/env node
/**
 * Programmatic Vitest runner for the AI feedback loop.
 *
 *   npm run test:agent
 *   npm run test:agent -- src/rules/rest.ts
 *   npm run test:changed
 *   npm run test:agent -- --json
 *
 * --json prints one summary object on stdout. Vitest's own log stays on stderr
 * in text mode. Exit code is 0 only when every selected test passes.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = path.join(ROOT, "test-results", "vitest-report.json");
const SUMMARY_PATH = path.join(ROOT, "test-results", "unit-summary.json");
const VITEST_BIN = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");

const UNIT_INPUT = /^(?:src|tests|lang|packs\/src)\/.+\.(?:ts|mts|mjs|cjs|js|json)$|^system\.json$/;

const STATIC_READS = [
  {
    pattern: /^templates\/actors\/character-sheet\.hbs$/,
    tests: ["tests/sheets/character-sheet-template.test.mjs"],
  },
];

export function unitTestInputs(changedPaths) {
  const inputs = [];
  for (const file of changedPaths) {
    const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
    if (UNIT_INPUT.test(normalized)) inputs.push(normalized);
    for (const rule of STATIC_READS) {
      if (rule.pattern.test(normalized)) inputs.push(...rule.tests);
    }
  }
  return [...new Set(inputs)];
}

export function summarizeReport(report) {
  const failures = [];
  for (const file of report.testResults ?? []) {
    const relativeFile = path.relative(ROOT, file.name ?? "").replaceAll("\\", "/");
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status !== "failed") continue;
      const location = assertion.location?.line ? `:${assertion.location.line}` : "";
      failures.push({
        name: assertion.fullName || assertion.title || relativeFile,
        file: `${relativeFile}${location}`,
        messages: (assertion.failureMessages ?? []).map(trimFailure),
      });
    }
  }

  const total = report.numTotalTests ?? 0;
  const failed = report.numFailedTests ?? 0;
  const passed = report.numPassedTests ?? 0;
  const status = report.success && total > 0 ? "pass" : "fail";

  return {
    status,
    passed,
    failed,
    pending: report.numPendingTests ?? 0,
    total,
    durationMs: null,
    failures,
    reason: total === 0 ? "no tests ran" : undefined,
  };
}

export function formatSummary(summary) {
  const lines = [
    `status: ${summary.status}`,
    `passed: ${summary.passed}`,
    `failed: ${summary.failed}`,
    `pending: ${summary.pending}`,
    `total: ${summary.total}`,
    `durationMs: ${summary.durationMs ?? "unknown"}`,
  ];
  if (summary.reason) lines.push(`reason: ${summary.reason}`);
  if (summary.failures.length > 0) {
    lines.push("", "failures:");
    for (const failure of summary.failures) {
      lines.push(`- ${failure.name}`);
      lines.push(`  ${failure.file}`);
      for (const message of failure.messages) {
        for (const line of message.split("\n")) lines.push(`  ${line}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function trimFailure(message) {
  const text = String(message ?? "").trim();
  const lines = text.split("\n").slice(0, 20);
  return lines.join("\n");
}

function parseArgs(argv) {
  const options = { json: false, coverage: false, changed: false, base: undefined, files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--coverage") options.coverage = true;
    else if (arg === "--changed") options.changed = true;
    else if (arg === "--base") {
      options.base = argv[index + 1];
      index += 1;
      if (!options.base) throw new Error("--base requires a git ref.");
    } else if (arg === "--") {
      options.files.push(...argv.slice(index + 1));
      break;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else options.files.push(arg);
  }
  if (options.changed && options.files.length > 0) {
    throw new Error("Pass either --changed or file paths, not both.");
  }
  if (options.coverage && (options.changed || options.files.length > 0)) {
    throw new Error("Coverage thresholds apply to the full suite. Run npm run test:coverage.");
  }
  return options;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveBase(explicit) {
  if (explicit) return explicit;
  for (const candidate of ["origin/main", "main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", candidate], {
        cwd: ROOT,
        stdio: "ignore",
      });
      return candidate;
    } catch {
      // try the next ref
    }
  }
  return "HEAD";
}

function changedPaths(base) {
  const resolved = resolveBase(base);
  const lists = [
    git(["diff", "--name-only", "--diff-filter=ACMR"]),
    git(["diff", "--name-only", "--cached", "--diff-filter=ACMR"]),
  ];
  if (resolved !== "HEAD") {
    lists.push(git(["diff", "--name-only", "--diff-filter=ACMR", `${resolved}...HEAD`]));
  }
  return [...new Set(lists.flat())];
}

function deletedUnitInputs(paths) {
  return paths.filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    return UNIT_INPUT.test(normalized) && !existsSync(path.join(ROOT, normalized));
  });
}

async function runVitest(files, coverage) {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await rm(REPORT_PATH, { force: true });
  const args = [
    VITEST_BIN,
    files.length > 0 ? "related" : "run",
    "--reporter=json",
    "--outputFile",
    REPORT_PATH,
  ];
  if (coverage) args.push("--coverage");
  args.push(...files);

  const started = Date.now();
  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  return { exitCode: exitCode ?? 1, stdout, stderr, durationMs: Date.now() - started };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let files = options.files;
  let skipped = null;

  if (options.changed) {
    const paths = changedPaths(options.base);
    if (deletedUnitInputs(paths).length > 0) files = [];
    else {
      files = unitTestInputs(paths);
      if (files.length === 0) {
        skipped = {
          status: "pass",
          passed: 0,
          failed: 0,
          pending: 0,
          total: 0,
          durationMs: 0,
          failures: [],
          reason: "no unit-test inputs in the change set",
        };
      }
    }
  }

  for (const file of files) {
    if (!existsSync(path.join(ROOT, file))) {
      throw new Error(`Test input does not exist: ${file}`);
    }
  }

  const summary = skipped ?? (await execute(files, options.coverage, options.json));
  const body = `${JSON.stringify(summary, null, 2)}\n`;
  await mkdir(path.dirname(SUMMARY_PATH), { recursive: true });
  await writeFile(SUMMARY_PATH, body, "utf8");

  if (options.json) process.stdout.write(body);
  else process.stdout.write(formatSummary(summary));

  if (summary.status !== "pass") process.exitCode = 1;
}

async function execute(files, coverage, json) {
  const run = await runVitest(files, coverage);
  if (!json) {
    if (run.stdout) process.stderr.write(run.stdout);
    if (run.stderr) process.stderr.write(run.stderr);
  }

  let report;
  try {
    report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  } catch {
    const summary = summarizeReport({});
    summary.durationMs = run.durationMs;
    summary.reason = "Vitest did not write a JSON report";
    summary.failures.push({
      name: "vitest",
      file: "scripts/run-unit-tests.mjs",
      messages: [trimFailure(`${run.stderr}\n${run.stdout}`.trim() || `exit ${run.exitCode}`)],
    });
    return summary;
  }

  const summary = summarizeReport(report);
  summary.durationMs = run.durationMs;
  if (run.exitCode !== 0 && summary.status === "pass") {
    summary.status = "fail";
    summary.reason = `Vitest exited ${run.exitCode}`;
  }
  return summary;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
