// Remote checks run before upload, so every server-side permission problem shows up in one run
// instead of one failed deploy at a time.
export function preflightScript({ targetDir, backupDir, tmpDir = "/tmp" }) {
  const q = shellQuote;
  return [
    "fail=0",
    `need() { if ! "$@"; then fail=1; fi; }`,
    `problem() { echo "preflight: $1" >&2; fail=1; }`,
    `parent() { dirname "$1"; }`,
    `writable_dir() { if [ -d "$1" ]; then [ -w "$1" ] || problem "$1 is not writable by $(id -un) (owner: $(stat -c %U "$1"))"; else return 1; fi; }`,
    // The deploy renames targetDir into the backup dir, then recreates it beside its old place.
    `T=${q(targetDir)}; B=${q(backupDir)}; U=${q(tmpDir)}`,
    `if [ -d "$T" ]; then writable_dir "$T"; fi`,
    `writable_dir "$(parent "$T")" || problem "$(parent "$T") does not exist"`,
    `if [ -d "$B" ]; then writable_dir "$B"; else writable_dir "$(parent "$B")" || problem "cannot create $B: $(parent "$B") does not exist"; fi`,
    `writable_dir "$U" || problem "$U does not exist"`,
    `command -v unzip >/dev/null || problem "unzip is not installed"`,
    `[ "$fail" = 0 ] || { echo "preflight failed: fix the server permissions above, then re-run." >&2; exit 1; }`,
    `echo "preflight ok"`,
  ].join("\n");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}
