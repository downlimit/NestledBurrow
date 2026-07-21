import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNpcMovementConfig } from "../src/character.js";
import { createPatrolController, WAYPOINT_TOLERANCE } from "../src/controllers.js";
import { DEFAULT_MOVEMENT_CONFIG } from "../src/movementConfig.js";
import { moveWithCollision } from "../src/movement.js";
import { NPCS } from "../src/npcConfig.js";
import { createWorldLayout } from "../src/worldLayout.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
const characterSource = fs.readFileSync(path.join(root, "src/character.js"), "utf8");

assert(/createCharacter\(this, \{\s*id: "player"/s.test(mainSource), "player is created through Character");
assert(/NPCS\.map\(\(npc\) =>\s*createCharacter\(this/s.test(mainSource), "NPCs are created through Character");
assert(!/updatePlayerAnimation|updatePlayerDepth|updateLastFacing/.test(mainSource), "WorldScene does not keep player-only movement/animation helpers");
assert(/moveWithCollision/.test(characterSource), "Character uses world collision");
assert(/startFollow\(this\.player, true, 1, 1\)/.test(mainSource), "camera target remains the player sprite");

const npcConfig = createNpcMovementConfig(DEFAULT_MOVEMENT_CONFIG);
assert.equal(npcConfig.maxSpeed, DEFAULT_MOVEMENT_CONFIG.maxSpeed, "NPC max speed equals player max speed");
for (const key of ["acceleration", "brakingDeceleration", "reverseAcceleration", "turnDeceleration"]) {
  assert.equal(npcConfig[key], DEFAULT_MOVEMENT_CONFIG[key] / 2, `${key} is half the player value`);
}

const loop = createPatrolController({
  mode: "loop",
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }],
});
assert.equal(loop.currentWaypointIndex, 1);
loop.advanceForTest();
loop.advanceForTest();
loop.advanceForTest();
assert.equal(loop.currentWaypointIndex, 0, "loop route advances from last waypoint to first");

const pingPong = createPatrolController({
  mode: "ping-pong",
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
});
pingPong.advanceForTest();
assert.equal(pingPong.currentWaypointIndex, 2, "ping-pong reaches the last waypoint");
pingPong.advanceForTest();
assert.equal(pingPong.currentWaypointIndex, 1, "ping-pong reverses at the last waypoint");
pingPong.advanceForTest();
assert.equal(pingPong.currentWaypointIndex, 0, "ping-pong reaches the first waypoint");
pingPong.advanceForTest();
assert.equal(pingPong.currentWaypointIndex, 1, "ping-pong reverses at the first waypoint");

const tolerant = createPatrolController({
  mode: "loop",
  tolerance: WAYPOINT_TOLERANCE,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }],
});
const nearDirection = tolerant.getDirection({ x: 10 - WAYPOINT_TOLERANCE / 2, y: 0 }, { lastBlockedAxes: {} }, 16);
assert(nearDirection.x > 0, "waypoint tolerance advances instead of oscillating around the reached point");
assert.equal(tolerant.currentWaypointIndex, 2, "near waypoint is considered reached once");

const layout = createWorldLayout();
for (const npc of NPCS) {
  assert.equal(moveWithCollision(npc.spawn, { x: 0, y: 0 }, layout, 8, 5).blockedAxes.x, false, `${npc.id} spawn uses world collision footprint`);
  assert.equal(moveWithCollision(npc.spawn, { x: 0, y: 0 }, layout, 8, 5).blockedAxes.y, false, `${npc.id} spawn uses world collision footprint`);
  for (const waypoint of npc.patrol.waypoints) {
    assert.equal(moveWithCollision(waypoint, { x: 0, y: 0 }, layout, 8, 5).blockedAxes.x, false, `${npc.id} waypoint is walkable`);
    assert.equal(moveWithCollision(waypoint, { x: 0, y: 0 }, layout, 8, 5).blockedAxes.y, false, `${npc.id} waypoint is walkable`);
  }
}

console.log("character checks passed: Character factory, NPC tuning, patrol routes, tolerance, collision and player camera target.");
