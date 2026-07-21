import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacter, createNpcMovementConfig } from "../src/character.js";
import { createControllerCommand } from "../src/controllerCommand.js";
import {
  BLOCKED_WAYPOINT_ADVANCE_MS,
  createPatrolController,
  createPlayerController,
  WAYPOINT_TOLERANCE,
} from "../src/controllers.js";
import { DEFAULT_MOVEMENT_CONFIG } from "../src/movementConfig.js";
import { moveWithCollision } from "../src/movement.js";
import { NPCS } from "../src/npcConfig.js";
import { PLAYER_FOOT_DEPTH, PLAYER_FOOT_WIDTH } from "../src/visualConfig.js";
import { createWorldLayout } from "../src/worldLayout.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
const characterSource = fs.readFileSync(path.join(root, "src/character.js"), "utf8");

assert(/createCharacter\(this, \{\s*id: "player"/s.test(mainSource), "player is created through Character");
assert(/NPCS\.map\(\(npc\) =>\s*createCharacter\(this/s.test(mainSource), "NPCs are created through Character");
assert(!/updatePlayerAnimation|updatePlayerDepth|updateLastFacing/.test(mainSource), "WorldScene does not keep player-only movement/animation helpers");
assert(/moveWithCollision/.test(characterSource), "Character uses world collision");
assert(/startFollow\(this\.player, true, 1, 1\)/.test(mainSource), "camera target remains the player sprite");

const customFrames = Object.freeze({
  down: Object.freeze(["custom-down"]),
  up: Object.freeze(["custom-up"]),
  left: Object.freeze(["custom-left"]),
  right: Object.freeze(["custom-right"]),
});
const fakeSprite = {
  x: 0,
  y: 0,
  texture: { key: "custom-down" },
  anims: { isPlaying: false, currentAnim: null, stop() {}, play() {} },
  setOrigin() { return this; },
  setDepth() { return this; },
  setPosition(x, y) { this.x = x; this.y = y; return this; },
  setTexture(key) { this.texture.key = key; return this; },
};
const fakeScene = {
  add: {
    sprite(x, y, texture) {
      assert.equal(texture, "custom-down", "custom Character frames select the configured idle texture");
      fakeSprite.x = x;
      fakeSprite.y = y;
      return fakeSprite;
    },
  },
};
const configurableCharacter = createCharacter(fakeScene, {
  id: "custom",
  spawn: { x: 4, y: 8 },
  controller: { getCommand: () => createControllerCommand() },
  movementConfig: DEFAULT_MOVEMENT_CONFIG,
  frames: customFrames,
  idleFrameIndex: 0,
  footWidth: 11,
  footDepth: 7,
});
assert.equal(configurableCharacter.footWidth, 11, "Character collision width is configurable");
assert.equal(configurableCharacter.footDepth, 7, "Character collision depth is configurable");
assert.equal(configurableCharacter.frames, customFrames, "Character animation frames are configurable");


const defaultCommand = createControllerCommand();
assert.deepEqual(defaultCommand.moveDirection, { x: 0, y: 0 }, "missing moveDirection defaults to idle");
assert.equal(defaultCommand.aimDirection, null, "missing aimDirection defaults to null");
assert.deepEqual(
  defaultCommand.actions,
  { interact: false, primary: false, secondary: false },
  "missing actions default to false",
);
const sanitizedCommand = createControllerCommand({
  moveDirection: { x: 1, y: Number.NaN },
  aimDirection: { x: "bad", y: 1 },
  actions: { interact: 1, primary: "", secondary: "yes" },
});
assert.deepEqual(sanitizedCommand.moveDirection, { x: 1, y: 0 }, "non-numeric move components are sanitized");
assert.deepEqual(sanitizedCommand.aimDirection, { x: 0, y: 1 }, "non-numeric aim components are sanitized");
assert.deepEqual(
  sanitizedCommand.actions,
  { interact: true, primary: false, secondary: true },
  "action values normalize to booleans",
);

const playerController = createPlayerController({ getInputDirection: () => ({ x: 1, y: 0 }) });
const playerCommand = playerController.getCommand({ id: "player" }, 16);
assert.deepEqual(playerCommand, {
  moveDirection: { x: 1, y: 0 },
  aimDirection: null,
  actions: { interact: false, primary: false, secondary: false },
}, "player controller returns a complete default command");

const playerWithOptions = createPlayerController({
  getInputDirection: () => ({ x: 0, y: 1 }),
  getAimDirection: () => ({ x: 1, y: 0 }),
  getActions: () => ({ interact: true, primary: 1, secondary: 0 }),
});
assert.deepEqual(playerWithOptions.getCommand({ id: "player" }, 16), {
  moveDirection: { x: 0, y: 1 },
  aimDirection: { x: 1, y: 0 },
  actions: { interact: true, primary: true, secondary: false },
}, "optional player aim and actions pass through as a normalized command");

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
const nearCommand = tolerant.getCommand({ position: { x: 10 - WAYPOINT_TOLERANCE / 2, y: 0 }, blockedAxes: {} }, 16);
assert(nearCommand.moveDirection.x > 0, "waypoint tolerance advances instead of oscillating around the reached point");
assert.equal(nearCommand.aimDirection, null, "patrol controller command defaults aim to null");
assert.deepEqual(nearCommand.actions, { interact: false, primary: false, secondary: false }, "patrol controller command keeps actions inactive");
assert.equal(tolerant.currentWaypointIndex, 2, "near waypoint is considered reached once");

const blocked = createPatrolController({
  mode: "loop",
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
});
blocked.getCommand({ position: { x: 0, y: 0 }, blockedAxes: { x: true, y: false }, speed: 30 }, BLOCKED_WAYPOINT_ADVANCE_MS / 2);
blocked.getCommand({ position: { x: 0, y: 0 }, blockedAxes: { x: true, y: false }, speed: 30 }, BLOCKED_WAYPOINT_ADVANCE_MS / 2);
assert.equal(blocked.currentWaypointIndex, 2, "blocking the axis toward a waypoint advances instead of pushing forever");

const unrelatedAxisBlock = createPatrolController({
  mode: "loop",
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
});
unrelatedAxisBlock.getCommand(
  { position: { x: 0, y: 0 }, blockedAxes: { x: false, y: true }, speed: 0 },
  BLOCKED_WAYPOINT_ADVANCE_MS,
);
assert.equal(unrelatedAxisBlock.currentWaypointIndex, 1, "an unrelated blocked axis does not skip a valid waypoint");

const layout = createWorldLayout();

let capturedContext;
const mutatingController = {
  getCommand(context) {
    capturedContext = context;
    assert.equal(context.id, "snapshot", "controller receives character id in the snapshot");
    assert(!("sprite" in context), "controller snapshot does not expose the Phaser sprite");
    assert(!("controller" in context), "controller snapshot does not expose the controller");
    assert(!("lastBlockedAxes" in context), "controller snapshot does not expose mutable movement state names");
    context.position.x = 999;
    context.velocity.x = 999;
    context.facingDirection.x = 999;
    context.aimDirection.x = 999;
    context.blockedAxes.x = true;
    return createControllerCommand({ moveDirection: { x: 0, y: 0 }, aimDirection: { x: 1, y: 0 } });
  },
};
const snapshotCharacter = createCharacter(fakeScene, {
  id: "snapshot",
  spawn: { x: 4, y: 8 },
  controller: mutatingController,
  movementConfig: DEFAULT_MOVEMENT_CONFIG,
  frames: customFrames,
  idleFrameIndex: 0,
});
snapshotCharacter.update(16, layout);
assert(capturedContext, "controller is called with a snapshot context");
assert.equal(snapshotCharacter.sprite.x, 4, "mutating snapshot position does not mutate Character sprite state");
assert.equal(snapshotCharacter.movement.velocity.x, 0, "mutating snapshot velocity does not mutate Character movement state");
assert.equal(snapshotCharacter.lastBlockedAxes.x, false, "mutating snapshot blockedAxes does not mutate Character collision state");
assert(snapshotCharacter.movement.aimDirection.x > 0.9, "Character passes explicit aim to movement core");
assert.equal(snapshotCharacter.movement.desiredDirection.x, 0, "movement can differ from explicit aim");

for (const npc of NPCS) {
  assert.equal(
    moveWithCollision(npc.spawn, { x: 0, y: 0 }, layout, PLAYER_FOOT_WIDTH, PLAYER_FOOT_DEPTH).blockedAxes.x,
    false,
    `${npc.id} spawn uses world collision footprint`,
  );
  assert.equal(
    moveWithCollision(npc.spawn, { x: 0, y: 0 }, layout, PLAYER_FOOT_WIDTH, PLAYER_FOOT_DEPTH).blockedAxes.y,
    false,
    `${npc.id} spawn uses world collision footprint`,
  );
  for (const waypoint of npc.patrol.waypoints) {
    assert.equal(
      moveWithCollision(waypoint, { x: 0, y: 0 }, layout, PLAYER_FOOT_WIDTH, PLAYER_FOOT_DEPTH).blockedAxes.x,
      false,
      `${npc.id} waypoint is walkable`,
    );
    assert.equal(
      moveWithCollision(waypoint, { x: 0, y: 0 }, layout, PLAYER_FOOT_WIDTH, PLAYER_FOOT_DEPTH).blockedAxes.y,
      false,
      `${npc.id} waypoint is walkable`,
    );
  }
}

console.log("character checks passed: shared configurable Character, NPC tuning, patrol routes, blocked fallback, tolerance, collision and player camera target.");
