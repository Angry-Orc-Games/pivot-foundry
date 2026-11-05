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
