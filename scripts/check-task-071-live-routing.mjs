import assert from "node:assert/strict";
import { PLACEABLE_TARGETING_GROUP } from "../src/build/liveAssetGeometry.js";
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
  requiresFacing: false,
  facingDotThreshold: -1,
  targetingMode: "facing-first",
  targetingGroup: PLACEABLE_TARGETING_GROUP,
  interactionDirections: ["top"],
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
assert.equal(resolved?.targetingMode, "facing-first");
assert.equal(resolved?.targetingGroup, PLACEABLE_TARGETING_GROUP);

console.log("Task #071 live routing passed: gaze-ranked collider targets keep exact approach paths");
