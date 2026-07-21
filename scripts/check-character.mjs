import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacter } from "../src/character.js";
import { createCharacterMotor } from "../src/characterMotor.js";
import { createCharacterVisual } from "../src/characterVisual.js";
import { createCharacterSystem } from "../src/characterSystem.js";
import { createControllerCommand } from "../src/controllerCommand.js";
import {
  BLOCKED_WAYPOINT_ADVANCE_MS,
  PATROL_MODE_LOOP,
  PATROL_MODE_PING_PONG,
  createPatrolController,
  createPlayerController,
  WAYPOINT_TOLERANCE,
} from "../src/controllers.js";
import { DEFAULT_MOVEMENT_CONFIG } from "../src/movementConfig.js";
import {
  ACTOR_PROFILE_IDS,
  ACTOR_PROFILES,
  createDebugMovementConfigFromPolicy,
  getActorProfile,
} from "../src/actorProfiles.js";
import { moveWithCollision } from "../src/movement.js";
import { NPCS } from "../src/npcConfig.js";
import {
  FACING_HYSTERESIS,
  PLAYER_FOOT_DEPTH,
  PLAYER_FOOT_WIDTH,
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
} from "../src/visualConfig.js";
import { createWorldLayout } from "../src/worldLayout.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
const characterSource = fs.readFileSync(path.join(root, "src/character.js"), "utf8");
const worldConfigSource = fs.readFileSync(path.join(root, "src/worldConfig.js"), "utf8");

assert(/createCharacterSystem\(\{ collisionEnvironment: this\.worldLayout \}\)/.test(mainSource), "WorldScene creates a CharacterSystem after layout creation");
assert(/createCharacter\(this, \{\s*id: "player"/s.test(mainSource), "player is created through Character");
assert(/actorProfile: playerProfile/.test(mainSource), "player is created with the player actor profile");
assert(/for \(const npc of NPCS\)/.test(mainSource), "NPCs are registered through stable creation order");
assert(/const actorProfile = getActorProfile\(npc\.profileId\)/.test(mainSource), "NPC profiles are looked up from NPC config");
assert(/actorProfile,/.test(mainSource), "NPCs are created with their configured actor profiles");
assert(!/updatePlayerAnimation|updatePlayerDepth|updateLastFacing/.test(mainSource), "WorldScene does not keep player-only movement/animation helpers");
assert(!/moveWithCollision/.test(characterSource), "Character delegates world collision to CharacterMotor");
assert(!/PLAYER_SPEED/.test(worldConfigSource), "worldConfig does not export player speed");
assert(!/createNpcMovementConfig/.test(characterSource), "legacy NPC movement helper is removed");
assert(/this\.player = this\.characterSystem\.require\("player"\)\.sprite/.test(mainSource), "camera target is looked up through the character registry");
assert(/startFollow\(this\.player, true, 1, 1\)/.test(mainSource), "camera target remains the player sprite");
assert(!/this\.characters\s*=/.test(mainSource), "WorldScene does not keep a mutable character array registry");
assert(!/this\.characters\.forEach/.test(mainSource), "WorldScene does not update a mutable character array directly");
assert(/this\.characterSystem\?\.update\(delta\)/.test(mainSource), "WorldScene updates characters through CharacterSystem");


const playerProfile = getActorProfile(ACTOR_PROFILE_IDS.player);
const villagerProfile = getActorProfile(ACTOR_PROFILE_IDS.villager);
assert.equal(playerProfile.id, "player", "player profile has a stable ID");
assert.equal(villagerProfile.id, "villager", "villager profile has a stable ID");
assert.equal(ACTOR_PROFILES.player, playerProfile, "player profile is registered by stable ID");
assert.equal(ACTOR_PROFILES.villager, villagerProfile, "villager profile is registered by stable ID");
assert(Object.isFrozen(playerProfile), "player profile is immutable");
assert(Object.isFrozen(playerProfile.movement), "player movement profile is immutable");
assert(Object.isFrozen(playerProfile.visual), "player visual profile is immutable");
assert(Object.isFrozen(villagerProfile), "villager profile is immutable");
assert.deepEqual(playerProfile.movement, DEFAULT_MOVEMENT_CONFIG, "default movement comes from the player profile values");
assert.deepEqual(villagerProfile.movement, {
  maxSpeed: 29,
  acceleration: 87,
  brakingDeceleration: 103,
  reverseAcceleration: 127,
  turnDeceleration: 70,
  facingTurnSpeed: 10,
  movingSpeedThreshold: 2,
  maxDeltaMs: 50,
}, "villager production movement values are explicit");
assert.throws(
  () => getActorProfile("missing"),
  /Unknown actor profile ID: missing/,
  "unknown profile IDs fail clearly instead of falling back",
);
for (const npc of NPCS) {
  assert.equal(npc.profileId, ACTOR_PROFILE_IDS.villager, `${npc.id} uses the villager profile`);
}
const playerRuntime = { ...playerProfile.movement };
const villagerRuntime = { ...villagerProfile.movement };
playerRuntime.acceleration = 999;
assert.equal(villagerRuntime.acceleration, 87, "villager runtime config does not depend on player runtime config");
assert.notEqual(playerRuntime, villagerRuntime, "player and NPC movement configs are separate objects");
assert.equal(villagerProfile.movement.acceleration, 87, "runtime changes do not mutate villager production data");
assert(
  villagerProfile.movement.maxSpeed <= playerProfile.movement.maxSpeed / 3 + 1,
  "villager is noticeably slower than the player",
);
const debugVillagerRuntime = createDebugMovementConfigFromPolicy(villagerProfile, {
  maxSpeed: 100,
  acceleration: 600,
  brakingDeceleration: 700,
  reverseAcceleration: 800,
  turnDeceleration: 500,
  facingTurnSpeed: 12,
  movingSpeedThreshold: 4,
  maxDeltaMs: 60,
});
assert.deepEqual(debugVillagerRuntime, {
  maxSpeed: 100 * (29 / 87),
  acceleration: 600 * (87 / 520),
  brakingDeceleration: 700 * (103 / 620),
  reverseAcceleration: 800 * (127 / 760),
  turnDeceleration: 500 * (70 / 420),
  facingTurnSpeed: 12,
  movingSpeedThreshold: 4,
  maxDeltaMs: 60,
}, "debug-only villager policy preserves production proportions instead of player speed");
assert.deepEqual(
  createDebugMovementConfigFromPolicy(villagerProfile, DEFAULT_MOVEMENT_CONFIG),
  villagerProfile.movement,
  "reset debug config restores the original villager runtime values",
);
assert.deepEqual(
  createDebugMovementConfigFromPolicy(villagerProfile, playerProfile.movement),
  villagerProfile.movement,
  "debug-derived villager config matches production profile",
);
assert.equal(playerProfile.visual.animationPrefix, "character", "player keeps the character animation prefix");
assert.equal(villagerProfile.visual.animationPrefix, "character", "villager keeps the character animation prefix");
assert.equal(playerProfile.visual.frames, PLAYER_FRAMES, "player keeps existing visual frames");
assert.equal(villagerProfile.visual.frames, PLAYER_FRAMES, "villager keeps existing visual frames");
assert.equal(playerProfile.visual.footWidth, PLAYER_FOOT_WIDTH, "player keeps the existing foot width");
assert.equal(villagerProfile.visual.footDepth, PLAYER_FOOT_DEPTH, "villager keeps the existing foot depth");
assert.equal(playerProfile.visual.idleFrameIndex, PLAYER_IDLE_FRAME_INDEX, "player keeps idle frame index");
assert.equal(villagerProfile.visual.facingHysteresis, FACING_HYSTERESIS, "villager keeps facing hysteresis");

const customFrames = Object.freeze({
  down: Object.freeze(["custom-down", "custom-down-step-a", "custom-down-step-b"]),
  up: Object.freeze(["custom-up", "custom-up-step-a", "custom-up-step-b"]),
  left: Object.freeze(["custom-left", "custom-left-step-a", "custom-left-step-b"]),
  right: Object.freeze(["custom-right", "custom-right-step-a", "custom-right-step-b"]),
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



const layout = createWorldLayout();

const visualSprite = {
  x: 0,
  y: 0,
  texture: { key: "custom-down" },
  origin: null,
  depth: 0,
  destroyCount: 0,
  anims: {
    isPlaying: false,
    currentAnim: null,
    stopCount: 0,
    played: [],
    stop() { this.isPlaying = false; this.stopCount += 1; },
    play(key) { this.isPlaying = true; this.currentAnim = { key }; this.played.push(key); },
  },
  setOrigin(x, y) { this.origin = { x, y }; return this; },
  setDepth(depth) { this.depth = depth; return this; },
  setPosition(x, y) { this.x = x; this.y = y; return this; },
  setTexture(key) { this.texture.key = key; return this; },
  destroy() { this.destroyCount += 1; },
};
const visualScene = { add: { sprite(x, y, texture) { visualSprite.x = x; visualSprite.y = y; visualSprite.texture.key = texture; return visualSprite; } } };
const visual = createCharacterVisual(visualScene, { spawn: { x: 2, y: 3 }, actorProfile: playerProfile, frames: customFrames, idleFrameIndex: 0, facingHysteresis: 0.25 });
assert.equal(visual.sprite.texture.key, "custom-down", "CharacterVisual creates the sprite with the configured idle frame");
assert.deepEqual(visual.sprite.origin, { x: 0.5, y: 1 }, "CharacterVisual preserves sprite origin");
visual.update({ position: { x: 7, y: 9 }, facingDirection: { x: 0.7, y: 0.6 } }, { velocity: { x: 0, y: 0 } }, DEFAULT_MOVEMENT_CONFIG);
assert.deepEqual({ x: visual.sprite.x, y: visual.sprite.y }, { x: 7, y: 9 }, "CharacterVisual synchronizes sprite position");
assert.equal(visual.sprite.depth, 509, "CharacterVisual keeps depth sorting as 500 plus rounded y");
assert.equal(visual.lastFacing, "down", "CharacterVisual keeps facing hysteresis for near-diagonal input");
visual.update({ position: { x: 7, y: 9 }, facingDirection: { x: 1, y: 0 } }, { velocity: { x: 20, y: 0 } }, DEFAULT_MOVEMENT_CONFIG);
assert.equal(visual.lastFacing, "right", "CharacterVisual updates cardinal facing outside hysteresis");
assert.deepEqual(visual.sprite.anims.played.at(-1), "character-walk-right", "CharacterVisual preserves walk animation keys");
visual.update({ position: { x: 7, y: 9 }, facingDirection: { x: 1, y: 0 } }, { velocity: { x: 0, y: 0 } }, DEFAULT_MOVEMENT_CONFIG);
assert.equal(visual.sprite.texture.key, "custom-right", "CharacterVisual selects the matching idle frame");
for (const [facing, frames] of Object.entries(customFrames)) {
  visual.lastFacing = facing;
  for (const frameAtStop of frames) {
    visual.sprite.texture.key = frameAtStop;
    visual.sprite.anims.isPlaying = true;
    visual.sprite.anims.currentAnim = { key: `${visual.animationPrefix}-walk-${facing}` };
    visual.update(
      { position: { x: 7, y: 9 }, facingDirection: { x: 0, y: 0 } },
      { velocity: { x: 0, y: 0 } },
      DEFAULT_MOVEMENT_CONFIG,
    );
    assert.equal(
      visual.sprite.texture.key,
      frames[0],
      `CharacterVisual returns ${facing} to neutral from ${frameAtStop}`,
    );
  }
}
visual.destroy();
visual.destroy();
assert.equal(visual.sprite.destroyCount, 1, "CharacterVisual destroy is idempotent");

const plainMotor = createCharacterMotor({ id: "motor", spawn: { x: 16, y: 16 }, controller: { getCommand: () => createControllerCommand({ moveDirection: { x: 1, y: 0 }, aimDirection: { x: 0, y: -1 } }) }, movementConfig: DEFAULT_MOVEMENT_CONFIG, actorProfile: playerProfile, footWidth: PLAYER_FOOT_WIDTH, footDepth: PLAYER_FOOT_DEPTH });
const motorSnapshot = plainMotor.update(50, layout);
assert.equal(motorSnapshot.profileId, "player", "CharacterMotor snapshot includes profile ID");
assert(motorSnapshot.position.x > 16, "CharacterMotor updates plain world position after movement");
assert(motorSnapshot.speed > 0, "CharacterMotor speed matches movement core after acceleration");
assert(motorSnapshot.aimDirection.y < 0, "CharacterMotor allows aim direction to differ from movement");
assert.equal(plainMotor.movement.desiredDirection.x, 1, "CharacterMotor movement state follows existing movement core");
assert(!("sprite" in plainMotor), "CharacterMotor does not own a Phaser sprite");
const beforeMutation = plainMotor.position.x;
assert.throws(() => { motorSnapshot.position.x = 999; }, TypeError, "CharacterMotor snapshot nested vectors are immutable");
assert.equal(plainMotor.position.x, beforeMutation, "mutating a CharacterMotor snapshot cannot mutate the motor");
const blockedMotor = createCharacterMotor({ id: "blocked-motor", spawn: { x: 4, y: 20 }, controller: { getCommand: () => createControllerCommand({ moveDirection: { x: -1, y: 0 } }) }, movementConfig: DEFAULT_MOVEMENT_CONFIG, actorProfile: playerProfile, footWidth: PLAYER_FOOT_WIDTH, footDepth: PLAYER_FOOT_DEPTH });
const blockedSnapshot = blockedMotor.update(50, layout);
assert.equal(blockedSnapshot.blockedAxes.x, true, "CharacterMotor applies blocked axes from collision");

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


const noWaitPatrol = createPatrolController({
  mode: PATROL_MODE_LOOP,
  tolerance: 1,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
});
const noWaitCommand = noWaitPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 16);
assert.equal(noWaitPatrol.currentWaypointIndex, 2, "waypoint without waitMs behaves like waitMs 0");
assert(noWaitCommand.moveDirection.x > 0, "waitMs 0 waypoint does not create a long stop");

const explicitZeroWaitPatrol = createPatrolController({
  mode: PATROL_MODE_LOOP,
  tolerance: 1,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0, waitMs: 0 }, { x: 20, y: 0 }],
});
const zeroWaitCommand = explicitZeroWaitPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 16);
assert.equal(explicitZeroWaitPatrol.currentWaypointIndex, 2, "explicit waitMs 0 waypoint advances immediately");
assert(zeroWaitCommand.moveDirection.x > 0, "explicit waitMs 0 waypoint does not idle intentionally");

const waitingPatrol = createPatrolController({
  mode: PATROL_MODE_LOOP,
  tolerance: 1,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0, waitMs: 100 }, { x: 20, y: 0 }],
});
assert.deepEqual(
  waitingPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 16).moveDirection,
  { x: 0, y: 0 },
  "wait waypoint returns idle when reached",
);
assert.equal(waitingPatrol.currentWaypointIndex, 1, "waiting waypoint holds its index while timer runs");
assert.deepEqual(
  waitingPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 50).moveDirection,
  { x: 0, y: 0 },
  "wait waypoint keeps idling before the wait elapses",
);
const afterWaitCommand = waitingPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 50);
assert.equal(waitingPatrol.currentWaypointIndex, 2, "patrol advances when wait completes");
assert(afterWaitCommand.moveDirection.x > 0, "patrol resumes movement after wait completes");

let pauseDuringWait = false;
const waitPausedPatrol = createPatrolController({
  mode: PATROL_MODE_LOOP,
  tolerance: 1,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0, waitMs: 100 }, { x: 20, y: 0 }],
  isPaused: () => pauseDuringWait,
});
waitPausedPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 16);
pauseDuringWait = true;
waitPausedPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: { x: true } }, 500);
assert.equal(waitPausedPatrol.currentWaypointIndex, 1, "dialog pause freezes waypoint wait timer and blocked timer");
pauseDuringWait = false;
assert.deepEqual(
  waitPausedPatrol.getCommand({ position: { x: 10, y: 0 }, blockedAxes: {} }, 50).moveDirection,
  { x: 0, y: 0 },
  "resumed patrol continues the same wait after dialog closes",
);
assert.equal(waitPausedPatrol.currentWaypointIndex, 1, "paused wait did not elapse while dialog was open");

const blockedWaitSkip = createPatrolController({
  mode: PATROL_MODE_LOOP,
  tolerance: 1,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0, waitMs: 3000 }, { x: 20, y: 0 }],
});
blockedWaitSkip.getCommand({ position: { x: 0, y: 0 }, blockedAxes: { x: true } }, BLOCKED_WAYPOINT_ADVANCE_MS);
assert.equal(blockedWaitSkip.currentWaypointIndex, 2, "blocked fallback skips the blocked waypoint without applying its wait");
const blockedSkipCommand = blockedWaitSkip.getCommand({ position: { x: 0, y: 0 }, blockedAxes: {} }, 16);
assert(blockedSkipCommand.moveDirection.x > 0, "blocked fallback continues toward the next waypoint without artificial idle");

const pingPongWaitSkip = createPatrolController({
  mode: PATROL_MODE_PING_PONG,
  tolerance: 1,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0, waitMs: 3000 }, { x: 20, y: 0 }],
});
pingPongWaitSkip.getCommand({ position: { x: 0, y: 0 }, blockedAxes: { x: true } }, BLOCKED_WAYPOINT_ADVANCE_MS);
assert.equal(pingPongWaitSkip.currentWaypointIndex, 2, "ping-pong order survives blocked fallback to the end waypoint");
pingPongWaitSkip.getCommand({ position: { x: 20, y: 0 }, blockedAxes: {} }, 16);
assert.equal(pingPongWaitSkip.currentWaypointIndex, 1, "ping-pong reverses normally after blocked fallback");

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


const homeNpc = NPCS.find((npc) => npc.id === "home-npc");
const streetNpc = NPCS.find((npc) => npc.id === "street-npc");
assert(homeNpc, "home NPC exists");
assert(streetNpc, "street NPC exists");

function routeStats(npc) {
  const points = npc.patrol.waypoints;
  return {
    points,
    waiting: points.filter((waypoint) => waypoint.waitMs >= 2000 && waypoint.waitMs <= 3000),
    passThrough: points.filter((waypoint) => (waypoint.waitMs ?? 0) === 0),
    uniqueX: new Set(points.map((waypoint) => waypoint.x)).size,
    uniqueY: new Set(points.map((waypoint) => waypoint.y)).size,
  };
}

function isSimpleRectangle(points) {
  const uniqueX = new Set(points.map((waypoint) => waypoint.x));
  const uniqueY = new Set(points.map((waypoint) => waypoint.y));
  if (uniqueX.size !== 2 || uniqueY.size !== 2 || points.length !== 4) return false;
  return points.every((waypoint) => uniqueX.has(waypoint.x) && uniqueY.has(waypoint.y));
}

const homeRoute = routeStats(homeNpc);
assert(homeRoute.points.length >= 5, "home NPC route has at least five points");
assert(homeRoute.passThrough.length >= 2, "home NPC route includes pass-through waypoints");
assert(homeRoute.waiting.length >= 2 && homeRoute.waiting.length <= 4, "home NPC route includes meaningful waits");
assert(homeRoute.uniqueX > 2 && homeRoute.uniqueY > 2, "home NPC route moves among different house areas");
assert(!isSimpleRectangle(homeRoute.points), "home NPC route is not the previous simple rectangle");

const streetRoute = routeStats(streetNpc);
assert(streetRoute.points.length >= 6, "street NPC route has at least six points");
assert(streetRoute.passThrough.length >= 2, "street NPC route includes pass-through waypoints");
assert(streetRoute.waiting.length >= 2 && streetRoute.waiting.length <= 4, "street NPC route includes meaningful waits");
assert(streetRoute.uniqueX > 1 && streetRoute.uniqueY > 1, "street NPC route changes both X and Y");
assert(!(streetRoute.uniqueX === 1 && streetNpc.patrol.mode === PATROL_MODE_PING_PONG), "street NPC route is not the previous vertical ping-pong line");
assert(!isSimpleRectangle(streetRoute.points), "street NPC route is not a simple rectangle");

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

const composed = createCharacter(fakeScene, { id: "composed", spawn: { x: 4, y: 8 }, controller: { getCommand: () => createControllerCommand() }, movementConfig: DEFAULT_MOVEMENT_CONFIG, frames: customFrames, idleFrameIndex: 0, footWidth: 12, footDepth: 6 });
assert(composed.motor && composed.visual, "Character aggregate composes a motor and visual");
assert.equal(composed.sprite, composed.visual.sprite, "Character sprite getter delegates to visual");
assert.equal(composed.movement, composed.motor.movement, "Character movement getter delegates to motor");
assert.equal(composed.footWidth, 12, "Character constructor foot width override reaches motor");
assert.equal(composed.footDepth, 6, "Character constructor foot depth override reaches motor");
assert(!("controller" in composed.visual), "CharacterVisual does not own controller state");
assert(!("collisionEnvironment" in composed.visual), "CharacterVisual does not own collision queries");
assert(!("sprite" in composed.motor), "CharacterMotor does not own Phaser sprite state");

let updateCount = 0;
const fakeCharacters = ["player", ...NPCS.map((npc) => npc.id)].map((id) => ({ id, sprite: { id: `${id}-sprite` }, update(delta, env) { updateCount += 1; this.lastUpdate = { delta, env }; }, getSnapshot() { return Object.freeze({ id, profileId: id === "player" ? "player" : "villager", position: Object.freeze({ x: 1, y: 2 }), velocity: Object.freeze({ x: 0, y: 0 }), facingDirection: Object.freeze({ x: 0, y: 1 }), aimDirection: Object.freeze({ x: 0, y: 1 }), blockedAxes: Object.freeze({ x: false, y: false }), speed: 0 }); } }));
const system = createCharacterSystem({ collisionEnvironment: layout });
fakeCharacters.forEach((character) => system.add(character));
assert(system.has("player"), "CharacterSystem has registered player ID");
assert.equal(system.get("player"), fakeCharacters[0], "CharacterSystem get returns the registered character");
assert.equal(system.get("missing"), null, "CharacterSystem get returns null for unknown IDs");
assert.equal(system.require(NPCS[0].id), fakeCharacters[1], "CharacterSystem require finds NPCs by stable ID");
assert.throws(() => system.require("missing"), /Unknown character ID: missing/, "CharacterSystem require fails clearly for unknown IDs");
assert.throws(() => system.add({ id: "player" }), /Duplicate character ID: player/, "CharacterSystem rejects duplicate IDs");
assert.deepEqual(system.values().map((character) => character.id), ["player", ...NPCS.map((npc) => npc.id)], "CharacterSystem preserves stable insertion order");
system.update(16);
assert.equal(updateCount, fakeCharacters.length, "CharacterSystem updates each character exactly once");
assert(fakeCharacters.every((character) => character.lastUpdate?.env === layout), "CharacterSystem passes collision environment into Character update");
assert.deepEqual(system.getSnapshots().map((snapshot) => snapshot.id), ["player", ...NPCS.map((npc) => npc.id)], "CharacterSystem snapshot order matches insertion order");
assert(!("sprite" in system.getSnapshot("player")), "CharacterSystem snapshots do not expose Phaser sprite objects");
assert.equal(system.require("player").sprite.id, "player-sprite", "player camera target remains available through registry lookup");

console.log("character checks passed: actor profiles, shared configurable Character, NPC tuning, patrol routes, blocked fallback, tolerance, collision and player camera target.");

let paused = true;
const pausedPatrol = createPatrolController({
  mode: PATROL_MODE_LOOP,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
  tolerance: 1,
  isPaused: () => paused,
});
const pausedIndex = pausedPatrol.currentWaypointIndex;
const pausedCommand = pausedPatrol.getCommand({ position: { x: 0, y: 0 }, blockedAxes: { x: true } }, BLOCKED_WAYPOINT_ADVANCE_MS + 100);
assert.deepEqual(pausedCommand.moveDirection, { x: 0, y: 0 }, "paused patrol returns idle movement");
assert.deepEqual(pausedCommand.actions, { interact: false, primary: false, secondary: false }, "paused patrol returns idle actions");
assert.equal(pausedCommand.aimDirection, null, "paused patrol returns no aim");
assert.equal(pausedPatrol.currentWaypointIndex, pausedIndex, "paused patrol does not advance waypoint index");
pausedPatrol.getCommand({ position: { x: 0, y: 0 }, blockedAxes: { x: true } }, BLOCKED_WAYPOINT_ADVANCE_MS + 100);
assert.equal(pausedPatrol.currentWaypointIndex, pausedIndex, "paused patrol blocked timer does not advance waypoint");
paused = false;
const resumedCommand = pausedPatrol.getCommand({ position: { x: 0, y: 0 }, blockedAxes: {} }, 16);
assert(resumedCommand.moveDirection.x > 0, "resumed patrol continues toward previous waypoint");
assert.equal(pausedPatrol.currentWaypointIndex, pausedIndex, "resumed patrol keeps previous waypoint until reached or blocked");
const independentPatrol = createPatrolController({
  mode: PATROL_MODE_LOOP,
  waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  tolerance: 1,
});
const independentCommand = independentPatrol.getCommand({ position: { x: 0, y: 0 }, blockedAxes: {} }, 16);
assert(independentCommand.moveDirection.x > 0, "another patrol controller is not affected by pause callback");
