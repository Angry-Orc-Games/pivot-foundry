import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dependabotPath = fileURLToPath(new URL("../../.github/dependabot.yml", import.meta.url));
const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/dependabot-automerge.yml", import.meta.url),
);

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, container: root }];
  const lines = text.split(/\r?\n/);

  function nextContent(start) {
    for (let index = start; index < lines.length; index += 1) {
      const raw = lines[index];
      if (!raw.trim() || raw.trim().startsWith("#")) continue;
      return { indent: raw.match(/^ */)?.[0].length ?? 0, text: raw.trim() };
    }
    return null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const line = raw.slice(indent);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].container;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) {
        throw new Error(`List item is not inside a list: ${raw.trim()}`);
      }
      const item = line.slice(2).trim();
      const colon = item.indexOf(":");
      if (colon === -1) {
        parent.push(unquote(item));
        continue;
      }
      const entry = {};
      parent.push(entry);
      const key = item.slice(0, colon).trim();
      const rest = item.slice(colon + 1).trim();
      stack.push({ indent, container: entry });
      if (rest && rest !== "|" && rest !== ">" && rest !== "|-" && rest !== ">-") {
        entry[key] = unquote(rest);
      } else {
        const upcoming = nextContent(index + 1);
        entry[key] = upcoming?.text.startsWith("- ") ? [] : {};
        stack.push({ indent, container: entry[key] });
      }
      continue;
    }

    const colon = line.indexOf(":");
    if (colon === -1) throw new Error(`Expected a key: ${raw.trim()}`);
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (Array.isArray(parent))
      throw new Error(`Mapping inside a list without an item: ${raw.trim()}`);
    if (rest && rest !== "|" && rest !== ">" && rest !== "|-" && rest !== ">-") {
      parent[key] = unquote(rest);
      continue;
    }
    const upcoming = nextContent(index + 1);
    parent[key] = upcoming?.text.startsWith("- ") ? [] : {};
    stack.push({ indent, container: parent[key] });
  }

  return root;
}

function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\*]/g, "\\$&").replaceAll("\\*", ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesGroup(group, dependency) {
  if (group["dependency-type"] && group["dependency-type"] !== dependency.dependencyType) {
    return false;
  }
  const updateTypes = group["update-types"] ?? [];
  if (updateTypes.length > 0 && !updateTypes.includes(dependency.updateType)) return false;
  const excluded = group["exclude-patterns"] ?? [];
  if (excluded.some((pattern) => patternToRegExp(pattern).test(dependency.name))) return false;
  const patterns = group.patterns ?? [];
  if (
    patterns.length > 0 &&
    !patterns.some((pattern) => patternToRegExp(pattern).test(dependency.name))
  ) {
    return false;
  }
  return true;
}

function matchingGroups(config, ecosystem, dependency) {
  const entry = config.updates.find((update) => update["package-ecosystem"] === ecosystem);
  if (!entry) return [];
  return Object.entries(entry.groups ?? {})
    .filter(([, group]) => matchesGroup(group, dependency))
    .map(([name]) => name);
}

describe("dependabot groups", () => {
  async function config() {
    return parseYaml(await readFile(dependabotPath, "utf8"));
  }

  it("schedules npm and github-actions weekly", async () => {
    const updates = (await config()).updates;
    expect(updates.map((update) => update["package-ecosystem"])).toEqual(["npm", "github-actions"]);
    expect(updates.every((update) => update.schedule?.interval === "weekly")).toBe(true);
  });

  it("groups non-major production, development, and actions updates, and leaves majors ungrouped", async () => {
    const parsed = await config();
    for (const update of parsed.updates) {
      const groups = Object.values(update.groups ?? {});
      expect(groups.length).toBeGreaterThan(0);
      for (const group of groups) {
        expect(group["update-types"]).toEqual(expect.arrayContaining(["minor", "patch"]));
        expect(group["update-types"]).not.toContain("major");
        expect(group["update-types"].every((type) => type === "minor" || type === "patch")).toBe(
          true,
        );
      }
    }

    expect(
      matchingGroups(parsed, "npm", {
        name: "left-pad",
        dependencyType: "production",
        updateType: "minor",
      }),
    ).toEqual(["npm-production"]);
    expect(
      matchingGroups(parsed, "npm", {
        name: "eslint",
        dependencyType: "development",
        updateType: "patch",
      }),
    ).toEqual(["npm-development"]);
    expect(
      matchingGroups(parsed, "github-actions", {
        name: "actions/checkout",
        dependencyType: "production",
        updateType: "minor",
      }),
    ).toEqual(["github-actions"]);

    for (const dependency of [
      { ecosystem: "npm", name: "eslint", dependencyType: "development" },
      { ecosystem: "npm", name: "left-pad", dependencyType: "production" },
      { ecosystem: "github-actions", name: "actions/setup-node", dependencyType: "production" },
    ]) {
      expect(
        matchingGroups(parsed, dependency.ecosystem, { ...dependency, updateType: "major" }),
        dependency.name,
      ).toEqual([]);
    }
  });

  it("keeps vitest and @vitest/coverage-v8 in the same group", async () => {
    const parsed = await config();
    for (const updateType of ["minor", "patch"]) {
      const vitest = matchingGroups(parsed, "npm", {
        name: "vitest",
        dependencyType: "development",
        updateType,
      });
      const coverage = matchingGroups(parsed, "npm", {
        name: "@vitest/coverage-v8",
        dependencyType: "development",
        updateType,
      });
      expect(vitest.length).toBeGreaterThan(0);
      expect(coverage).toEqual(vitest);
    }
  });

  it("does not group vite with other npm updates", async () => {
    const parsed = await config();
    expect(
      matchingGroups(parsed, "npm", {
        name: "eslint",
        dependencyType: "development",
        updateType: "patch",
      }),
    ).toEqual(["npm-development"]);
    for (const updateType of ["major", "minor", "patch"]) {
      for (const dependencyType of ["production", "development"]) {
        expect(
          matchingGroups(parsed, "npm", { name: "vite", dependencyType, updateType }),
          `${dependencyType} ${updateType}`,
        ).toEqual([]);
      }
    }
  });
});

describe("dependabot auto-merge workflow", () => {
  async function workflow() {
    return readFile(workflowPath, "utf8");
  }

  it("runs on pull_request for this repo's dependabot actor only", async () => {
    const text = await workflow();
    expect(text).not.toContain("pull_request_target");
    expect(text).toMatch(/^on:\n {2}pull_request:\s*$/m);
    const actorLine = text
      .split("\n")
      .find((line) => line.includes("github.actor == 'dependabot[bot]'"));
    expect(actorLine?.trim().startsWith("#")).toBe(false);
    expect(text).toContain("github.event.pull_request.head.repo.full_name == github.repository");
  });

  it("pins fetch-metadata and requests only contents and pull-requests write", async () => {
    const text = await workflow();
    expect(text).toMatch(/uses: dependabot\/fetch-metadata@[0-9a-f]{40}(?:\s|#|$)/);
    expect(text).not.toMatch(/uses: dependabot\/fetch-metadata@v\d/);
    const permissions = text.match(/^permissions:\n((?: {2}[^\n]+\n)+)/m)?.[1] ?? "";
    const keys = Object.fromEntries(
      permissions
        .trim()
        .split("\n")
        .map((line) =>
          line
            .trim()
            .split(":")
            .map((part) => part.trim()),
        ),
    );
    expect(keys).toEqual({ contents: "write", "pull-requests": "write" });
  });

  it("auto-merges patch, minor, and non-major development updates, and skips vite and majors", async () => {
    const text = await workflow();
    expect(text).toContain("gh pr merge --auto --squash");
    expect(text).toContain("== 'version-update:semver-patch'");
    expect(text).toContain("== 'version-update:semver-minor'");
    expect(text).toContain("== 'direct:development'");
    const majorLines = text
      .split("\n")
      .filter((line) => line.includes("semver-major") && !line.trim().startsWith("#"));
    expect(majorLines.length).toBeGreaterThan(0);
    for (const line of majorLines) {
      expect(line).toContain("!= 'version-update:semver-major'");
      expect(line).not.toContain("== 'version-update:semver-major'");
    }
    const viteGuards = text
      .split("\n")
      .filter((line) => line.includes("',vite,'") || line.includes("', vite,'"));
    expect(viteGuards.length).toBeGreaterThanOrEqual(2);
    expect(viteGuards.every((line) => !line.trim().startsWith("#"))).toBe(true);
  });
});
