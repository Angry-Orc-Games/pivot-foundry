import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const e2ePath = fileURLToPath(new URL("../../.github/workflows/e2e.yml", import.meta.url));
const releasePath = fileURLToPath(new URL("../../.github/workflows/release.yml", import.meta.url));

const E2E_GROUP =
  "${{ (github.event_name == 'workflow_dispatch' && inputs.secrets_check_only) && format('foundry-e2e-secrets-{0}', github.ref) || 'foundry-e2e' }}";
const RELEASE_GROUP = "release-${{ github.ref }}";

function concurrencyBlocks(yaml) {
  const lines = yaml.split("\n");
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^(\s*)concurrency:\s*(#.*)?$/);
    if (!header) continue;
    const indent = header[1].length;
    const block = { group: "", cancelInProgress: undefined, line: index + 1 };
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line.trim() === "" || line.trim().startsWith("#")) continue;
      const body = line.match(/^(\s*)([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
      if (!body || body[1].length <= indent) break;
      if (body[2] === "group") block.group = body[3];
      if (body[2] === "cancel-in-progress") block.cancelInProgress = body[3];
    }
    blocks.push(block);
  }
  return blocks;
}

function groupLiterals(group) {
  const formatted = [...group.matchAll(/format\(\s*'([^']*)'/g)].map((match) => match[1]);
  const alternatives = [...group.matchAll(/\|\|\s*'([^']*)'/g)].map((match) => match[1]);
  if (formatted.length > 0 || alternatives.length > 0) return [...formatted, ...alternatives];
  return [group];
}

describe("e2e and release concurrency", () => {
  it("keeps every e2e schedule and dispatch run in the shared foundry-e2e group", async () => {
    const blocks = concurrencyBlocks(await readFile(e2ePath, "utf8"));
    const [workflow] = blocks;
    const literals = groupLiterals(workflow.group);

    expect(blocks).toHaveLength(1);
    expect(workflow.group).toBe(E2E_GROUP);
    expect(literals).toEqual(["foundry-e2e-secrets-{0}", "foundry-e2e"]);
    expect(new Set(literals).size).toBe(literals.length);
  });

  it("gives release its own group and stops sharing foundry-e2e with nightly", async () => {
    const blocks = concurrencyBlocks(await readFile(releasePath, "utf8"));

    expect(blocks.map((block) => block.group)).toEqual([RELEASE_GROUP]);
    expect(blocks.flatMap((block) => groupLiterals(block.group))).not.toContain("foundry-e2e");
  });

  it("shares no concurrency-group literal between the two workflows", async () => {
    const e2eLiterals = concurrencyBlocks(await readFile(e2ePath, "utf8")).flatMap((block) =>
      groupLiterals(block.group),
    );
    const releaseLiterals = concurrencyBlocks(await readFile(releasePath, "utf8")).flatMap(
      (block) => groupLiterals(block.group),
    );
    const shared = e2eLiterals.filter((literal) => releaseLiterals.includes(literal));

    expect(shared).toEqual([]);
    expect(e2eLiterals).toContain("foundry-e2e");
    expect(releaseLiterals).not.toContain("foundry-e2e");
  });

  it("sets cancel-in-progress to false on every concurrency block", async () => {
    const blocks = [
      ...concurrencyBlocks(await readFile(e2ePath, "utf8")),
      ...concurrencyBlocks(await readFile(releasePath, "utf8")),
    ];

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.cancelInProgress, `concurrency at line ${block.line}`).toBe("false");
    }
  });
});
