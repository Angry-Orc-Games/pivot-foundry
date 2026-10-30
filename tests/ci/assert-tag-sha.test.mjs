import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci/assert-tag-sha.sh", import.meta.url));
const releaseWorkflow = fileURLToPath(
  new URL("../../.github/workflows/release.yml", import.meta.url),
);

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Pivot Test",
  GIT_AUTHOR_EMAIL: "pivot-test@example.com",
  GIT_COMMITTER_NAME: "Pivot Test",
  GIT_COMMITTER_EMAIL: "pivot-test@example.com",
};

function git(cwd, args) {
  const result = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    env: gitEnv,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function runAssert(cwd, sha, tag) {
  return spawnSync("bash", [script], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_SHA: sha,
      GITHUB_REF_NAME: tag,
    },
  });
}

async function withRepo(run) {
  const dir = await mkdtemp(join(tmpdir(), "assert-tag-sha-"));
  const origin = join(dir, "origin.git");
  const work = join(dir, "work");
  try {
    git(dir, ["init", "--bare", origin]);
    git(dir, ["init", "-b", "main", work]);
    git(work, ["commit", "--allow-empty", "-m", "base"]);
    git(work, ["remote", "add", "origin", origin]);
    git(work, ["push", "-u", "origin", "main"]);
    await run(work);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function head(work) {
  return git(work, ["rev-parse", "HEAD"]);
}

function publishTag(work, name, { annotated, force = false }) {
  git(work, ["tag", ...(force ? ["-f"] : []), ...(annotated ? ["-a", name, "-m", name] : [name])]);
  git(work, ["push", ...(force ? ["--force"] : []), "origin", `refs/tags/${name}`]);
}

function checkoutBlocks(workflow) {
  const blocks = [];
  const marker = "uses: actions/checkout@";
  let from = 0;
  while (from < workflow.length) {
    const at = workflow.indexOf(marker, from);
    if (at === -1) break;
    const nextStep = workflow.indexOf("\n      - ", at + marker.length);
    blocks.push(nextStep === -1 ? workflow.slice(at) : workflow.slice(at, nextStep));
    from = at + marker.length;
  }
  return blocks;
}

describe("assert-tag-sha", () => {
  it("passes when an annotated tag points at GITHUB_SHA", async () => {
    await withRepo(async (work) => {
      const sha = head(work);
      publishTag(work, "v1.2.3", { annotated: true });

      const result = runAssert(work, sha, "v1.2.3");

      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("::error::");
    });
  });

  it("passes when a lightweight tag points at GITHUB_SHA", async () => {
    await withRepo(async (work) => {
      const sha = head(work);
      publishTag(work, "v1.2.3", { annotated: false });

      const result = runAssert(work, sha, "v1.2.3");

      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("::error::");
    });
  });

  it("fails when the tag moved", async () => {
    await withRepo(async (work) => {
      const original = head(work);
      publishTag(work, "v1.2.3", { annotated: true });
      git(work, ["commit", "--allow-empty", "-m", "later"]);
      publishTag(work, "v1.2.3", { annotated: true, force: true });

      const result = runAssert(work, original, "v1.2.3");

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("::error::");
    });
  });

  it("fails when the tag is missing", async () => {
    await withRepo(async (work) => {
      const result = runAssert(work, head(work), "v9.9.9");

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("::error::");
    });
  });
});

describe("release checkout", () => {
  it("does not check out refs/tags in release.yml", async () => {
    const release = await readFile(releaseWorkflow, "utf8");
    const checkouts = checkoutBlocks(release);
    const packageJob = release.slice(release.indexOf("  package:\n"), release.indexOf("  e2e:\n"));

    expect(checkouts.length).toBeGreaterThan(0);
    for (const block of checkouts) {
      expect(block).not.toContain("refs/tags/");
    }
    expect(packageJob.indexOf("bash scripts/ci/assert-tag-sha.sh")).toBeGreaterThan(
      packageJob.indexOf("uses: actions/checkout@"),
    );
  });
});
