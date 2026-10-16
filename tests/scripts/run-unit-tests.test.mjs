import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { formatSummary, summarizeReport, unitTestInputs } from "../../scripts/run-unit-tests.mjs";

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

  it("ignores documentation-only edits", () => {
    expect(unitTestInputs(["README.md", "docs/development.md"])).toEqual([]);
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
    expect(stdout.trim().startsWith("{")).toBe(true);
  }, 20000);
});
