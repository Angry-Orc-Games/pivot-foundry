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
        statements: 68,
        branches: 65,
        functions: 73,
        lines: 69,
        "src/rules/**": {
          statements: 90,
          branches: 85,
          functions: 100,
          lines: 92,
        },
      },
    },
  },
});
