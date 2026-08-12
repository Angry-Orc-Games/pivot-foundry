import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const outputPath = join(root, "system.zip");
const requiredDirs = ["dist", "lang", "packs", "templates"];
const requiredFiles = ["system.json"];

execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });

const manifest = JSON.parse(await readFile(join(root, "system.json"), "utf8"));
validateManifest(manifest);

const stageRoot = await mkdtemp(join(tmpdir(), "pivot-foundry-package-"));
const stage = join(stageRoot, "system");

try {
  await mkdir(stage, { recursive: true });

  for (const file of requiredFiles) {
    await cp(join(root, file), join(stage, file));
  }

  for (const dir of requiredDirs) {
    const source = join(root, dir);
    const target = join(stage, dir);

    if (existsSync(source)) {
      await cp(source, target, { recursive: true });
    } else {
      await mkdir(target, { recursive: true });
    }
  }

  validateManifestPaths(stage, manifest);

  await rm(outputPath, { force: true });
  execFileSync("zip", ["-r", outputPath, ...requiredFiles, ...requiredDirs], {
    cwd: stage,
    stdio: "inherit",
  });
  execFileSync("unzip", ["-t", outputPath], { stdio: "inherit" });

  const entries = execFileSync("unzip", ["-Z1", outputPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  for (const entry of ["system.json", "dist/pivot.mjs", "lang/en.json"]) {
    if (!entries.includes(entry)) {
      throw new Error(`system.zip is missing required entry: ${entry}`);
    }
  }
} finally {
  await rm(stageRoot, { force: true, recursive: true });
}

function validateManifest(manifest) {
  if (manifest.id !== "pivot-fantasy") {
    throw new Error('system.json id must be "pivot-fantasy".');
  }

  if (!Array.isArray(manifest.esmodules) || manifest.esmodules.length === 0) {
    throw new Error("system.json must declare at least one esmodule.");
  }

  if (!Array.isArray(manifest.languages) || manifest.languages.length === 0) {
    throw new Error("system.json must declare at least one language.");
  }

  if (typeof manifest.download !== "string" || !manifest.download.endsWith("/system.zip")) {
    throw new Error("system.json download must point to system.zip.");
  }
}

function validateManifestPaths(stage, manifest) {
  for (const modulePath of manifest.esmodules) {
    assertPackagePath(stage, modulePath, "esmodule");
  }

  for (const language of manifest.languages) {
    assertPackagePath(stage, language.path, "language");
  }
}

function assertPackagePath(stage, packagePath, label) {
  if (typeof packagePath !== "string" || packagePath.length === 0) {
    throw new Error(`Invalid ${label} path in system.json.`);
  }

  if (packagePath.includes("..") || packagePath.startsWith("/") || basename(packagePath) === "") {
    throw new Error(`Unsafe ${label} path in system.json: ${packagePath}`);
  }

  if (!existsSync(join(stage, packagePath))) {
    throw new Error(`Missing ${label} path referenced by system.json: ${packagePath}`);
  }
}
