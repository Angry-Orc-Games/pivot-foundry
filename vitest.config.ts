import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.mjs"],
    passWithNoTests: false,
    allowOnly: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      thresholds: {
        statements: 82,
        branches: 78,
        functions: 84,
        lines: 84,
        "src/rules/**": {
          statements: 94,
          branches: 90,
          functions: 100,
          lines: 95,
        },
      },
    },
  },
});
