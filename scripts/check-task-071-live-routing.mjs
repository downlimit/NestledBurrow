import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLACEABLE_TARGETING_GROUP } from "../src/build/liveAssetGeometry.js";
import { createInteractionTarget, findBestInteractionTarget } from "../src/interaction/interaction.js";
import { createInteractionApproachResolver } from "../src/interaction/interactionApproach.js";
import { createWorldLayout } from "../src/world/worldLayout.js";

const worldLayout = createWorldLayout();
worldLayout.setWorldObjectCollider("test-bed", {
  left: 32,
  right: 48,
  top: 32,
  bottom: 48,
}, "furniture:bed");

const player = {
  footWidth: 8,
  footDepth: 5,
  motor: { position: { x: 40, y: 24 } },
};
const resolver = createInteractionApproachResolver({
  worldLayout,
  getPlayer: () => player,
});
const definition = {
  id: "test-bed",
  entityId: "test-bed",
  kind: "sleep-bed",
  position: { x: 40, y: 40 },
  aimPosition: { x: 40, y: 40 },
  radius: 64,
  priority: 21,
  requiresFacing: false,
  facingDotThreshold: -1,
  targetingMode: "facing-first",
  targetingGroup: PLACEABLE_TARGETING_GROUP,
  interactionDirections: ["top"],
  prompt: "sleep",
  payload: { bedId: "test-bed" },
};
const source = {
  id: "player",
  position: { x: 40, y: 24 },
  facingDirection: { x: 0, y: 1 },
};

const probe = resolver.probe({ ...definition, __interactionProbe: true }, source);
assert(probe, "gaze-ranked collider target is visible to the prompt scan without a hard facing gate");

const resolved = resolver.resolve(definition, source);
assert.deepEqual(resolved?.payload.approachPoint, { x: 40, y: 24 }, "activation still resolves the enabled perimeter cell");
assert.deepEqual(resolved?.payload.approachPath, [{ x: 40, y: 24 }], "gaze ranking does not bypass exact approach routing");
const bedTarget = createInteractionTarget({ ...definition, ...resolved });
assert.equal(bedTarget.targetingMode, "facing-first");
assert.equal(bedTarget.targetingGroup, PLACEABLE_TARGETING_GROUP);
assert.equal(bedTarget.requiresFacing, false, "exact routing preserves the definition's non-gating gaze contract");

const wellTarget = createInteractionTarget({
  id: "well",
  entityId: "well",
  kind: "refill-well",
  position: { x: 8, y: 24 },
  aimPosition: { x: 8, y: 24 },
  radius: 64,
  priority: 24,
  requiresFacing: false,
  facingDotThreshold: -1,
  targetingMode: "facing-first",
  targetingGroup: PLACEABLE_TARGETING_GROUP,
  prompt: "bucket",
  payload: {},
});
assert.equal(
  findBestInteractionTarget({ ...source, facingDirection: { x: 0, y: 1 } }, [wellTarget, bedTarget])?.entityId,
  "test-bed",
  "looking at the bed beats the higher-priority nearby well",
);
assert.equal(
  findBestInteractionTarget({ ...source, facingDirection: { x: -1, y: 0 } }, [wellTarget, bedTarget])?.entityId,
  "well",
  "looking at the well selects the well",
);

const consistencySource = readFileSync("src/build/assetRuntimeConsistencyBootstrap.js", "utf8");
assert(consistencySource.includes("patchFarmingRuntime"), "well definitions join live collider targeting");

console.log("Task #071 live routing passed: gaze-ranked collider targets keep exact approach paths and bed/well selection");
