import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { writeArtifactIdentity } from "./artifact-identity.mjs";
import {
  EXIT,
  assertSafeTarget,
  cacheReady,
  createFoundryPaths,
  loadFoundryEnv,
  repoRoot,
  validateFoundryEnv,
} from "./foundry-env.mjs";
import { ensureDistribution } from "./foundry-dist.mjs";
import {
  allocatePort,
  assertOwned,
  collectDiagnostics,
  compose,
  inspectOwnership,
  installPackagedSystem,
  pullImage,
  requireDocker,
  waitForHttp,
  writeComposeEnv,
  writeRuntime,
} from "./foundry-compose.mjs";

const HTTP_TIMEOUT_MS = 120_000;
const PLAYWRIGHT_TIMEOUT_MS = 15 * 60 * 1000;

export async function runE2E(args = {}) {
  assertSafeTarget({
    target: process.env.PIVOT_FOUNDRY_TARGET || "e2e",
    baseUrl: process.env.PIVOT_FOUNDRY_BASE_URL,
    destructive: true,
    reset: true,
  });

  const paths = createFoundryPaths({
    root: repoRoot,
    role: "e2e",
    instanceId: typeof args.instance === "string" ? args.instance : undefined,
  });
  const env = loadFoundryEnv(paths.envFile);
  const result = validateFoundryEnv(env, {
    versions: paths.versions,
    cacheReady: cacheReady(paths.distDir, paths.versions),
    requireLicense: true,
    requireChecksum: process.env.PIVOT_REQUIRE_RELEASE_SHA256 === "1",
  });

  if (!result.ok) {
    for (const message of result.errors) console.error(message);
    return EXIT.credentials;
  }

  requireDocker();
  process.env.PIVOT_FOUNDRY_TARGET = "e2e";
  process.env.PIVOT_E2E_DESTRUCTIVE = "1";

  let started = false;

  const cleanup = () => {
    if (!started) return;
    try {
      collectDiagnostics(paths);
    } catch {
      // Keep cleanup going so an interrupted run still drops the instance.
    }
    try {
      if (inspectOwnership(paths).labels) {
        assertOwned(paths);
        compose(paths, ["down", "--remove-orphans", "--volumes"]);
      }
    } catch (error) {
      console.error(error.message || error);
    }
  };

  const onSignal = () => {
    cleanup();
    process.exit(EXIT.runtime);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    await ensureDistribution(paths, result, {
      requireChecksum: process.env.PIVOT_REQUIRE_RELEASE_SHA256 === "1",
    });
    pullImage(paths.versions);

    if (!args["skip-package"]) {
      console.log("Building the packaged system artifact for E2E.");
      execFileSync("npm", ["run", "package:system"], { cwd: paths.root, stdio: "inherit" });
    } else {
      console.log("Using the existing system.zip without rebuilding.");
    }
    const zipPath = join(paths.root, "system.zip");
    if (!existsSync(zipPath)) {
      console.error("system.zip was not produced.");
      return EXIT.identity;
    }

    const identity = writeArtifactIdentity(paths.root, { source: "e2e" });
    mkdirSync(paths.foundryData, { recursive: true });
    installPackagedSystem(paths, zipPath);

    const port =
      Number(process.env.PIVOT_FOUNDRY_PORT) ||
      (await allocatePort(paths.versions.ports.default, paths.versions.ports));
    const names = writeComposeEnv(paths, result, {
      port,
      hotReload: false,
      preserveConfig: false,
      world: "",
    });
    compose(paths, ["up", "-d", "--remove-orphans"]);
    started = true;
    const runtime = writeRuntime(paths, names, port);
    process.env.PIVOT_FOUNDRY_BASE_URL = runtime.baseUrl;
    process.env.PIVOT_FOUNDRY_INSTANCE = paths.instanceId;
    process.env.PIVOT_E2E_WORLD_ID = paths.versions.e2eWorldId;
    process.env.PIVOT_PACKAGE_VERSION = identity.packageVersion;
    process.env.PIVOT_FOUNDRY_VERSION = paths.versions.foundryVersion;
    process.env.PIVOT_FOUNDRY_ADMIN_KEY = result.adminKey;
    process.env.PIVOT_PLAYER_PASSWORD = process.env.PIVOT_PLAYER_PASSWORD || "e2e-player-local";

    console.log(`Waiting for Foundry HTTP on ${runtime.baseUrl} (not used as readiness).`);
    await waitForHttp(runtime.baseUrl, HTTP_TIMEOUT_MS);

    const ownership = inspectOwnership(paths);
    if (!ownership.owned) {
      console.error("Refusing to run E2E against a container this checkout does not own.");
      return EXIT.identity;
    }

    console.log("Running Playwright against the packaged system.");
    execFileSync("npx", ["playwright", "test", "--config", "e2e/playwright.config.ts"], {
      cwd: paths.root,
      stdio: "inherit",
      timeout: PLAYWRIGHT_TIMEOUT_MS,
      env: {
        ...process.env,
        PIVOT_FOUNDRY_BASE_URL: runtime.baseUrl,
        PIVOT_FOUNDRY_TARGET: "e2e",
        PIVOT_E2E_DESTRUCTIVE: "1",
      },
    });

    writeFileSync(
      join(paths.diagnosticsDir, "e2e-summary.json"),
      `${JSON.stringify({ ok: true, identity, runtime }, null, 2)}\n`,
    );
    console.log("Foundry E2E passed.");
    return EXIT.ok;
  } catch (error) {
    const exitCode = error.code === "TIMEOUT" ? EXIT.timeout : EXIT.tests;
    console.error(error.message || error);
    try {
      collectDiagnostics(paths);
      console.error(`Diagnostics written to ${paths.diagnosticsDir}`);
    } catch {
      // The original test/runtime failure is more useful than a diagnostics write error.
    }
    return exitCode;
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    cleanup();
  }
}
