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

describe("local composite actions", () => {
  it("resolve to an action.yml that exists in the repository", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of text.matchAll(
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
      if (!text.includes("uses: ./trusted-gate/.github/actions/")) continue;
      expect(text, name).toMatch(/sparse-checkout: \|[\s\S]*?\n\s+\/\.github\/actions\/\n/);
    }
  });

  it("make callers choose the Node version", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of text.matchAll(
        /uses: \.\/(?:trusted-gate\/)?\.github\/actions\/setup-node-deps\n((?:\s+with:\n(?:\s{10}.+\n)+)?)/g,
      )) {
        expect(match[1], name).toContain("node-version:");
      }
    }
  });
});

describe("scripts/ci paths used by workflow jobs", () => {
  function jobsOf(text) {
    const jobs = text.slice(text.indexOf("\njobs:\n") + 1).split(/\n {2}(?=[\w-]+:\n)/);
    return jobs.slice(1);
  }

  it("exist in the repository", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of text.matchAll(/scripts\/ci\/([\w.-]+\.(?:sh|mjs))/g)) {
        await expect(
          access(join(root, "scripts", "ci", match[1])),
          `${name}: scripts/ci/${match[1]}`,
        ).resolves.toBe(undefined);
      }
    }
  });

  it("sit in a job that checks them out", async () => {
    for (const { name, text } of await workflows()) {
      for (const job of jobsOf(text)) {
        const jobName = job.split("\n")[0];
        if (!/scripts\/ci\//.test(job)) continue;
        expect(job, `${name} ${jobName}: needs a checkout`).toContain("uses: actions/checkout@");
        for (const sparse of job.matchAll(/sparse-checkout: (\|\n(?: {12}.+\n)+|.+\n)/g)) {
          expect(sparse[1], `${name} ${jobName}: sparse checkout`).toMatch(
            /(?:^|\s)\/?scripts(?:\/ci)?\/?(?:\s|$)/,
          );
        }
      }
    }
  });
});
