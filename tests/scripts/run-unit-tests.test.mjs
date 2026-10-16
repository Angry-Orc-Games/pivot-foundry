import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  classifyChangedPaths,
  formatSummary,
  parseArgs,
  summarizeReport,
  unitTestInputs,
} from "../../scripts/run-unit-tests.mjs";

describe("unitTestInputs", () => {
  it("keeps imported sources and maps the character sheet template", () => {
    expect(
      unitTestInputs([
        "src/rules/rest.ts",
        "templates/actors/character-sheet.hbs",
        "docs/architecture.md",
      ]),
    ).toEqual(["src/rules/rest.ts", "tests/sheets/character-sheet-template.test.mjs"]);
  });

  it("maps npc and item sheet templates to their unit tests", () => {
    expect(
      unitTestInputs(["templates/actors/npc-sheet.hbs", "templates/items/item-sheet.hbs"]),
    ).toEqual([
      "tests/sheets/npc-sheet.test.ts",
      "tests/sheets/sheet-templates.test.mjs",
      "tests/sheets/item-sheet.test.ts",
    ]);
  });

  it("ignores documentation-only edits", () => {
    expect(unitTestInputs(["README.md", "docs/development.md"])).toEqual([]);
  });
});

describe("classifyChangedPaths", () => {
  it("runs the full suite when a unit-test input was deleted", () => {
    expect(
      classifyChangedPaths(["src/rules/rest.ts", "tests/rules/rest.test.ts"], (file) => {
        return file !== "tests/rules/rest.test.ts";
      }),
    ).toEqual({ mode: "all", files: [], reason: "deleted unit-test input" });
  });

  it("skips when the change set has no unit-test inputs", () => {
    expect(classifyChangedPaths(["docs/architecture.md"], () => true)).toEqual({
      mode: "skip",
      files: [],
      reason: "no unit-test inputs in the change set",
    });
  });

  it("selects related inputs for files that still exist", () => {
    expect(classifyChangedPaths(["./src/rules/rest.ts"], () => true)).toEqual({
      mode: "related",
      files: ["src/rules/rest.ts"],
    });
  });
});

describe("parseArgs", () => {
  it("accepts a test name pattern and rejects coverage on a subset", () => {
    expect(
      parseArgs(["--testNamePattern", "short rest", "src/rules/rest.ts"]).testNamePattern,
    ).toBe("short rest");
    expect(() => parseArgs(["--coverage", "--changed"])).toThrow(/full suite/);
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown option/);
  });
});

describe("summarizeReport", () => {
  it("keeps failing tests and drops passing ones", () => {
    const summary = summarizeReport({
      success: false,
      numTotalTests: 2,
      numPassedTests: 1,
      numFailedTests: 1,
      numPendingTests: 0,
      testResults: [
        {
          name: "/workspace/tests/rules/modifiers.test.ts",
          assertionResults: [
            { status: "passed", fullName: "abilityModifier score 10", title: "score 10" },
            {
              status: "failed",
              fullName: "abilityModifier rejects scores",
              title: "rejects scores",
              location: { line: 27, column: 3 },
              failureMessages: ["AssertionError: expected 1 to be 2\n    at file.ts:27:3"],
            },
          ],
        },
      ],
    });

    expect(summary.status).toBe("fail");
    expect(summary.failures).toEqual([
      {
        name: "abilityModifier rejects scores",
        file: "tests/rules/modifiers.test.ts:27",
        messages: ["AssertionError: expected 1 to be 2\n    at file.ts:27:3"],
      },
    ]);
    expect(formatSummary(summary)).toContain("status: fail");
    expect(formatSummary(summary)).toContain("tests/rules/modifiers.test.ts:27");
  });

  it("fails closed when Vitest collected nothing", () => {
    expect(summarizeReport({ success: false, numTotalTests: 0 }).reason).toBe("no tests ran");
  });
});

describe("run-unit-tests script", () => {
  it("returns a JSON summary for one test file", () => {
    const stdout = execFileSync(
      process.execPath,
      ["scripts/run-unit-tests.mjs", "--json", "tests/rules/modifiers.test.ts"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const summary = JSON.parse(stdout);
    expect(summary.status).toBe("pass");
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBeGreaterThan(0);
    expect(summary.inputs).toEqual(["tests/rules/modifiers.test.ts"]);
    expect(summary.testFiles.length).toBeGreaterThan(0);
    expect(stdout.trim().startsWith("{")).toBe(true);
  }, 20000);

  it("filters by test name and fails closed on an unknown option", () => {
    const stdout = execFileSync(
      process.execPath,
      [
        "scripts/run-unit-tests.mjs",
        "--json",
        "--testNamePattern",
        "rejects scores outside",
        "tests/rules/modifiers.test.ts",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(JSON.parse(stdout)).toMatchObject({ status: "pass", passed: 1, failed: 0 });

    expect(() =>
      execFileSync(process.execPath, ["scripts/run-unit-tests.mjs", "--json", "--nope"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    ).toThrow();
    try {
      execFileSync(process.execPath, ["scripts/run-unit-tests.mjs", "--json", "--nope"], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
    } catch (error) {
      const summary = JSON.parse(error.stdout);
      expect(summary.status).toBe("fail");
      expect(summary.reason).toMatch(/Unknown option/);
    }
  }, 20000);
});
