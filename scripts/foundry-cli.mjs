import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  EXIT,
  assertSafeTarget,
  cacheReady,
  createFoundryPaths,
  loadFoundryEnv,
  pinnedImageRef,
  repoRoot,
  resolveRole,
  resolveTarget,
  retiredLocations,
  validateFoundryEnv,
} from "./foundry-env.mjs";
import { ensureDistribution } from "./foundry-dist.mjs";
import {
  allocatePort,
  assertOwned,
  compose,
  dockerAvailable,
  followLogs,
  inspectOwnership,
  prepareDevSystemDir,
  pullImage,
  readRuntime,
  requireDocker,
  waitForHttp,
  writeComposeEnv,
  writeRuntime,
} from "./foundry-compose.mjs";
import { runE2E } from "./foundry-e2e.mjs";

const command = process.argv[2] ?? "help";
const args = parseArgs(process.argv.slice(3));

try {
  await main();
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error(error.message);
    process.exit(EXIT.credentials);
  }
  if (error?.code === "UNSAFE_TARGET") {
    console.error(error.message);
    process.exit(EXIT.unsafe);
  }
  if (error?.code === "TIMEOUT") {
    console.error(error.message);
    process.exit(EXIT.timeout);
  }
  console.error(error.message || error);
  process.exit(error.exitCode || EXIT.runtime);
}

async function main() {
  if (command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "check-env") {
    checkEnv({ requireRuntime: false });
    return;
  }

  if (command === "doctor") {
    doctor();
    return;
  }

  if (command === "provision") {
    await provision();
    return;
  }

  if (command === "up") {
    await up();
    return;
  }

  if (command === "status") {
    await status();
    return;
  }

  if (command === "logs") {
    logs();
    return;
  }

  if (command === "down") {
    down();
    return;
  }

  if (command === "reset") {
    reset();
    return;
  }

  if (command === "e2e") {
    process.exit(await runE2E(args));
  }

  console.error(
    "Usage: node scripts/foundry-cli.mjs <check-env|doctor|provision|up|status|logs|down|reset|e2e>",
  );
  process.exit(EXIT.usage);
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (const item of argv) {
    if (item.startsWith("--")) {
      const [key, value] = item.slice(2).split("=");
      parsed[key] = value ?? true;
    } else {
      parsed._.push(item);
    }
  }
  return parsed;
}

function context(overrides = {}) {
  const role = overrides.role || args.role || resolveRole();
  const paths = createFoundryPaths({ root: repoRoot, role, instanceId: args.instance });
  const versions = paths.versions;
  const env = loadFoundryEnv(paths.envFile);
  return { role, paths, versions, env };
}

function checkEnv({ requireRuntime, requireLicense = false } = {}) {
  const { paths, env, versions } = context();
  const result = validateFoundryEnv(env, {
    versions,
    cacheReady: cacheReady(paths.distDir, versions),
    requireLicense,
    requireChecksum: process.env.PIVOT_REQUIRE_RELEASE_SHA256 === "1",
  });

  if (!result.ok) {
    for (const message of result.errors) console.error(message);
    process.exit(EXIT.credentials);
  }

  for (const message of result.warnings) console.log(`Warning: ${message}`);

  if (requireRuntime) requireDocker();

  console.log(
    `Foundry env check passed: v${versions.foundryVersion} / ${pinnedImageRef(versions).split("@")[0]}.`,
  );
  if (cacheReady(paths.distDir, versions)) {
    console.log(`Distribution cache is present: ${versions.cacheFileName}.`);
  } else {
    console.log("Distribution cache will be populated on provision.");
  }
  return result;
}

function doctor() {
  const { paths, versions } = context();
  const result = checkEnv({ requireRuntime: false });
  console.log(`Instance: ${paths.instanceId} (${paths.role})`);
  console.log(`Persistent data: ${paths.foundryData}`);
  console.log(`Distribution cache: ${paths.distDir}`);
  console.log(`Pinned image: ${pinnedImageRef(versions)}`);
  console.log(`Docker: ${dockerAvailable() ? "available" : "not available"}`);
  for (const retired of retiredLocations(paths.root)) {
    console.log(
      `Retired ${retired.name}: ${retired.present ? `present at ${retired.path} (not used)` : "absent"}`,
    );
  }
  return result;
}

async function provision() {
  const { paths } = context();
  const result = checkEnv({
    requireRuntime: true,
    requireLicense: false,
  });
  await ensureDistribution(paths, result, {
    requireChecksum: process.env.PIVOT_REQUIRE_RELEASE_SHA256 === "1",
  });
  pullImage(paths.versions);
  console.log("Foundry runtime provisioned.");
}

async function up() {
  const { paths, role } = context();
  const result = checkEnv({ requireRuntime: true, requireLicense: false });
  await ensureDistribution(paths, result);
  pullImage(paths.versions);

  const existing = inspectOwnership(paths);
  if (existing.labels && existing.owned) {
    const runtime = readRuntime(paths);
    console.log(`Foundry is already running at ${runtime?.baseUrl || "the owned instance"}.`);
    return;
  }
  if (existing.labels && !existing.owned) {
    assertOwned(paths);
  }

  const port =
    Number(process.env.PIVOT_FOUNDRY_PORT) ||
    (await allocatePort(paths.versions.ports.default, paths.versions.ports));
  const names = writeComposeEnv(paths, result, {
    port,
    hotReload: role === "dev",
    preserveConfig: role === "dev",
    world: process.env.PIVOT_FOUNDRY_WORLD || "",
  });
  prepareDevSystemDir(paths);
  if (role === "dev" && !existsSync(join(paths.root, "dist", "pivot.mjs"))) {
    console.log("Warning: dist/pivot.mjs is missing. Run npm run build before opening a world.");
  }

  const extraFiles = role === "dev" ? [paths.composeDevFile] : [];
  compose(paths, ["up", "-d", "--remove-orphans"], { extraFiles });
  const runtime = writeRuntime(paths, names, port);
  console.log(`Foundry v${paths.versions.foundryVersion} started at ${runtime.baseUrl}.`);
  console.log("Bound to 127.0.0.1 with UPnP and IP discovery disabled.");
  if (!result.licenseKey) {
    console.log("If this is the first launch, enter FOUNDRY_LICENSE_KEY in the setup UI.");
  }
}

async function status() {
  const { paths } = context();
  const runtime = readRuntime(paths);
  const ownership = inspectOwnership(paths);
  if (!ownership.labels) {
    console.log(`Foundry instance ${paths.instanceId} is not running.`);
    process.exit(EXIT.runtime);
  }
  if (!ownership.owned) {
    assertOwned(paths);
  }
  console.log(`Instance ${paths.instanceId} (${paths.role})`);
  console.log(`Container ${ownership.name}`);
  if (runtime) {
    console.log(`URL ${runtime.baseUrl}`);
    try {
      const statusCode = await waitForHttp(runtime.baseUrl, 3000);
      console.log(`HTTP ${statusCode} (page load is not world readiness)`);
    } catch {
      console.log("HTTP not ready yet.");
    }
  }
}

function logs() {
  const { paths } = context();
  requireDocker();
  assertOwned(paths);
  followLogs(paths);
}

function down() {
  const { paths } = context();
  requireDocker();
  const ownership = inspectOwnership(paths);
  if (!ownership.labels) {
    console.log("Foundry is not running.");
    return;
  }
  assertOwned(paths);
  compose(paths, ["down", "--remove-orphans"]);
  console.log(`Stopped owned instance ${paths.instanceId}.`);
}

function reset() {
  const { paths, role } = context({ role: args.role || "e2e" });
  requireDocker();
  assertSafeTarget({
    target: resolveTarget(),
    baseUrl: process.env.PIVOT_FOUNDRY_BASE_URL,
    reset: true,
    destructive: true,
  });
  if (role !== "e2e") {
    console.error(
      "foundry:reset only clears disposable E2E data. Persistent foundry-data-v14 is left alone.",
    );
    process.exit(EXIT.unsafe);
  }
  const ownership = inspectOwnership(paths);
  if (ownership.labels) {
    assertOwned(paths);
    compose(paths, ["down", "--remove-orphans", "--volumes"]);
  }
  rmSync(paths.foundryData, { force: true, recursive: true });
  console.log(
    `Reset disposable E2E data for ${paths.instanceId}. Distribution cache was preserved.`,
  );
}

function printHelp() {
  console.log(`Pivot Foundry v14 commands
  npm run foundry:check-env   Validate credentials and version pins
  npm run foundry:doctor      Print instance, cache, Docker, and retired-data diagnostics
  npm run foundry:provision   Verify cache checksum and pull the pinned image
  npm run foundry:up          Start the persistent local development world
  npm run foundry:status      Show owned-instance status
  npm run foundry:logs        Follow owned-instance logs
  npm run foundry:down        Stop the owned development instance
  npm run foundry:reset       Reset disposable E2E data only
  npm run foundry:e2e         Provision, test the packaged system, and clean up`);
}
