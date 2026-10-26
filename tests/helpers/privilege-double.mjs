import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

const tempRoot = resolve(tmpdir());
let sudoStatus;

// When passwordless sudo works, commands are delegated so CI keeps the real privileged path.
// Without it, the double performs those commands inside a temp sandbox and never calls sudo.
function canUseSudo() {
  if (sudoStatus !== undefined) return sudoStatus;
  try {
    execFileSync("sudo", ["-n", "true"], { stdio: "ignore" });
    sudoStatus = true;
  } catch {
    sudoStatus = false;
  }
  return sudoStatus;
}

function isUnder(root, path) {
  const full = resolve(path);
  return full === root || full.startsWith(`${root}${sep}`);
}

function assertUnderTemp(path) {
  const full = resolve(path);
  if (!isUnder(tempRoot, full) || full === tempRoot) {
    throw new Error(`Refusing to touch a path outside the temp directory: ${full}`);
  }
  return full;
}

export function removeSandbox(root) {
  const full = assertUnderTemp(root);
  if (!existsSync(full)) return;
  if (canUseSudo()) {
    try {
      execFileSync("sudo", ["-n", "chmod", "-R", "a+rwx", full], { stdio: "ignore" });
    } catch {
      // The tree may already be gone, or sudo failed after the probe.
    }
  }
  try {
    execFileSync("chmod", ["-R", "a+rwx", full], { stdio: "ignore" });
  } catch {
    // Root-owned files are removed after the sudo chmod above.
  }
  rmSync(full, { recursive: true, force: true });
}

function modeBits(path) {
  return statSync(path).mode & 0o777;
}

export function createPrivilegeDouble(sandbox) {
  const root = assertUnderTemp(sandbox);
  const realSudo = canUseSudo();
  const owners = new Map();

  function assertInside(path) {
    const full = resolve(path);
    if (!isUnder(root, full)) {
      throw new Error(`Refusing privileged test command outside sandbox: ${full}`);
    }
    return full;
  }

  function setOwner(path, uid, gid) {
    owners.set(assertInside(path), { uid, gid });
  }

  function walk(path, visit) {
    const full = assertInside(path);
    visit(full);
    let info;
    try {
      info = lstatSync(full);
    } catch {
      return;
    }
    if (!info.isDirectory()) return;
    for (const name of readdirSync(full)) {
      walk(join(full, name), visit);
    }
  }

  function ownerOf(path) {
    return owners.get(resolve(path));
  }

  function treeOwnedByRoot(path, recursive) {
    let ownedByRoot = false;
    const check = (entry) => {
      if (ownerOf(entry)?.uid === 0) ownedByRoot = true;
    };
    if (recursive) walk(path, check);
    else check(resolve(path));
    return ownedByRoot;
  }

  function parseChown(args) {
    const rest = [...args];
    const recursive = rest[0] === "-R";
    if (recursive) rest.shift();
    const spec = rest[0];
    const target = rest[1];
    if (!spec || !target || spec.startsWith("-")) {
      throw new Error(`Unsupported chown arguments: ${args.join(" ")}`);
    }
    const [uidText, gidText] = spec.split(":");
    const uid = Number(uidText);
    const gid = Number(gidText);
    if (!Number.isInteger(uid) || !Number.isInteger(gid)) {
      throw new Error(`Unsupported chown owner spec: ${spec}`);
    }
    return { recursive, uid, gid, target: assertInside(target) };
  }

  function applyChown(args) {
    const parsed = parseChown(args);
    const assign = (path) => setOwner(path, parsed.uid, parsed.gid);
    if (parsed.recursive) walk(parsed.target, assign);
    else assign(parsed.target);
  }

  function operationNotPermitted(target) {
    const error = new Error(`chown: changing ownership of '${target}': Operation not permitted`);
    error.code = "EPERM";
    error.status = 1;
    error.stderr = `${error.message}\n`;
    return error;
  }

  function withWritableParent(target, fn) {
    const full = assertInside(target);
    const parent = dirname(full);
    if (!isUnder(root, parent)) return fn();
    const mode = modeBits(parent);
    chmodSync(parent, mode | 0o700);
    try {
      return fn();
    } finally {
      if (existsSync(parent)) chmodSync(parent, mode);
    }
  }

  function emulateSudo(args, options) {
    const rest = [...args];
    while (rest[0] === "-n" || rest[0] === "--") rest.shift();
    const [command, ...commandArgs] = rest;
    if (command === "chown") {
      applyChown(commandArgs);
      return "";
    }
    if (command === "chmod") {
      assertInside(commandArgs.at(-1));
      return execFileSync(command, commandArgs, options);
    }
    if (command === "rm") {
      const target = assertInside(commandArgs.at(-1));
      withWritableParent(target, () => {
        if (existsSync(target)) {
          execFileSync("chmod", ["-R", "u+rwx", target], { stdio: "ignore" });
        }
        rmSync(target, { recursive: true, force: true });
      });
      return "";
    }
    if (command === "mkdir") {
      const target = assertInside(commandArgs.at(-1));
      withWritableParent(target, () => {
        mkdirSync(target, { recursive: true });
      });
      // A root mkdir leaves a directory the invoking user cannot write.
      chmodSync(target, 0o555);
      setOwner(target, 0, 0);
      return "";
    }
    if (command === "unzip") {
      const destIndex = commandArgs.indexOf("-d");
      const dest = commandArgs[destIndex + 1];
      const archive = commandArgs[destIndex - 1];
      if (!dest || !archive || archive.startsWith("-")) {
        throw new Error(`Unsupported unzip arguments: ${commandArgs.join(" ")}`);
      }
      assertUnderTemp(archive);
      assertInside(dest);
      const mode = modeBits(dest);
      chmodSync(dest, mode | 0o700);
      try {
        execFileSync("unzip", commandArgs, options);
      } finally {
        if (existsSync(dest)) chmodSync(dest, mode);
      }
      walk(dest, (path) => setOwner(path, 0, 0));
      return "";
    }
    if (command === "mv") {
      const dest = assertInside(commandArgs.at(-1));
      const source = commandArgs.at(-2);
      assertUnderTemp(source);
      withWritableParent(dest, () => {
        if (existsSync(dest)) chmodSync(dest, 0o644);
        return execFileSync("mv", commandArgs, options);
      });
      return "";
    }
    throw new Error(`Unsupported privileged command: ${command}`);
  }

  function emulateUnprivilegedChown(args, options) {
    const parsed = parseChown(args);
    if (treeOwnedByRoot(parsed.target, parsed.recursive)) {
      throw operationNotPermitted(parsed.target);
    }
    const result = execFileSync("chown", args, options);
    applyChown(args);
    return result;
  }

  function guardCommand(command, args = []) {
    const list = args ?? [];
    if (command === "sudo") {
      const rest = [...list];
      while (rest[0] === "-n" || rest[0] === "--") rest.shift();
      if (!rest.length) return;
      guardCommand(rest[0], rest.slice(1));
      return;
    }
    if (command === "mv") {
      assertUnderTemp(list.at(-2));
      assertInside(list.at(-1));
      return;
    }
    if (command === "unzip") {
      const destIndex = list.indexOf("-d");
      const dest = list[destIndex + 1];
      const archive = list[destIndex - 1];
      if (destIndex < 0 || !dest || !archive || archive.startsWith("-")) {
        throw new Error(`Unsupported unzip arguments: ${list.join(" ")}`);
      }
      assertUnderTemp(archive);
      assertInside(dest);
      return;
    }
    if (command === "chown") {
      parseChown(list);
      return;
    }
    if (command === "chmod" || command === "rm" || command === "mkdir") {
      assertInside(list.at(-1));
    }
  }

  return {
    execFileSync(command, args, options) {
      guardCommand(command, args);
      if (realSudo) return execFileSync(command, args, options);
      if (command === "sudo") return emulateSudo(args, options);
      if (command === "chown") return emulateUnprivilegedChown(args, options);
      return execFileSync(command, args, options);
    },
    statSync(path) {
      const info = statSync(path);
      const owner = ownerOf(path);
      if (!owner) return info;
      return new Proxy(info, {
        get(target, prop, receiver) {
          if (prop === "uid") return owner.uid;
          if (prop === "gid") return owner.gid;
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
}
