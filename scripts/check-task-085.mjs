import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadFixedWorldAuthoring,
  resolveFixedWorldInstance,
} from "../src/build/fixedWorldAuthoringState.js";
import { createAtollWorldLayout } from "../src/world/atollWorldLayout.js";
import {
  deriveWildAtollDirection,
  getWildAtollArenaDefinition,
  getWildAtollExitPoint,
  getWildAtollSegmentDefinition,
  WILD_ATOLL_SEGMENT_IDS,
} from "../src/world/wildAtollDomain.js";
import { WORLD_IDS, getWorldLocationDefinition } from "../src/world/worldLocationConfig.js";
import { WorldPresentationRuntime } from "../src/world/worldPresentationRuntime.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function displayObject() {
  return {
    x: 0,
    y: 0,
    depth: 0,
    setOrigin() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setCrop() { return this; },
    destroy() {},
  };
}

assert.equal(deriveWildAtollDirection("center", "left"), "north-west");
assert.equal(deriveWildAtollDirection("center", "right"), "north-east");
assert.equal(deriveWildAtollDirection("left", "left"), "north");
assert.equal(deriveWildAtollDirection("left", "right"), "north-east");
assert.equal(deriveWildAtollDirection("right", "left"), "north-west");
assert.equal(deriveWildAtollDirection("right", "right"), "north");
assert.equal(deriveWildAtollDirection("left", "center"), "north-east");
assert.equal(deriveWildAtollDirection("right", "center"), "north-west");

for (const segmentId of WILD_ATOLL_SEGMENT_IDS) {
  const segment = getWildAtollSegmentDefinition(segmentId);
  assert.deepEqual(
    getWildAtollArenaDefinition(segment.entryArenaId).exits.map(({ direction }) => direction),
    ["north-west", "north-east"],
    `${segmentId} root derives NW + NE`,
  );
  assert.deepEqual(
    getWildAtollArenaDefinition(segment.levels[3][0]).exits.map(({ direction }) => direction),
    ["north-east"],
  );
  assert.deepEqual(
    getWildAtollArenaDefinition(segment.levels[3][1]).exits.map(({ direction }) => direction),
    ["north-west"],
  );
  const onward = getWildAtollArenaDefinition(segment.terminalArenaId).exits
    .filter(({ kind }) => kind === "segment");
  assert.deepEqual(onward.map(({ direction }) => direction), onward.length === 2 ? ["north-west", "north-east"] : []);
}
assert.deepEqual(getWildAtollExitPoint("center", 16), { x: 32, y: 160 }, "threshold teleport starts at the left edge");

for (const worldId of [WORLD_IDS.village, WORLD_IDS.nest, WORLD_IDS.atoll]) {
  assert.equal(getWorldLocationDefinition(worldId).capabilities.fixedWorldAuthoring, true);
}
assert.equal(getWorldLocationDefinition(WORLD_IDS.nest).capabilities.buildMode, false);
assert.equal(getWorldLocationDefinition(WORLD_IDS.atoll).capabilities.buildMode, false);

{
  const layout = createAtollWorldLayout();
  const rect = { left: 144, right: 176, top: 112, bottom: 120 };
  layout.setWorldObjectCollider("toggle-target", rect, "transition:test", { collisionEnabled: false });
  assert.equal(layout.getWorldObjectColliders().find(({ id }) => id === "toggle-target").collisionEnabled, false);
  assert.equal(layout.isBlockedBox(rect), false, "disabled collider remains authorable without blocking movement");
  layout.setWorldObjectCollider("toggle-target", rect, "transition:test", { collisionEnabled: true });
  assert.equal(layout.isBlockedBox(rect), true, "the same collider shape blocks again after OFF -> ON");
}

{
  const storage = new MemoryStorage();
  const colliders = new Map();
  const layout = {
    groundTiles: [],
    houseFloorTiles: [],
    houseWallTiles: [],
    decorationTiles: [],
    transportTiles: [{
      id: "fixed-stair",
      profileKey: "transition:test",
      worldX: 16,
      worldY: 32,
      width: 64,
      height: 48,
      textureKey: "fixed-stair-texture",
    }],
    transitions: [{
      id: "fixed-stair",
      profileKey: "transition:test",
      collider: { left: 0, right: 64, top: 44, bottom: 48 },
      footprintBounds: { left: 16, right: 80, top: 32, bottom: 80 },
      safeSpawn: { x: 999, y: 777 },
    }],
    getWorldObjectColliders: () => [...colliders].map(([id, value]) => ({ id, ...value })),
    setWorldObjectCollider(id, rect, groupKey, metadata) { colliders.set(id, { rect, groupKey, ...metadata }); },
  };
  layout.setWorldObjectCollider("fixed-stair", { left: 16, right: 80, top: 76, bottom: 80 }, "transition:test", { collisionEnabled: true });
  const scene = {
    assetProfiles: { "transition:test": { visualOffset: { x: 0, y: 0 }, snapAnchorOffset: { x: 32, y: 48 } } },
    add: { image: () => displayObject() },
    interactionRuntime: { refresh() {} },
  };
  const runtime = new WorldPresentationRuntime({ renderingHost: scene, authoringStorage: storage });
  runtime.mount(layout);
  const instance = runtime.getTransitionAuthoringInstances()[0];
  const moved = instance.move({ x: 48, y: 64 });
  assert.deepEqual(moved, { previous: { x: 16, y: 32 }, current: { x: 48, y: 64 } });
  assert.deepEqual(layout.transitions[0].safeSpawn, { x: 999, y: 777 }, "source move never mutates destination safe-spawn");
  assert.deepEqual(layout.transitions[0].footprintBounds, { left: 48, right: 112, top: 64, bottom: 112 });
  assert.deepEqual(resolveFixedWorldInstance("fixed-stair", {}, storage), { x: 48, y: 64, collisionEnabled: true });
  assert.equal(runtime.getTransitionAuthoringInstances()[0].setCollisionEnabled(false), false);
  assert.equal(colliders.get("fixed-stair").collisionEnabled, false);
  assert.deepEqual(loadFixedWorldAuthoring(storage).instances["fixed-stair"], { x: 48, y: 64, collisionEnabled: false });
}

const bootstrapSource = readFileSync("src/build/assetRuntimeConsistencyBootstrap.js", "utf8");
const locationRuntimeSource = readFileSync("src/world/worldLocationRuntime.js", "utf8");
const buildModeSource = readFileSync("src/build/buildModeRuntime.js", "utf8");
assert(!bootstrapSource.includes("WORLD_IDS."), "fixed-world authoring has no location-ID gate");
assert(locationRuntimeSource.includes("capabilities.buildMode || capabilities.fixedWorldAuthoring"));
assert(locationRuntimeSource.includes("constructionEnabled: capabilities.buildMode"));
assert(buildModeSource.includes("assetGroups = BUILD_ASSET_GROUPS"));
assert(buildModeSource.includes("for (const group of this.assetGroups)"), "grid/move runtime can exist with an empty construction catalog");

console.log("Task #085 contracts OK");
