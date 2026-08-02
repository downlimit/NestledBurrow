import assert from "node:assert/strict";
import {
  PATROL_MODE_PING_PONG,
  createIdleController,
  createPatrolController,
} from "../src/character/controllers.js";
import { NPCS } from "../src/character/npcConfig.js";

assert.equal(NPCS.length, 1, "obsolete street and neighbor patrol actors are removed");
assert.equal(NPCS[0].id, "seed-merchant");
assert.equal(NPCS[0].patrol, undefined, "seed merchant has no patrol route");
const idle = createIdleController();
assert.deepEqual(
  idle.getCommand(),
  {
    moveDirection: { x: 0, y: 0 },
    aimDirection: null,
    actions: { interact: false, primary: false, secondary: false },
  },
  "stationary NPC controller emits a stable idle command",
);

const patrol = createPatrolController({
  mode: PATROL_MODE_PING_PONG,
  waypoints: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ],
});
const visited = [patrol.currentWaypointIndex];
for (let index = 0; index < 4; index += 1) {
  patrol.advanceForTest();
  visited.push(patrol.currentWaypointIndex);
}
assert.deepEqual(visited, [1, 2, 1, 0, 1], "generic ping-pong controller remains available");
console.log("Patrol contract checks passed: seed merchant is stationary and generic patrol remains stable");
