import { execFileSync, spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  FOUNDRY_PORT,
  SYSTEM_ID,
  SYSTEM_LINK_ENTRIES,
  createFoundryPaths,
  isFoundryInstalled,
  loadFoundryEnv,
  repoRoot,
  resolveFoundryEntry,
  validateFoundryEnv,
} from "./foundry-env.mjs";

const command = process.argv[2] ?? "up";
const paths = createFoundryPaths(repoRoot);
const pidFile = join(paths.foundryData, "foundry.pid");
const hostLogFile = join(paths.foundryData, "Logs", "host.log");

if (command === "up") {
  await startFoundry();
} else if (command === "down") {
  stopFoundry();
} else if (command === "logs") {
  followLogs();
} else {
  console.error("Usage: node scripts/foundry-host.mjs <up|down|logs>");
  process.exit(1);
}

async function startFoundry() {
  const env = loadEnvOrExit();
  const result = validateFoundryEnv(env, {
    foundryInstalled: isFoundryInstalled(paths.foundryApp),
  });
  exitIfInvalid(result);

  const nodePath = resolveFoundryNode(result.foundryNode);
  await ensureFoundryInstall(result);
  prepareDataLayout();
  writeFoundryOptions();
  linkPivotFantasySystem();
  warnIfSystemUnbuilt();

  const runningPid = readRunningPid();
  if (runningPid) {
    console.log(
      `Foundry is already running (pid ${runningPid}) at http://127.0.0.1:${FOUNDRY_PORT}.`,
    );
    return;
  }

  clearStaleLocks();

  const entry = resolveFoundryEntry(paths.foundryApp);
  if (!entry) {
    console.error("Foundry v14 Node.js install is missing main.js.");
    process.exit(1);
  }

  mkdirSync(join(paths.foundryData, "Logs"), { recursive: true });
  const logFd = openSync(hostLogFile, "a");
  const args = [
    entry,
    `--dataPath=${paths.foundryData}`,
    `--port=${FOUNDRY_PORT}`,
    `--adminPassword=${result.adminKey}`,
    "--hotReload",
    "--noupnp",
    "--noipdiscovery",
  ];

  const child = spawn(nodePath, args, {
    cwd: paths.foundryApp,
    detached: true,
    env: {
      ...process.env,
      TZ: process.env.TZ || "America/New_York",
    },
    stdio: ["ignore", logFd, logFd],
  });

  try {
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("spawn", resolve);
    });
  } catch {
    console.error("Foundry failed to start. Check that Node 24 can launch foundry-app/main.js.");
    process.exit(1);
  }

  if (!child.pid) {
    console.error("Foundry failed to start (no pid).");
    process.exit(1);
  }

  writeFileSync(pidFile, `${child.pid}\n`);
  child.unref();

  console.log(`Foundry v14 started (pid ${child.pid}) at http://127.0.0.1:${FOUNDRY_PORT}.`);
  console.log("Use npm run foundry:logs to follow output, npm run foundry:down to stop.");
  if (result.licenseKey) {
    console.log(
      "If this is the first launch, paste FOUNDRY_LICENSE_KEY into the Foundry setup license screen.",
    );
  } else {
    console.log("If this is the first launch, enter your Foundry license key in the setup UI.");
  }
}

function stopFoundry() {
  const pid = readPid();
  if (!pid) {
    console.log("Foundry is not running.");
    return;
  }

  if (!isPidRunning(pid)) {
    unlinkPid();
    console.log("Foundry is not running.");
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      console.error(`Could not stop Foundry pid ${pid}.`);
      process.exit(1);
    }
  }

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && isPidRunning(pid)) {
    execFileSync("sleep", ["0.1"]);
  }

  if (isPidRunning(pid)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      process.kill(pid, "SIGKILL");
    }
  }

  unlinkPid();
  console.log(`Stopped Foundry (pid ${pid}).`);
}

function followLogs() {
  if (!existsSync(hostLogFile)) {
    console.error("No Foundry host log yet. Start the server with npm run foundry:up.");
    process.exit(1);
  }

  const child = spawn("tail", ["-n", "+1", "-f", hostLogFile], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

function loadEnvOrExit() {
  try {
    return loadFoundryEnv(paths.envFile);
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.error(error.message);
      process.exit(1);
    }

    throw error;
  }
}

function exitIfInvalid(result) {
  if (result.ok) return;

  for (const message of result.errors) {
    console.error(message);
  }
  process.exit(1);
}

function resolveFoundryNode(configuredPath) {
  if (configuredPath) {
    assertNode24(configuredPath, "FOUNDRY_NODE");
    return configuredPath;
  }

  if (nodeMajor(process.execPath) === 24) {
    return process.execPath;
  }

  const nvmNode = findNvmNode24({ install: true });
  if (nvmNode) {
    assertNode24(nvmNode, "nvm Node 24");
    return nvmNode;
  }

  console.error("Foundry v14 requires Node 24 for the host process.");
  console.error("Install Node 24 (nvm install 24) or set FOUNDRY_NODE to that binary.");
  console.error("Repository checks such as npm run verify can stay on Node 20 or 22.");
  process.exit(1);
}

function findNvmNode24({ install }) {
  const nvmDir = process.env.NVM_DIR || join(homedir(), ".nvm");
  const nvmSh = join(nvmDir, "nvm.sh");
  if (!existsSync(nvmSh)) {
    return null;
  }

  const existing = newestNvmNode24(join(nvmDir, "versions", "node"));
  if (existing) return existing;
  if (!install) return null;

  try {
    const output = execFileSync(
      "bash",
      [
        "-lc",
        `export NVM_DIR=${shellQuote(nvmDir)}; . "$NVM_DIR/nvm.sh"; nvm install 24 >/dev/null; nvm which 24`,
      ],
      { encoding: "utf8" },
    ).trim();
    const line = output.split(/\r?\n/).at(-1)?.trim();
    return line || null;
  } catch {
    return null;
  }
}

function newestNvmNode24(versionsDir) {
  if (!existsSync(versionsDir)) return null;

  const versions = readdirSync(versionsDir)
    .filter((name) => /^v24\./.test(name))
    .sort();
  const latest = versions.at(-1);
  if (!latest) return null;

  const nodePath = join(versionsDir, latest, "bin", "node");
  return existsSync(nodePath) ? nodePath : null;
}

function assertNode24(nodePath, label) {
  const major = nodeMajor(nodePath);
  if (major === 24) return;

  console.error(`${label} must be Node 24 (found ${major ?? "unknown"}).`);
  process.exit(1);
}

function nodeMajor(nodePath) {
  try {
    const version = execFileSync(nodePath, ["-p", "process.versions.node"], {
      encoding: "utf8",
    }).trim();
    const match = /^(\d+)/.exec(version);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function ensureFoundryInstall(result) {
  if (isFoundryInstalled(paths.foundryApp)) {
    return;
  }

  mkdirSync(paths.foundryApp, { recursive: true });
  const stage = await mkdtemp(join(tmpdir(), "pivot-foundry-node-"));

  try {
    const zipPath = result.releaseArchive || join(stage, "FoundryVTT-Node-14.zip");
    if (!result.releaseArchive) {
      console.log("Downloading Foundry v14 Node.js archive into foundry-app/.");
      await downloadRelease(result.releaseUrl, zipPath);
    } else {
      console.log("Installing Foundry v14 Node.js archive into foundry-app/.");
    }

    extractFoundryArchive(zipPath, paths.foundryApp);
  } finally {
    await rm(stage, { force: true, recursive: true });
  }

  if (!isFoundryInstalled(paths.foundryApp)) {
    console.error("Extracted archive is not a Foundry v14 Node.js install (missing main.js).");
    process.exit(1);
  }
}

async function downloadRelease(url, dest) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok || !response.body) {
      throw new Error(`status ${response.status}`);
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
  } catch {
    console.error("Foundry download failed. Generate a fresh v14 Node.js timed URL and retry.");
    process.exit(1);
  }
}

function extractFoundryArchive(zipPath, destDir) {
  const extractDir = join(destDir, ".extract");
  rmSync(extractDir, { force: true, recursive: true });
  mkdirSync(extractDir, { recursive: true });

  try {
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", extractDir], { stdio: "pipe" });
  } catch {
    console.error("Could not unzip the Foundry archive. Use a FoundryVTT-Node-14 zip.");
    process.exit(1);
  }

  const sourceDir = findExtractedFoundryRoot(extractDir);
  if (!sourceDir) {
    rmSync(extractDir, { force: true, recursive: true });
    console.error("Extracted archive is not a Foundry v14 Node.js install (missing main.js).");
    process.exit(1);
  }

  for (const name of readdirSync(sourceDir)) {
    const from = join(sourceDir, name);
    const to = join(destDir, name);
    rmSync(to, { force: true, recursive: true });
    renameSync(from, to);
  }

  rmSync(extractDir, { force: true, recursive: true });
}

function findExtractedFoundryRoot(extractDir) {
  if (resolveFoundryEntry(extractDir)) return extractDir;

  const children = readdirSync(extractDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  if (children.length === 1) {
    const nested = join(extractDir, children[0].name);
    if (resolveFoundryEntry(nested)) return nested;
  }

  return null;
}

function prepareDataLayout() {
  mkdirSync(join(paths.foundryData, "Config"), { recursive: true });
  mkdirSync(join(paths.foundryData, "Data", "systems"), { recursive: true });
  mkdirSync(join(paths.foundryData, "Logs"), { recursive: true });
}

function writeFoundryOptions() {
  const optionsPath = join(paths.foundryData, "Config", "options.json");
  let existing = {};

  if (existsSync(optionsPath)) {
    try {
      existing = JSON.parse(readFileSync(optionsPath, "utf8"));
    } catch {
      existing = {};
    }
  }

  const next = {
    ...existing,
    port: FOUNDRY_PORT,
    upnp: false,
    hotReload: true,
    telemetry: false,
  };

  writeFileSync(optionsPath, `${JSON.stringify(next, null, 2)}\n`);
}

function linkPivotFantasySystem() {
  const systemsDir = join(paths.foundryData, "Data", "systems");
  const systemDir = join(systemsDir, SYSTEM_ID);

  if (existsSync(systemDir) && lstatSync(systemDir).isSymbolicLink()) {
    unlinkSync(systemDir);
  }

  mkdirSync(systemDir, { recursive: true });

  for (const name of SYSTEM_LINK_ENTRIES) {
    const target = join(systemDir, name);
    rmSync(target, { force: true, recursive: true });
    symlinkSync(join(paths.root, name), target);
  }
}

function warnIfSystemUnbuilt() {
  if (!existsSync(join(paths.root, "dist", "pivot.mjs"))) {
    console.log("Warning: dist/pivot.mjs is missing. Run npm run build before opening a world.");
  }
}

function readPid() {
  if (!existsSync(pidFile)) return null;

  const raw = readFileSync(pidFile, "utf8").trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function readRunningPid() {
  const pid = readPid();
  if (!pid) return null;
  if (isPidRunning(pid)) return pid;
  unlinkPid();
  return null;
}

function unlinkPid() {
  try {
    unlinkSync(pidFile);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function isPidRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function clearStaleLocks() {
  const configDir = join(paths.foundryData, "Config");
  if (!existsSync(configDir)) return;

  for (const name of readdirSync(configDir)) {
    if (name.endsWith(".lock") && !readRunningPid()) {
      unlinkSync(join(configDir, name));
    }
  }
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
