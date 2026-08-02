import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ownerManifest = Object.freeze({
  world: ["worldLocationRuntime.js", "worldPresentationRuntime.js"],
  interaction: ["worldInteractionCoordinator.js"],
  build: ["worldBuildCoordinator.js"],
  needs: [
    "interactionTimelineRuntime.js",
    "needsDomain.js",
    "needsFlowRuntime.js",
    "needsInteractionCoordinator.js",
    "needsRuntime.js",
    "toiletAccidentTimelineRuntime.js",
  ],
  resources: [
    "debrisConfig.js",
    "debrisRuntime.js",
    "farmingConfig.js",
    "farmingDomain.js",
    "farmingRuntime.js",
    "resourceConfig.js",
    "resourceDomain.js",
    "resourceVisuals.js",
  ],
  tavern: [
    "cookingDomain.js",
    "cookingRuntime.js",
    "guestConfig.js",
    "guestRuntime.js",
    "kitchenInteractionRuntime.js",
    "tavernServiceDomain.js",
    "tavernServiceRuntime.js",
    "tavernSignRuntime.js",
  ],
});

const productionJavaScript = discoverFiles("src", (repositoryPath) => repositoryPath.endsWith(".js"));
const rootJavaScript = productionJavaScript.filter((repositoryPath) => path.posix.dirname(repositoryPath) === "src");
assert.deepEqual(rootJavaScript, ["src/main.js"], "only the bundler entry may remain as production JavaScript in src root");
assert(existsSync("src/style.css"), "the root stylesheet remains next to the bundler entry");
assert(readFileSync("index.html", "utf8").includes('src="/src/main.js"'), "src/main.js remains the browser bundler entry");

for (const [owner, basenames] of Object.entries(ownerManifest)) {
  for (const basename of basenames) {
    const canonicalPath = `src/${owner}/${basename}`;
    assert(existsSync(canonicalPath), `${canonicalPath} must be owned by ${owner}`);
    assert(!existsSync(`src/${basename}`), `legacy canonical path src/${basename} must be absent`);
  }
}

const byBasename = new Map();
for (const repositoryPath of productionJavaScript) {
  const basename = path.posix.basename(repositoryPath);
  const existing = byBasename.get(basename);
  assert(!existing, `${basename} is duplicated at ${existing} and ${repositoryPath}`);
  byBasename.set(basename, repositoryPath);
}

const movedBasenames = [...byBasename.keys()].filter((basename) => basename !== "main.js" && basename !== "index.js");
for (const script of discoverFiles("scripts", (repositoryPath) => /\.(?:js|mjs)$/.test(repositoryPath))) {
  const source = readFileSync(script, "utf8");
  for (const basename of movedBasenames) {
    assert(!source.includes(`../src/${basename}`), `${script} still references legacy source path ../src/${basename}`);
    assert(!source.includes(`"src/${basename}`) && !source.includes(`'src/${basename}`), `${script} still references legacy source path src/${basename}`);
  }
}

for (const documentPath of ["LIBRARY.md", "ARCHITECTURE.md", ...discoverFiles("systems", (repositoryPath) => repositoryPath.endsWith(".md"))]) {
  const source = readFileSync(documentPath, "utf8");
  for (const basename of movedBasenames) {
    assert(!source.includes(`src/${basename}`), `${documentPath} still references legacy canonical path src/${basename}`);
    assert(!source.includes(`\`${basename}\``), `${documentPath} must use the full canonical path for ${basename}`);
  }
}

const architectureCheck = readFileSync("scripts/check-architecture-boundaries.mjs", "utf8");
assert(architectureCheck.includes('discoverJavaScriptFiles("src")'), "architecture discovery must recurse from src/");
assert(architectureCheck.includes("entry.isDirectory()"), "architecture discovery must recurse through owner directories");
assert(architectureCheck.includes('source["src/resources/debrisRuntime.js"]'), "architecture assertions must index full repository-relative paths");
assert(!architectureCheck.includes('source["debrisRuntime.js"]'), "architecture assertions may not use basenames as source identities");

console.log(`Task #066 checks passed: ${productionJavaScript.length - 1} production modules live under owner directories`);

function discoverFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const repositoryPath = path.posix.join(directory.replaceAll("\\", "/"), entry.name);
      return entry.isDirectory()
        ? discoverFiles(repositoryPath, predicate)
        : entry.isFile() && predicate(repositoryPath) ? [repositoryPath] : [];
    })
    .sort();
}
