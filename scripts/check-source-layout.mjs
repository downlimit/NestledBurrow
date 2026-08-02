import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT_FILES = new Set(["src/main.js", "src/style.css"]);
const OWNER_DIRECTORIES = new Set([
  "assets",
  "audio",
  "build",
  "character",
  "combat",
  "controls",
  "devtools",
  "facilities",
  "interaction",
  "inventory",
  "localization",
  "needs",
  "resources",
  "session",
  "tavern",
  "ui",
  "world",
]);
const GENERIC_DIRECTORIES = new Set([
  "common",
  "shared",
  "misc",
  "utils",
  "core",
  "runtime",
  "domain",
  "config",
]);

const trackedSourceFiles = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .map(toPosixPath)
  .sort();
const trackedSourceSet = new Set(trackedSourceFiles);

for (const repositoryPath of trackedSourceFiles) {
  const segments = repositoryPath.split("/");
  if (segments.length === 2) {
    assert(ROOT_FILES.has(repositoryPath), `${repositoryPath} is not allowed directly under src/`);
    continue;
  }

  assert(OWNER_DIRECTORIES.has(segments[1]), `${repositoryPath} uses an unapproved src owner directory`);
  for (const directory of segments.slice(1, -1)) {
    assert(!GENERIC_DIRECTORIES.has(directory.toLowerCase()), `${repositoryPath} uses forbidden generic directory ${directory}`);
  }

  if (path.posix.basename(repositoryPath) === "index.js") {
    assert.equal(repositoryPath, "src/localization/index.js", `${repositoryPath} is an unapproved barrel module`);
  }
}

const trackedJavaScript = trackedSourceFiles.filter((repositoryPath) => repositoryPath.endsWith(".js"));
const caseInsensitiveSourceMap = new Map(trackedSourceFiles.map((repositoryPath) => [repositoryPath.toLowerCase(), repositoryPath]));

for (const importer of trackedJavaScript) {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(importer, "utf8"));
  for (const specifier of relativeJavaScriptSpecifiers(source)) {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
    if (trackedSourceSet.has(resolved)) continue;

    const caseInsensitiveMatch = caseInsensitiveSourceMap.get(resolved.toLowerCase());
    assert(!caseInsensitiveMatch, `${importer} imports ${specifier} with incorrect case; tracked path is ${caseInsensitiveMatch}`);
    assert.fail(`${importer} imports unresolved JavaScript module ${specifier} (${resolved})`);
  }
}

console.log(`source layout passed: ${trackedSourceFiles.length} tracked files, ${trackedJavaScript.length} JavaScript modules`);

function relativeJavaScriptSpecifiers(source) {
  const specifiers = [];
  const pattern = /["']((?:\.\.?\/)+[^"']+\.js)["']/g;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers.sort();
}

function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}
