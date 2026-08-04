import assert from "node:assert/strict";
import COLLIDER_DEFAULTS from "../src/build/colliderDefaults.js";
import STARTING_LAYOUT_DEFAULT from "../src/build/startingLayoutDefault.js";
import { createInteractionTarget, findBestInteractionTarget } from "../src/interaction/interaction.js";
import { createInteractionApproachResolver } from "../src/interaction/interactionApproach.js";
import { createInteractionTimelineRuntime, INTERACTION_PHASE } from "../src/needs/interactionTimelineRuntime.js";
import { createNeedsInteractionCoordinator } from "../src/needs/needsInteractionCoordinator.js";
import { createNeedsRuntime } from "../src/needs/needsRuntime.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resources/resourceConfig.js";
import { createGameSessionState } from "../src/session/gameSessionState.js";
import { NEED_ROW_AREAS, needValueFromPointerX } from "../src/ui/gameHud.js";
import { createWorldLayout } from "../src/world/worldLayout.js";

const worldLayout = createWorldLayout();
for (const [groupKey, offsets] of Object.entries(COLLIDER_DEFAULTS)) {
  worldLayout.setColliderOverride(groupKey, offsets);
}
for (const facility of STARTING_LAYOUT_DEFAULT.facilities) {
  worldLayout.setWorldObjectCollider(facility.id, {
    left: facility.footprint.x,
    right: facility.footprint.x + facility.footprint.width,
    top: facility.footprint.y,
    bottom: facility.footprint.y + facility.footprint.height,
  }, `facility:${facility.facilityType}`);
}

const definitions = new Map(STARTING_LAYOUT_DEFAULT.facilities.map((definition) => [definition.id, definition]));
const player = {
  footWidth: 8,
  footDepth: 5,
  sprite: { x: 568, y: 348, originX: 0.5, originY: 1 },
  motor: {
    position: { x: 568, y: 348 },
    movement: { velocity: { x: 0, y: 0 } },
  },
  visual: {
    lastFacing: "down",
    setPresentationPose(pose) { this.pose = pose; },
  },
};
const approachResolver = createInteractionApproachResolver({ worldLayout, getPlayer: () => player });

const ambiguousSource = { id: "player", position: { x: 568, y: 348 }, facingDirection: { x: 0, y: 1 } };
const overlappingTargets = ["editor-toilet-2", "home-shower-01"].map((id) => {
  const definition = definitions.get(id);
  return createInteractionTarget({ ...definition, ...approachResolver.resolve(definition, ambiguousSource) });
});
assert.equal(
  findBestInteractionTarget(ambiguousSource, overlappingTargets)?.entityId,
  "editor-toilet-2",
  "overlapping facility routes select the visually nearest intended object",
);

const toiletSource = { position: { x: 588, y: 380 } };
player.motor.position = { ...toiletSource.position };
player.sprite.x = toiletSource.position.x;
player.sprite.y = toiletSource.position.y;
const toiletApproach = approachResolver.resolve(definitions.get("editor-toilet-2"), toiletSource);
assert.deepEqual(toiletApproach?.position, { x: 592, y: 376 }, "lower-right toilet use keeps the exact nearest perimeter point");
assert.deepEqual(toiletApproach?.payload.approachPath, [{ x: 592, y: 376 }], "direct toilet route has no grid-center detour");

let activeFacilityId = null;
const coordinator = createNeedsInteractionCoordinator({
  getPlayer: () => player,
  facilityRuntime: {
    getDefinition: (id) => definitions.get(id),
    getPresentationPose: (id) => definitions.get(id)?.presentationPose ?? null,
    toggle: (id) => { activeFacilityId = id; return { status: "started" }; },
    stop: () => { activeFacilityId = null; },
  },
  debrisRuntime: { getBedDefinition: () => null },
  startSleep: () => {},
  stopSleep: () => {},
});

const tableSource = { position: { x: 408, y: 368 } };
player.motor.position = { ...tableSource.position };
player.sprite.x = tableSource.position.x;
player.sprite.y = tableSource.position.y;
const tableApproach = approachResolver.resolve(definitions.get("editor-table-3"), tableSource);
coordinator.useFacility("editor-table-3", tableApproach?.payload);
coordinator.update(100);
const tableTarget = tableApproach.position;
player.motor.position = {
  x: tableTarget.x + (tableTarget.x - tableSource.position.x),
  y: tableTarget.y + (tableTarget.y - tableSource.position.y),
};
player.sprite.x = player.motor.position.x;
player.sprite.y = player.motor.position.y;
coordinator.update(100);
assert.equal(coordinator.getState().phase, INTERACTION_PHASE.enter, "crossing a close table waypoint starts its enter timeline");
assert.deepEqual(player.motor.position, tableTarget, "crossed approach waypoint settles on its verified walkable point");
coordinator.update(500);
assert.equal(activeFacilityId, "editor-table-3", "table effect activates after the enter timeline");

let pose = { x: 10, y: 20, facing: "down", angle: 0, originX: 0.5, originY: 1 };
const bedTimeline = createInteractionTimelineRuntime({
  getPresentationPosition: () => pose,
  getMotorPosition: () => ({ x: 10, y: 20 }),
  setPresentationPose: (next) => { pose = next ?? { x: 10, y: 20, angle: 0 }; },
});
bedTimeline.begin({ profileId: "bed", targetPose: { x: 30, y: 40, facing: "right", angle: -90 } });
assert.equal(pose.angle, 0, "bed enter begins from the current upright pose");
bedTimeline.update(500);
assert(pose.angle < 0 && pose.angle > -90, "bed angle interpolates during enter");

const energyRow = NEED_ROW_AREAS[1];
assert.equal(needValueFromPointerX(energyRow, energyRow.x + 12), 0, "need track left edge maps to zero");
assert.equal(needValueFromPointerX(energyRow, energyRow.x + 12 + 23 / 2), 50, "need track midpoint maps to fifty");
assert.equal(needValueFromPointerX(energyRow, energyRow.x + 35), 100, "need track right edge maps to one hundred");

const debugSession = createGameSessionState();
const debugNeeds = createNeedsRuntime({ sessionState: debugSession, tuning: DEFAULT_GAMEPLAY_TUNING.needs });
const baselineEnergy = debugSession.gameplay.currentEnergy;
const baselineToilet = debugSession.gameplay.needs.toilet;
assert.deepEqual(debugNeeds.setDebugValue("energy", 12), { status: "updated", mutated: true, needId: "energy", value: 12 });
assert.equal(debugSession.gameplay.currentEnergy, debugSession.gameplay.maximumEnergy * 0.12, "energy bar debug value uses the energy ratio");
debugNeeds.setDebugValue("toilet", 37);
assert.equal(debugSession.gameplay.needs.toilet, 37, "ordinary need bars update their matching need");
assert.equal(debugNeeds.shouldSuppressPersistence(), true, "bar debug values never overwrite the saved baseline");
debugNeeds.clearDebugPreset();
assert.equal(debugSession.gameplay.currentEnergy, baselineEnergy, "clearing debug restores energy");
assert.equal(debugSession.gameplay.needs.toilet, baselineToilet, "clearing debug restores needs");

console.log("Task #067 interaction approach and pose regressions passed");
