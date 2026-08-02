import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const main = readFileSync("src/main.js", "utf8").replace(/\r\n/g, "\n");
const lineCount = main.split("\n").length;
const MAX_WORLD_SCENE_LINES = 1300;

assert(
  lineCount <= MAX_WORLD_SCENE_LINES,
  `src/main.js is ${lineCount} lines; composition-root ceiling is ${MAX_WORLD_SCENE_LINES}. Extract system orchestration instead of growing WorldScene.`,
);

const sourceFiles = discoverJavaScriptFiles("src");
const source = Object.fromEntries(sourceFiles.map((file) => [
  file,
  readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
]));

assert.deepEqual(
  sourceFiles.filter((file) => source[file].includes("TREE_FRAMES.planted")),
  ["src/resources/resourceVisuals.js"],
  "one resource presentation owner must assemble the planted-tree frames",
);
assert(!source["src/main.js"].includes("row * 9 + column"), "WorldScene must not assemble a second planted-tree visual");
assert(!source["src/build/editorAuthoringRuntime.js"].includes("scene.add.image"), "authoring registers gameplay entities instead of rendering its own copies");
assert(source["src/build/editorAuthoringRuntime.js"].includes("debrisRuntime?.registerResource"), "authoring trees must enter the shared resource owner");
assert(!source["src/build/editorAuthoringRuntime.js"].includes("scene.runWorldObjectInteraction ="), "authoring cannot replace shared resource hit resolution");
assert(source["src/resources/debrisRuntime.js"].includes("registerResource(definition,"), "the resource owner must accept authored and location-defined instances");
assert(source["src/interaction/worldInteractionCoordinator.js"].includes("debrisRuntime?.getResourceDefinition"), "all resource interactions must resolve through the active resource owner");
assert(source["src/facilities/facilityRuntime.js"].includes("drawFacility(graphics, facility.facilityType)"), "facility runtime and previews must share one presentation adapter");
assert(source["src/build/worldBuildCoordinator.js"].includes("createWellPresentation(this.renderingHost, point"), "well runtime and previews must share one presentation adapter");
assert(source["src/build/worldBuildCoordinator.js"].includes("tavernSignRuntime?.getBuildMoveTargetAt")
  && source["src/build/worldBuildCoordinator.js"].includes("tavernSignRuntime?.moveBuildTarget"), "build mode must delegate tavern-sign movement to its runtime owner");
assert(source["src/tavern/guestRuntime.js"].includes("getSignPoint()"), "guest routing must resolve the tavern sign's live runtime position");
assert(source["src/build/startingLayout.js"].includes("tavernSignRuntime?.getStartingLayoutFurniture")
  && source["src/build/startingLayout.js"].includes("tavernSignRuntime?.restoreStartingLayoutFurniture"), "the tavern sign must share canonical furniture persistence");
for (const file of ["src/world/nestWorldLayout.js", "src/world/worldLocationConfig.js"]) {
  assert(!source[file].includes("scene.add."), `${file} may place entity definitions but cannot render entity instances`);
}

function discoverJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const repositoryPath = path.posix.join(directory.replaceAll("\\", "/"), entry.name);
      return entry.isDirectory()
        ? discoverJavaScriptFiles(repositoryPath)
        : entry.isFile() && entry.name.endsWith(".js") ? [repositoryPath] : [];
    })
    .sort();
}

console.log(`architecture boundaries passed: src/main.js ${lineCount}/${MAX_WORLD_SCENE_LINES} lines; shared world-entity owners enforced`);
