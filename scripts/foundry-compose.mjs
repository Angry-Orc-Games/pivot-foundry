import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";

import { EXIT, SYSTEM_LINK_ENTRIES, composeNames, pinnedImageRef } from "./foundry-env.mjs";

export function dockerAvailable() {
  try {
    execFileSync("docker", ["info"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function requireDocker() {
  if (dockerAvailable()) return;
  console.error(
    "Docker is required for the Foundry v14 runtime. Install Docker Compose v2 and start the daemon.",
  );
  process.exit(EXIT.runtime);
}

export function writeComposeEnv(paths, result, { port, hotReload, preserveConfig, world } = {}) {
  const names = composeNames(paths);
  mkdirSync(paths.instanceRoot, { recursive: true });
  mkdirSync(paths.foundryData, { recursive: true });
  mkdirSync(join(paths.foundryData, "Data", "systems", "pivot-fantasy"), { recursive: true });
  mkdirSync(paths.distDir, { recursive: true });

  const lines = [
    `PIVOT_COMPOSE_PROJECT=${names.project}`,
    `PIVOT_FOUNDRY_IMAGE=${pinnedImageRef(paths.versions)}`,
    `PIVOT_FOUNDRY_CONTAINER=${names.container}`,
    `PIVOT_FOUNDRY_HOSTNAME=${names.hostname}`,
    `PIVOT_FOUNDRY_PORT=${port}`,
    `PIVOT_FOUNDRY_VERSION=${paths.versions.foundryVersion}`,
    `PIVOT_FOUNDRY_ROLE=${paths.role}`,
    `PIVOT_FOUNDRY_INSTANCE=${paths.instanceId}`,
    `PIVOT_REPO_ROOT=${paths.root}`,
    `PIVOT_FOUNDRY_DATA_DIR=${paths.foundryData}`,
    `PIVOT_FOUNDRY_DIST_DIR=${paths.distDir}`,
    `PIVOT_PRESERVE_CONFIG=${preserveConfig ? "true" : "false"}`,
    `PIVOT_HOT_RELOAD=${hotReload ? "true" : "false"}`,
    `PIVOT_FOUNDRY_WORLD=${world || ""}`,
    `FOUNDRY_ADMIN_KEY=${result.adminKey}`,
    `FOUNDRY_LICENSE_KEY=${result.licenseKey || ""}`,
    "",
  ];

  writeFileSync(paths.composeEnvFile, lines.join("\n"), { mode: 0o600 });
  return names;
}

export function writeRuntime(paths, names, port) {
  const runtime = {
    instanceId: paths.instanceId,
    role: paths.role,
    port,
    container: names.container,
    project: names.project,
    hostname: names.hostname,
    dataDir: paths.foundryData,
    baseUrl: `http://127.0.0.1:${port}`,
    image: pinnedImageRef(paths.versions),
    foundryVersion: paths.versions.foundryVersion,
    workdir: paths.root,
  };
  writeFileSync(paths.runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

export function readRuntime(paths) {
  if (!existsSync(paths.runtimeFile)) return null;
  return JSON.parse(readFileSync(paths.runtimeFile, "utf8"));
}

export function composeArgs(paths, extraFiles = []) {
  const files = ["-f", paths.composeFile, ...extraFiles.flatMap((file) => ["-f", file])];
  return [...files, "--env-file", paths.composeEnvFile];
}

export function compose(paths, args, { extraFiles = [], stdio = "inherit" } = {}) {
  return execFileSync("docker", ["compose", ...composeArgs(paths, extraFiles), ...args], {
    cwd: paths.root,
    stdio,
  });
}

export function ownedContainer(paths) {
  const names = composeNames(paths);
  try {
    const raw = execFileSync(
      "docker",
      [
        "inspect",
        names.container,
        "--format",
        "{{json .Config.Labels}} {{.State.Status}} {{range .NetworkSettings.Ports}}{{.}}{{end}}",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { name: names.container, raw };
  } catch {
    return null;
  }
}

export function inspectOwnership(paths) {
  const names = composeNames(paths);
  try {
    const raw = execFileSync(
      "docker",
      ["inspect", names.container, "--format", "{{json .Config.Labels}}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const labels = JSON.parse(raw);
    const owned =
      labels["com.angryorcgames.pivot.owned"] === "true" &&
      labels["com.angryorcgames.pivot.instance"] === paths.instanceId &&
      labels["com.angryorcgames.pivot.workdir"] === paths.root;
    return { labels, owned, name: names.container };
  } catch {
    return { labels: null, owned: false, name: names.container };
  }
}

export function assertOwned(paths) {
  const info = inspectOwnership(paths);
  if (!info.labels) return info;
  if (!info.owned) {
    console.error(
      `Container ${info.name} is not owned by this checkout/instance. Refusing to attach or stop it.`,
    );
    process.exit(EXIT.identity);
  }
  return info;
}

export async function allocatePort(preferred, { min, max }) {
  if (await isPortFree(preferred)) return preferred;
  for (let port = min; port <= max; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free loopback port in ${min}-${max}.`);
}

export function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = net.createServer();
    socket.once("error", () => resolve(false));
    socket.listen(port, "127.0.0.1", () => {
      socket.close(() => resolve(true));
    });
  });
}

export function pullImage(versions) {
  execFileSync("docker", ["pull", pinnedImageRef(versions)], { stdio: "inherit" });
}

export function prepareDevSystemDir(paths) {
  const systemDir = join(paths.foundryData, "Data", "systems", "pivot-fantasy");
  mkdirSync(systemDir, { recursive: true });
  for (const name of SYSTEM_LINK_ENTRIES) {
    const source = join(paths.root, name);
    if (!existsSync(source)) {
      mkdirSync(source, { recursive: true });
    }
  }
}

export function installPackagedSystem(paths, zipPath) {
  const systemDir = join(paths.foundryData, "Data", "systems", "pivot-fantasy");
  rmSync(systemDir, { force: true, recursive: true });
  mkdirSync(systemDir, { recursive: true });
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", systemDir], { stdio: "inherit" });
}

export function followLogs(paths) {
  const child = spawn("docker", ["compose", ...composeArgs(paths), "logs", "-f", "--tail", "100"], {
    cwd: paths.root,
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

export function collectDiagnostics(paths) {
  mkdirSync(paths.diagnosticsDir, { recursive: true });
  try {
    const logs = execFileSync(
      "docker",
      ["compose", ...composeArgs(paths), "logs", "--no-color", "--tail", "400"],
      {
        cwd: paths.root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    writeFileSync(join(paths.diagnosticsDir, "foundry.log"), redactDiagnostics(logs));
  } catch (error) {
    writeFileSync(
      join(paths.diagnosticsDir, "foundry.log"),
      redactDiagnostics(String(error.stdout || error.stderr || error.message)),
    );
  }
}

export function redactDiagnostics(text) {
  return String(text)
    .replaceAll(/FOUNDRY_LICENSE_KEY=\S+/g, "FOUNDRY_LICENSE_KEY=<redacted>")
    .replaceAll(/FOUNDRY_ADMIN_KEY=\S+/g, "FOUNDRY_ADMIN_KEY=<redacted>")
    .replaceAll(/FOUNDRY_RELEASE_URL=\S+/g, "FOUNDRY_RELEASE_URL=<redacted>")
    .replaceAll(/[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}/g, "<redacted-license>");
}

export async function waitForHttp(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return response.status;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => {
      const timer = globalThis.setTimeout(resolve, 1000);
      timer.unref?.();
    });
  }
  const error = new Error(`Timed out waiting for ${baseUrl} (${lastError}).`);
  error.code = "TIMEOUT";
  throw error;
}
