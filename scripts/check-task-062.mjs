import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const main = read("src/main.js");
const coordinator = read("src/worldBuildCoordinator.js");
const lifecycle = read("src/worldLocationLifecycle.js");
const e2eBridge = read("src/e2eBridge.js");
const authoring = read("src/editorAuthoringRuntime.js");
const startingLayout = read("src/startingLayout.js");
const packageJson = JSON.parse(read("package.json"));
const architectureCheck = read("scripts/check-architecture-boundaries.mjs");

assert(main.split("\n").length <= 2400, "WorldScene must remain within the 2400-line composition ceiling");
assert(architectureCheck.includes("MAX_WORLD_SCENE_LINES = 2400"), "the architecture ceiling must be fixed at 2400 lines");
assert(main.includes("createWorldBuildCoordinator({"), "WorldScene must explicitly construct the world build owner");
assert(!main.includes("createWorldBuildCoordinator(this"), "the coordinator may not discover dependencies through WorldScene fields");
assert(!main.includes("createBuildModeRuntime"), "WorldScene may not create or wire BuildModeRuntime");

for (const state of [
  "buildPlacedObjects",
  "buildWallEdges",
  "buildWallNodes",
  "buildWallJunctions",
  "buildGroundCells",
  "buildSurfaceVisuals",
  "buildFloorCells",
  "buildCarpetCells",
  "buildCarpetVisuals",
  "buildPreviewObjects",
  "buildDemolitionHighlight",
  "buildUndoStack",
  "activeBuildAction",
]) {
  assert(!main.includes(state), `WorldScene may not own transient build state: ${state}`);
  assert(coordinator.includes(`this.${state}`), `WorldBuildCoordinator must own transient build state: ${state}`);
}

for (const method of [
  "applyBuildPlacement",
  "applyBuildDemolition",
  "getBuildMoveTarget",
  "applyBuildMove",
  "renderBuildMovePreview",
  "renderBuildMoveHover",
  "undoBuildAction",
  "clearBuildPreview",
  "renderBuildPreview",
  "renderBuildDemolitionHighlight",
  "placeBuildAsset",
  "demolishBuildObject",
]) {
  assert(!new RegExp(`^  ${method}\\(`, "m").test(main), `WorldScene may not regain ${method} orchestration`);
  assert(new RegExp(`^  ${method}\\(`, "m").test(coordinator), `WorldBuildCoordinator must implement ${method}`);
}

for (const dependency of [
  "renderingHost",
  "worldLayout",
  "facilityRuntime",
  "debrisRuntime",
  "tavernSignRuntime",
  "meleeRuntime",
  "refreshInteractions",
  "persistGameplay",
]) {
  assert(coordinator.includes(dependency), `WorldBuildCoordinator dependency contract must name ${dependency}`);
}

assert(coordinator.includes("createBuildModeRuntime(this.renderingHost"), "WorldBuildCoordinator must create BuildModeRuntime on the rendering host");
assert(coordinator.includes("beginBuildAction()") && coordinator.includes("endBuildAction()"), "grouped undo boundaries must stay in the coordinator");
assert(coordinator.includes("[...action].reverse()"), "grouped undo must reverse the complete last action");
assert(coordinator.includes("getEffectiveCollider"), "placement and drag anchoring must retain effective-collider geometry");
assert(coordinator.includes("TAVERN_SIGN_BUILD_KIND") && coordinator.includes('target.kind === "training-dummy"'), "special furniture routes must remain delegated to their runtime owners");

for (const source of [lifecycle, e2eBridge, authoring, startingLayout]) {
  assert(!source.includes("scene.buildPlacedObjects"), "consumers must use the coordinator public API instead of its internal Map");
  assert(!source.includes("scene.buildUndoStack"), "consumers may not access grouped undo internals");
  assert(!source.includes("scene.buildPreviewObjects"), "consumers may not access preview internals");
}
assert(lifecycle.includes("worldBuildCoordinator?.destroy?.()"), "location teardown must delegate build cleanup to the coordinator");
assert(e2eBridge.includes("worldBuildCoordinator?.applyBuildMove"), "E2E build requests must delegate through the coordinator public API");
assert(authoring.includes("buildCoordinator.getPlacedObjects()"), "developer authoring must consume the coordinator public API");
assert(startingLayout.includes("requireBuildCoordinator(scene)"), "starting-layout authoring must resolve the coordinator public API");

assert.equal(packageJson.scripts["check:task-062"], "node scripts/check-task-062.mjs");
assert(packageJson.scripts.check.includes("npm run check:task-062"), "the full check must include Task #062 ownership coverage");

console.log("Task #062 contracts passed: WorldBuildCoordinator owns build session state, orchestration, previews, grouped undo, runtime routing, and lifecycle");
