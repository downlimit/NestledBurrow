import assert from "node:assert/strict";
import {
  PATROL_MODE_LOOP,
  PATROL_MODE_PING_PONG,
  createPatrolController,
} from "../src/controllers.js";
import { NPCS } from "../src/npcConfig.js";

const homeNpc = NPCS.find((npc) => npc.id === "home-npc");
const streetNpc = NPCS.find((npc) => npc.id === "street-npc");

assert(homeNpc, "home NPC exists");
assert(streetNpc, "street NPC exists");
assert.equal(homeNpc.patrol.mode, PATROL_MODE_LOOP, "home NPC keeps a closed loop patrol");
assert.equal(
  streetNpc.patrol.mode,
  PATROL_MODE_PING_PONG,
  "street NPC traverses its multi-point route forward and then backward",
);

function routeStats(npc) {
  const points = npc.patrol.waypoints;
  return {
    points,
    waiting: points.filter((point) => point.waitMs >= 2000 && point.waitMs <= 3000),
    passThrough: points.filter((point) => (point.waitMs ?? 0) === 0),
    uniqueX: new Set(points.map((point) => point.x)).size,
    uniqueY: new Set(points.map((point) => point.y)).size,
  };
}

const streetRoute = routeStats(streetNpc);
assert(streetRoute.points.length >= 6, "street ping-pong route has multiple meaningful points");
assert(streetRoute.uniqueX > 1, "street ping-pong route changes X");
assert(streetRoute.uniqueY > 1, "street ping-pong route changes Y");
assert(streetRoute.passThrough.length >= 2, "street route includes pass-through points without rests");
assert(streetRoute.waiting.length >= 3, "street route includes several rest points");
assert.notDeepEqual(
  streetRoute.points[0],
  streetRoute.points.at(-1),
  "ping-pong route does not fake a loop by repeating its starting point",
);

const controller = createPatrolController({
  mode: streetNpc.patrol.mode,
  waypoints: streetNpc.patrol.waypoints,
});
const visitedIndexes = [controller.currentWaypointIndex];
let previousIndex = controller.currentWaypointIndex;
let safety = 0;

while (visitedIndexes.length < streetRoute.points.length * 2 - 1 && safety < 100) {
  const waypoint = streetRoute.points[controller.currentWaypointIndex];
  controller.getCommand({ position: waypoint, blockedAxes: {} }, Math.max(waypoint.waitMs ?? 0, 1));
  if (controller.currentWaypointIndex !== previousIndex) {
    visitedIndexes.push(controller.currentWaypointIndex);
    previousIndex = controller.currentWaypointIndex;
  }
  safety += 1;
}

const forward = streetRoute.points.map((_, index) => index);
const backwardWithoutEndpointDuplicate = streetRoute.points
  .slice(0, -1)
  .map((_, index) => streetRoute.points.length - 2 - index);
assert.deepEqual(
  visitedIndexes,
  [...forward, ...backwardWithoutEndpointDuplicate],
  "street NPC follows A→B→C→…→C→B→A rather than a two-point shuttle",
);

console.log("Patrol contract checks passed");
