// Check that system.zip in the current directory matches the checksum recorded in
// artifact-identity.json. Run from the directory that holds both files.
import { readFileSync } from "node:fs";
import { fileSha256 } from "../artifact-identity.mjs";

const identity = JSON.parse(readFileSync("artifact-identity.json", "utf8"));
const sha = fileSha256("system.zip");
if (identity.artifact?.sha256 !== sha) {
  console.error("Checksum mismatch");
  process.exit(6);
}
console.log("Will deploy", identity.commit, sha);
