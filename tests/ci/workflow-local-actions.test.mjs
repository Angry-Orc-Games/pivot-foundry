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

const localActionUses = /uses: (?:\$\/|\.\/(?:trusted-gate\/)?)(\.github\/actions\/[\w-]+)/g;

describe("local composite actions", () => {
  it("resolve to an action.yml that exists in the repository", async () => {
    for (const { name, text } of await workflows()) {
      for (const match of text.matchAll(localActionUses)) {
        await expect(
          access(join(root, match[1], "action.yml")),
          `${name}: ${match[1]}`,
        ).resolves.toBe(undefined);
      }
    }
  });

  it("call trusted-gate composites only after trusted-gate-checkout", async () => {
    for (const { name, text } of await workflows()) {
      if (!text.includes("uses: ./trusted-gate/.github/actions/")) continue;
      expect(text, name).toContain("uses: $/.github/actions/trusted-gate-checkout");
    }
  });

  it("keeps the trusted-gate sparse list only in trusted-gate-checkout", async () => {
    const action = await readFile(
      join(root, ".github", "actions", "trusted-gate-checkout", "action.yml"),
      "utf8",
    );
    expect(action).toContain("persist-credentials: false");
    expect(action).toContain("sparse-checkout-cone-mode: false");
    expect(action).toMatch(
      /sparse-checkout: \|\n(?:\s+\/(?:\.github\/actions\/|scripts\/|e2e\/|foundry\/|package\.json|package-lock\.json)\n){6}/,
    );
    expect(action).toContain("/.github/actions/");
    expect(action).not.toMatch(/persist-credentials:\s*true/);

    for (const { name, text } of await workflows()) {
      expect(text, name).not.toMatch(/sparse-checkout: \|[\s\S]*?\/\.github\/actions\//);
    }
  });

  it("tells actionlint to accept the $/ trusted-gate-checkout ref", async () => {
    const config = await readFile(join(root, ".github", "actionlint.yaml"), "utf8");
    expect(config).toContain(String.raw`\$/\.github/actions/trusted-gate-checkout`);
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
