import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const workflowDir = join(root, ".github", "workflows");

async function workflows() {
  const names = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml")).sort();
  return Promise.all(
    names.map(async (name) => ({ name, text: await readFile(join(workflowDir, name), "utf8") })),
  );
}

/** Drop whole-line YAML comments so a commented-out reference is not a reference. */
function withoutComments(text) {
  return text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

/** Split a workflow into its jobs. Throws when the layout is not the one this test understands. */
function jobsOf(text) {
  const start = text.indexOf("\njobs:\n");
  if (start === -1) throw new Error("workflow has no top-level jobs: block");
  const chunks = text.slice(start + 1).split(/\n {2}(?=[\w-]+:[ \t]*(?:#.*)?\n)/);
  return chunks.slice(1).map((chunk) => ({ name: chunk.split(":")[0], text: chunk }));
}

/** Split a job into steps (`      - name:` or `      - uses:`). */
function stepsOf(job) {
  return job.split(/\n {6}- (?=\w)/).slice(1);
}

/** Does this checkout step put `scripts/` on disk, and under which path? */
function checkoutProvidingScripts(step) {
  if (!step.startsWith("name:") && !step.startsWith("uses:")) return undefined;
  if (!/uses: actions\/checkout@/.test(step)) return undefined;
  const sparse = step.match(/sparse-checkout: ?([\s\S]*)/);
  if (sparse && !/(?:^|[\s|])\/?scripts(?:\/ci)?\/?(?:\s|$)/m.test(sparse[1])) return undefined;
  return step.match(/^\s*path: (\S+)$/m)?.[1] ?? ".";
}

describe("local composite actions", () => {
  it("resolve to an action.yml that exists in the repository", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of withoutComments(text).matchAll(
        /uses: \.\/(?:trusted-gate\/)?(\.github\/actions\/[\w-]+)/g,
      )) {
        await expect(
          access(join(root, match[1], "action.yml")),
          `${name}: ${match[1]}`,
        ).resolves.toBe(undefined);
      }
    }
  });

  it("are only called from trusted-gate when its sparse checkout includes them", async () => {
    for (const { name, text } of await workflows()) {
      if (!withoutComments(text).includes("uses: ./trusted-gate/.github/actions/")) continue;
      expect(text, name).toMatch(/sparse-checkout: \|[\s\S]*?\n\s+\/\.github\/actions\/\n/);
    }
  });

  it("make callers choose the Node version", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of withoutComments(text).matchAll(
        /uses: \.\/(?:trusted-gate\/)?\.github\/actions\/setup-node-deps\n((?:\s+with:\n(?:\s{10}.+\n)+)?)/g,
      )) {
        expect(match[1], name).toContain("node-version:");
      }
    }
  });
});

describe("scripts/ci paths that a workflow job runs directly", () => {
  const reference = /(?:\.\/)?(trusted-gate\/)?scripts\/ci\/([\w./-]+\.\w+)/g;

  it("exist in the repository", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of withoutComments(text).matchAll(reference)) {
        await expect(
          access(join(root, "scripts", "ci", match[2])),
          `${name}: scripts/ci/${match[2]}`,
        ).resolves.toBe(undefined);
      }
    }
  });

  it("are covered by one of the job's own checkouts, at the path the step uses", async () => {
    for (const { name, text } of await workflows()) {
      for (const job of jobsOf(withoutComments(text))) {
        const prefixes = new Set(
          [...job.text.matchAll(reference)].map((match) => (match[1] ? "trusted-gate" : ".")),
        );
        if (prefixes.size === 0) continue;
        const provided = new Set(
          stepsOf(job.text)
            .map(checkoutProvidingScripts)
            .filter((path) => path !== undefined),
        );
        for (const prefix of prefixes) {
          // A bare scripts/ci path may run from a trusted-gate working-directory.
          const ok = prefix === "." ? provided.size > 0 : provided.has(prefix);
          expect(ok, `${name} ${job.name}: no checkout provides scripts/ci at "${prefix}"`).toBe(
            true,
          );
        }
      }
    }
  });
});
