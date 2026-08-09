import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadFixedWorldAuthoring,
  resolveFixedWorldInstance,
} from "../src/build/fixedWorldAuthoringState.js";
import {
  ASSET_PROFILES_VERSION,
  ASSET_RENDER_MODES,
  DEFAULT_ASSET_PROFILES,
  INTERACTION_TIMELINE_FACING_MODES,
  INTERACTION_TIMELINE_SCREEN_ORIENTATIONS,
  normalizeAssetProfiles,
  resolveInteractionTimelinePresentation,
} from "../src/build/assetProfiles.js";
import {
  ASSET_AUTHORING_INSTANCE_TYPE,
  ASSET_INTERACTION_ROLES,
  assetAuthoringColliderSelectionPoint,
  createAssetAuthoringInstance,
  resolvePrimaryAssetInteractionInstance,
} from "../src/build/assetAuthoringRegistry.js";
import { decoratePlaceablePlacementAdapters } from "../src/build/placeablePlacementPose.js";
import { createPlacementDragState, resolvePlacementDrag } from "../src/build/buildWorldGeometry.js";
import { worldDepthFromAnchorY } from "../src/build/buildWorldGeometry.js";
import { resourcePlacementPoint } from "../src/build/placeableBuildGeometry.js";
import {
  doesBuildWallTopologyOwnHorizontalHalf,
  getBuildWallCapDepthOffset,
  getBuildWallColumnDepthOffset,
  getBuildWallColumnOffset,
  getBuildWallEdgeDepthOffset,
  getBuildWallEdgeVisualOffset,
  getBuildHorizontalWallBodyCrop,
  getBuildHorizontalWallVisualOffset,
  getBuildWallFrames,
  getBuildWallJunctionFrameDepthOffset,
  isBuildWallCapFrame,
} from "../src/build/buildAssetCatalog.js";
import { PLACEABLE_BUILD_OWNER_IDS } from "../src/build/placeableBuildProtocol.js";
import { createInteractionApproachResolver } from "../src/interaction/interactionApproach.js";
import { interactionDirectionAtPoint } from "../src/interaction/interactionDirections.js";
import { isInteractionBlockedByInventoryMode } from "../src/interaction/worldInteractionCoordinator.js";
import {
  createAuthoredTransitionTimelineRuntime,
  createInteractionTimelineRuntime,
  presentationPoseAtBodyCenter,
  resolveAuthoredTimelineSource,
} from "../src/needs/interactionTimelineRuntime.js";
import { createAtollWorldLayout } from "../src/world/atollWorldLayout.js";
import {
  deriveWildAtollDirection,
  getWildAtollArenaDefinition,
  getWildAtollExitPoint,
  getWildAtollSegmentDefinition,
  WILD_ATOLL_SEGMENT_IDS,
} from "../src/world/wildAtollDomain.js";
import { WORLD_IDS, getWorldLocationDefinition } from "../src/world/worldLocationConfig.js";
import { WORLD_TRANSITION_INTERACTION_KIND } from "../src/world/worldLocationConfig.js";
import { HOUSE_FRAMES } from "../src/world/worldConfig.js";
import { WorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
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
  const vertexY = 160;
  const topColumnDepth = worldDepthFromAnchorY(vertexY + getBuildWallColumnDepthOffset({
    verticalTerminus: true,
    explicit: false,
    isBottom: false,
  }), "top-column");
  const verticalWallDepth = worldDepthFromAnchorY(vertexY + 16, "vertical-wall");
  assert(topColumnDepth < verticalWallDepth, "a top column renders below the vertical wall that descends from it");

  const bottomColumnDepth = worldDepthFromAnchorY(vertexY + getBuildWallColumnDepthOffset({
    verticalTerminus: true,
    explicit: false,
    isBottom: true,
  }), "bottom-column");
  const joinedWallDepth = worldDepthFromAnchorY(vertexY, "joined-wall");
  assert(bottomColumnDepth > joinedWallDepth, "a bottom column renders above the wall that terminates into it");
  assert.equal(getBuildWallFrames({ north: true, east: true, south: true }).length, 1);
  const junctionDepth = worldDepthFromAnchorY(vertexY + getBuildWallColumnDepthOffset({
    verticalTerminus: false,
    explicit: false,
  }), "junction-column");
  assert(junctionDepth > joinedWallDepth, "a multi-wall junction column renders above every incident wall sprite");
  assert.equal(getBuildWallEdgeDepthOffset("horizontal"), 0);
  assert.equal(getBuildHorizontalWallVisualOffset(), 2, "a 4 px horizontal wall is centered 2 px below its edge");
  assert.equal(getBuildHorizontalWallBodyCrop({ leftJunction: true }).x, 8, "the authored left-edge tile replaces the first half of cell 2");
  assert.equal(getBuildHorizontalWallBodyCrop({ rightJunction: true }).width, 8, "the authored right-edge tile replaces the final half of cell 2");
  const downwardTJunction = { south: true, east: true, west: true };
  assert.equal(doesBuildWallTopologyOwnHorizontalHalf(downwardTJunction, "east"), false);
  assert.equal(doesBuildWallTopologyOwnHorizontalHalf(downwardTJunction, "west"), false);
  assert.equal(getBuildWallJunctionFrameDepthOffset({
    incidents: downwardTJunction,
    frame: 3,
    nodePivotOffset: 0,
    horizontalPivotOffset: 8,
  }), 9, "cell 4 renders above authored horizontal pivot depth");
  assert.equal(getBuildWallEdgeVisualOffset("horizontal"), 2);
  assert.equal(getBuildWallEdgeVisualOffset("vertical"), 2, "vertical wall visuals also sit 2 px below their grid-edge anchors");
  assert.equal(getBuildWallColumnOffset({ explicit: true }), -14, "a 6x6 column shares the 2 px downward visual centering");
  assert.equal(getBuildWallCapDepthOffset(), 1, "every endpoint column renders above its horizontal wall");
  assert.equal(getBuildWallEdgeDepthOffset("vertical"), 16, "a descending vertical wall renders above its top column");
  assert.equal(isBuildWallCapFrame(HOUSE_FRAMES.topLeft), true);
  assert.equal(isBuildWallCapFrame(HOUSE_FRAMES.bottomRight), true);
  assert.equal(isBuildWallCapFrame(HOUSE_FRAMES.top), false);
}

assert.equal(isInteractionBlockedByInventoryMode({ inventoryBlocked: true, candidateKind: "work-resource" }), true);
assert.equal(isInteractionBlockedByInventoryMode({
  inventoryBlocked: true,
  candidateKind: WORLD_TRANSITION_INTERACTION_KIND,
}), false, "every typed world transition remains usable in combat mode");

assert.deepEqual(
  resourcePlacementPoint({ cell: { x: 94, y: 44 }, visualPosition: { x: 736, y: 304 } }),
  { x: 736, y: 304 },
  "legacy canonical resources enter pickup through their actual visual placement coordinate",
);

{
  const platform = { id: "teleport:platform", profileKey: "transition:platform", moveGroupId: "teleport" };
  const construct = { id: "teleport:construct", profileKey: "transition:construct", moveGroupId: "teleport" };
  const profiles = {
    "transition:platform": { interactionTimeline: { enabled: false } },
    "transition:construct": { interactionTimeline: { enabled: true, walkDuringRelocation: true } },
  };
  assert.equal(
    resolveAuthoredTimelineSource([platform, construct], platform, (key) => profiles[key]),
    construct,
    "a grouped teleport uses the member whose authored timeline is enabled",
  );
}
{
  const platform = { id: "teleport:platform", moveGroupId: "teleport", interactionRole: ASSET_INTERACTION_ROLES.support };
  const crystal = { id: "teleport:crystal", moveGroupId: "teleport", interactionRole: ASSET_INTERACTION_ROLES.primary };
  assert.equal(
    resolvePrimaryAssetInteractionInstance([platform, crystal], platform),
    crystal,
    "a grouped transition keeps independent support authoring while gameplay targets its primary asset",
  );
  assert.equal(
    interactionDirectionAtPoint({ left: 10, right: 30, top: 20, bottom: 40 }, { x: 42, y: 30 }),
    "right",
    "the primary collider resolves the player's authored approach direction",
  );
}
assert.deepEqual(
  resourcePlacementPoint({ cell: { x: 3.5, y: 4.25 } }),
  { x: 28, y: 34 },
  "resource placement keeps sub-cell coordinates required by authored midpoint snapping",
);

{
  const instance = createAssetAuthoringInstance({
    id: "typed-glider",
    profileKey: "transition:atoll-path-north",
    anchor: { x: 10, y: 20 },
    bounds: { left: 10, right: 74, top: 20, bottom: 68 },
    targets: [displayObject()],
    setCollisionEnabled() {},
  });
  assert.equal(instance.authoringType, ASSET_AUTHORING_INSTANCE_TYPE);
  for (const capability of ["collider", "pivot", "approachDirections", "interactionPoint", "renderMode", "timeline", "collisionToggle"]) {
    assert.equal(instance.authoringCapabilities[capability], true, `typed fixed-world instance exposes ${capability}`);
  }
  const scene = {
    worldLayout: {
      getWorldObjectColliders: () => [{
        id: "typed-glider",
        rect: { left: 500, right: 532, top: 700, bottom: 708 },
      }],
    },
  };
  assert.deepEqual(
    assetAuthoringColliderSelectionPoint(scene, instance),
    { x: 516, y: 704 },
    "a sprite click resolves the actual collider even when it is far outside the visual bounds",
  );
}

{
  const scene = {
    assetProfiles: {
      "furniture:bed": { snapAnchorOffset: { x: 4, y: 12 } },
      "facility:table": { snapAnchorOffset: { x: 4, y: 12 } },
      "facility:tavern-sign": { snapAnchorOffset: { x: 4, y: 12 } },
      "melee:training-dummy": { snapAnchorOffset: { x: 4, y: 12 } },
    },
    worldLayout: {
      getEffectiveCollider: (rect) => ({
        left: rect.left + 2,
        right: rect.right - 2,
        top: rect.top + 4,
        bottom: rect.bottom,
      }),
    },
  };
  const cases = [
    [PLACEABLE_BUILD_OWNER_IDS.bed, { profileKey: "furniture:bed" }],
    [PLACEABLE_BUILD_OWNER_IDS.facility, { facilityType: "table" }],
    [PLACEABLE_BUILD_OWNER_IDS.tavernSign, {}],
    [PLACEABLE_BUILD_OWNER_IDS.trainingDummy, {}],
  ];
  const adapters = decoratePlaceablePlacementAdapters(scene, {}, cases.map(([id, value]) => ({
    id,
    getPlacementAnchorOffset: () => ({ x: 0, y: 0 }),
    getTargetAt: () => ({ id: `placed-${id}`, ...value, placementPosition: { x: 32, y: 48 } }),
  })));
  for (const [index, [id, value]] of cases.entries()) {
    const constructionAnchor = adapters[index].getPlacementAnchorOffset(value);
    const moveAnchor = adapters[index].getTargetAt({ x: 32, y: 48 }).snapAnchorOffset;
    assert.deepEqual(
      moveAnchor,
      constructionAnchor,
      `${id} construction and move use the same shared authored midpoint anchor`,
    );
  }
  const drag = createPlacementDragState({
    placementPosition: { x: 32, y: 48 },
    pointer: { x: 37, y: 52 },
    snapAnchorOffset: adapters[0].getTargetAt({ x: 32, y: 48 }).snapAnchorOffset,
  });
  assert.deepEqual(
    resolvePlacementDrag(drag, { x: 37, y: 52 }, 16),
    { x: 26, y: 53, anchor: { x: 32, y: 64 } },
    "pickup and move snap the same canonical anchor regardless of the grabbed pixel",
  );
}

{
  const profiles = normalizeAssetProfiles({ version: 5, profiles: {} });
  assert.equal(ASSET_PROFILES_VERSION, 10);
  assert.equal(profiles["transition:atoll-path-north"].renderMode, ASSET_RENDER_MODES.belowCharacter);
  assert.equal(profiles["facility:shower"].interactionTimeline.enabled, true);
  assert.equal(profiles["facility:shower"].interactionTimeline.enterMs, 700);
  assert.deepEqual(profiles["furniture:bed"].interactionTimeline.positionOffset, { x: 0, y: -1 });
  assert.equal(profiles["furniture:bed"].interactionTimeline.facing, INTERACTION_TIMELINE_FACING_MODES.keepCurrent);
  assert.equal(
    profiles["furniture:bed"].interactionTimeline.screenOrientation,
    INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.counterClockwise90,
  );
  assert.equal(profiles["transition:atoll-path-north"].interactionTimeline.facing, INTERACTION_TIMELINE_FACING_MODES.keepCurrent);
  assert.equal(profiles["facility:table"].interactionPadding, 16, "typed assets default to one collider-padding tile of interaction reach");
  assert.equal(profiles["facility:table"].interactionTimeline.walkDuringRelocation, false);
  assert.equal(profiles["facility:table"].interactionTimeline.enabled, false, "eating keeps the resolved approach point unless a table timeline is explicitly authored");
  assert.deepEqual(profiles["facility:tavern-sign"].snapAnchorOffset, { x: 0, y: 0 }, "the poisoned legacy sign pivot migrates back to its authored foot point");
  assert.equal(profiles["facility:serving-table"].collisionEnabled, true, "blocking facilities expose their real collision state");
  assert.equal(normalizeAssetProfiles({
    version: 7,
    profiles: { "facility:serving-table": { collisionEnabled: false } },
  })["facility:serving-table"].collisionEnabled, false, "collision authoring persists in the typed asset profile");
  assert.deepEqual(
    resolveInteractionTimelinePresentation({
      facing: INTERACTION_TIMELINE_FACING_MODES.keepCurrent,
      screenOrientation: INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.clockwise90,
    }, { facing: "left" }),
    { facing: "left", angle: 90 },
    "timeline presentation keeps the current facing and applies a typed screen-space rotation",
  );
  assert.equal(normalizeAssetProfiles({
    version: 9,
    profiles: {
      "facility:table": {
        interactionTimeline: {
          enabled: true,
          positionOffset: { x: -48, y: 16 },
          enterMs: 500,
          exitMs: 650,
          facing: "keep-current",
          screenOrientation: "original",
          walkDuringRelocation: false,
        },
      },
    },
  })["facility:table"].interactionTimeline.enabled, false, "the legacy hard-coded table relocation is removed during migration");
}

{
  const collider = { left: 0, right: 100, top: 0, bottom: 16 };
  const resolver = createInteractionApproachResolver({
    worldLayout: {
      getResourceCollider: () => null,
      getWorldObjectColliders: () => [{ id: "long-table", rect: collider, groupKey: "facility:table" }],
    },
    getPlayer: () => ({ footWidth: 8, footDepth: 5 }),
    getAssetProfile: () => ({ interactionPadding: 16 }),
  });
  const definition = {
    id: "long-table",
    entityId: "long-table",
    profileKey: "facility:table",
    position: { x: 50, y: 8 },
    aimPosition: { x: 50, y: 8 },
    radius: 42,
    targetingMode: "facing-first",
    targetingGroup: "world-placeable",
    payload: {},
  };
  assert.equal(
    resolver.probe(definition, { position: { x: 90, y: 33 } }),
    null,
    "authored interaction padding rejects points beyond the closest collider edge",
  );
  assert.equal(
    resolver.probe(definition, { position: { x: 90, y: 32 } })?.radius,
    16,
    "a long table is reachable along its full collider perimeter without a center-radius shortcut",
  );
}

{
  let pose = { x: 0, y: 0 };
  const timeline = createInteractionTimelineRuntime({
    getPresentationPosition: () => pose,
    getMotorPosition: () => ({ x: 0, y: 0 }),
    setPresentationPose: (value) => { pose = value ?? { x: 0, y: 0 }; },
  });
  timeline.begin({
    profileId: "shower",
    profileOverride: { enabled: true, enterMs: 125, exitMs: 275, walkDuringRelocation: true },
    targetPose: { x: 8, y: 9 },
  });
  timeline.update(124);
  assert.equal(timeline.getState().phase, "enter");
  assert.equal(pose.walking, true, "authored relocation can play the directional walk animation");
  timeline.update(1);
  assert.equal(timeline.getState().phase, "active", "authored enter duration drives the real timeline");
  assert.equal(pose.walking, false, "walk animation stops when relocation reaches its target");
  timeline.requestExit();
  timeline.update(274);
  assert.equal(timeline.getState().phase, "exit");
  timeline.update(1);
  assert.equal(timeline.getState().phase, "free", "authored exit duration drives the real timeline");
}

{
  const player = {
    sprite: { x: 0, y: 0, originX: 0.5, originY: 1, displayWidth: 16, displayHeight: 16 },
    motor: { position: { x: 0, y: 0 }, movement: { velocity: { x: 4, y: 3 } } },
    visual: { lastFacing: "left", setPresentationPose(value) { this.pose = value; } },
  };
  let activations = 0;
  const runtime = createAuthoredTransitionTimelineRuntime({
    getPlayer: () => player,
    getAssetProfile: () => ({
      interactionTimeline: {
        enabled: true,
        positionOffset: { x: -3, y: 2 },
        enterMs: 100,
        exitMs: 500,
        facing: "keep-current",
        screenOrientation: "original",
        walkDuringRelocation: true,
      },
    }),
  });
  assert.equal(runtime.begin({
    profileKey: "transition:test",
    collider: { left: 10, right: 30, top: 20, bottom: 40 },
    activate: () => { activations += 1; return true; },
  }).status, "entering");
  assert.deepEqual(player.motor.movement.velocity, { x: 0, y: 0 }, "authored transition entry locks movement");
  runtime.update(99);
  assert.equal(activations, 0, "location activation waits for the authored entry duration");
  assert.equal(player.visual.pose.facing, "left", "transition entry preserves the facing held at interaction time");
  assert.equal(player.visual.pose.walking, true);
  runtime.update(1);
  assert.equal(activations, 1, "location activation runs only after the player reaches the authored timeline point");
  assert.equal(runtime.isLocked(), false, "completed location transitions immediately release the next interaction");
  assert.equal(player.visual.pose, null, "transition completion clears the temporary presentation pose");
}

{
  const player = {
    sprite: { x: 0, y: 0, originX: 0.5, originY: 1, displayWidth: 16, displayHeight: 16 },
    motor: { position: { x: 0, y: 0 }, movement: { velocity: { x: 0, y: 0 } } },
    visual: { lastFacing: "up", setPresentationPose(value) { this.pose = value; } },
  };
  const profiles = {
    "transition:test-live": {
      interactionTimeline: {
        enabled: true,
        positionOffset: { x: 0, y: 0 },
        enterMs: 120,
        exitMs: 0,
        facing: "keep-current",
        screenOrientation: "original",
        walkDuringRelocation: true,
      },
    },
  };
  let activations = 0;
  const coordinator = new WorldLocationCoordinator({
    sessionState: { currentWorldId: WORLD_IDS.village },
    createLayout: () => ({}),
    getAssetProfiles: () => profiles,
    getPlayerCharacter: () => player,
    canTransition: () => true,
  });
  coordinator.activeDefinition = { id: WORLD_IDS.village };
  coordinator.activeLayout = {
    transitions: [{ id: "live-stair", profileKey: "transition:test-live" }],
    getWorldObjectColliders: () => [{ id: "live-stair", rect: { left: 12, right: 28, top: 24, bottom: 32 } }],
  };
  coordinator.transition = () => { activations += 1; return { status: "transitioned", transitioned: true }; };
  assert.equal(coordinator.handleInteraction({
    kind: WORLD_TRANSITION_INTERACTION_KIND,
    payload: { transitionId: "live-stair" },
  }).status, "entering", "the real world-location coordinator starts the live authored timeline");
  coordinator.update(119);
  assert.equal(activations, 0, "the real world transition cannot activate before authored relocation completes");
  assert.equal(player.visual.pose.walking, true, "the real world transition forwards walkDuringRelocation");
  coordinator.update(1);
  assert.equal(activations, 1, "the real world transition activates at the authored entry duration");
}

assert.deepEqual(
  presentationPoseAtBodyCenter(
    { x: 30, y: 40, angle: 0 },
    { originX: 0.5, originY: 1, displayWidth: 16, displayHeight: 16 },
  ),
  { x: 30, y: 48, angle: 0, originX: 0.5, originY: 1 },
  "timeline point aligns to the character body center instead of the foot pivot",
);

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
  const scene = { add: { image: (x, y) => displayObject().setPosition(x, y) } };
  const runtime = new WorldPresentationRuntime({ renderingHost: scene, authoringStorage: new MemoryStorage() });
  runtime.mount({
    groundTiles: [],
    houseFloorTiles: [],
    houseWallTiles: [
      { id: "horizontal", y: 96, orientation: "horizontal", worldX: 0, worldY: 96, frame: HOUSE_FRAMES.top, supplements: [] },
      { id: "column", y: 96, orientation: "horizontal", worldX: -8, worldY: 96, frame: HOUSE_FRAMES.topLeft, supplements: [] },
      { id: "vertical", y: 96, orientation: "vertical", worldX: -8, worldY: 96, frame: HOUSE_FRAMES.wallLeftCap, supplements: [] },
    ],
    decorationTiles: [],
    transportTiles: [],
  });
  const horizontalDepth = runtime.wallSprites.get("horizontal").sprite.depth;
  const columnDepth = runtime.wallSprites.get("column").sprite.depth;
  const verticalDepth = runtime.wallSprites.get("vertical").sprite.depth;
  assert(horizontalDepth < columnDepth, "canonical column renders above its horizontal wall");
  assert(columnDepth < verticalDepth, "canonical column renders below its descending vertical wall");
  assert.equal(runtime.wallSprites.get("horizontal").sprite.y, 98, "canonical horizontal walls apply the shared 2 px visual offset");
  assert.equal(runtime.wallSprites.get("column").sprite.y, 98, "canonical cap columns apply the shared 2 px visual offset");
  assert.equal(runtime.wallSprites.get("vertical").sprite.y, 98, "canonical vertical wall visuals share the 2 px grid-edge offset");
  runtime.destroy();
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
const authoringUiSource = readFileSync("src/build/editorAuthoringBootstrap.js", "utf8");
const authoringRegistrySource = readFileSync("src/build/assetAuthoringRegistry.js", "utf8");
const atollRuntimeSource = readFileSync("src/world/wildAtollRuntime.js", "utf8");
const interactionRuntimeSource = readFileSync("src/interaction/interactionRuntime.js", "utf8");
const facilityRuntimeSource = readFileSync("src/facilities/facilityRuntime.js", "utf8");
const debugPanelSource = readFileSync("src/devtools/movementDebugPanel.js", "utf8");
const mainSource = readFileSync("src/main.js", "utf8");
const signSource = readFileSync("src/tavern/tavernSignRuntime.js", "utf8");
const gridAuthoringSource = readFileSync("src/build/assetGridAuthoringBootstrap.js", "utf8");
const placementPoseSource = readFileSync("src/build/placeablePlacementPose.js", "utf8");
const worldBuildSource = readFileSync("src/build/worldBuildCoordinator.js", "utf8");
const universalAuthoringSource = readFileSync("src/build/universalPlaceableAuthoring.js", "utf8");
const interactionApproachSource = readFileSync("src/interaction/interactionApproach.js", "utf8");
const characterVisualSource = readFileSync("src/character/characterVisual.js", "utf8");
const styleSource = readFileSync("src/style.css", "utf8");
assert(!bootstrapSource.includes("WORLD_IDS."), "fixed-world authoring has no location-ID gate");
assert(locationRuntimeSource.includes("capabilities.buildMode || capabilities.fixedWorldAuthoring"));
assert(locationRuntimeSource.includes("constructionEnabled: capabilities.buildMode"));
assert(locationRuntimeSource.includes("this.renderingHost.wildAtollRuntime"), "Atoll transitions have one shared keyboard/timeline owner");
assert(buildModeSource.includes("assetGroups = BUILD_ASSET_GROUPS"));
assert(buildModeSource.includes("for (const group of this.assetGroups)"), "grid/move runtime can exist with an empty construction catalog");
for (const mode of ["collider", "pivot", "visual-offset", "crop", "interaction", "interaction-point", "render", "timeline"]) {
  assert(authoringUiSource.includes(`\"${mode}\"`) || authoringUiSource.includes(`${mode}:`), `shared authoring UI exposes ${mode}`);
}
assert(authoringUiSource.includes("nudgeInteractionOffset"), "interaction point uses the shared 1 px arrow workflow");
assert(authoringUiSource.includes("positionOffset.x + delta.x"), "timeline point uses the shared 1 px arrow workflow");
assert(authoringRegistrySource.includes("transitionInstances(scene)"), "stairs and gliders use the same typed authoring registry");
for (const profileKey of ["build:wall:horizontal", "build:wall:vertical", "build:wall-node"]) {
  assert(DEFAULT_ASSET_PROFILES[profileKey], `${profileKey} has a typed authoring profile`);
}
assert(authoringRegistrySource.includes("getWallAuthoringInstances"), "walls and columns use the shared typed authoring registry");
assert(atollRuntimeSource.includes("interactionOffset"), "Atoll Space interaction follows the authored interaction point");
assert(atollRuntimeSource.includes("const selectedExit = candidate.exit"), "Atoll timeline captures its exit before candidate lock clears the prompt");
assert(atollRuntimeSource.includes("pendingTransitionActivation = activate"), "arena teardown runs after the timeline completion callback has released its state");
assert(!authoringUiSource.includes("hasAuthorableInstances"), "the full authoring menu never depends on mount-time instance availability");
assert(authoringUiSource.includes("Дебаг рендер"), "the visibility control names the complete authoring debug render");
assert(authoringUiSource.includes("if (!panel.colliderCheckbox.checked) setAuthoringMode(panel, null)"), "disabling debug render forcibly exits every editor mode");
assert(authoringUiSource.includes("restoreSelectedAssetForMode(panel, mode)"), "switching editor modes preserves the selected asset");
assert(authoringUiSource.includes("renderAssetDebugMarkers"), "debug render includes pivots, interaction points and approach points");
assert(authoringUiSource.includes("0.3, 1"), "the global 3x3 pivot cross uses the requested 30 percent alpha");
assert(authoringUiSource.includes("saveAssetProfiles(this.scene?.assetProfiles"));
assert(!authoringUiSource.includes("saveAssetProfilesToProject"), "ordinary profile apply cannot trigger a Vite source reload");
for (const removed of ["Сбросить баланс-забег", "Потребности:", "Прочность большого бревна", "малые брёвна", "дерево ${snapshot.wood}"]) {
  assert(!debugPanelSource.includes(removed), `debug panel omits ${removed}`);
}
assert(mainSource.includes("this.debugPanelOpen"), "opening debug authoring suppresses the gameplay HUD");
assert(mainSource.includes("getAssetProfiles: () => this.assetProfiles"), "world transition timelines consume live authored profiles from the scene");
assert(signSource.includes("assetDepthFromRenderMode"), "the tavern sign honors its authored render mode");
assert(authoringUiSource.includes("TIMELINE_FACING_LABELS"), "timeline authoring exposes typed character-facing modes");
assert(authoringUiSource.includes("TIMELINE_SCREEN_ORIENTATION_LABELS"), "timeline authoring exposes typed screen-space rotations");
assert(authoringUiSource.includes("Перс играет анимацию ходьбы во время релокейта"));
assert(characterVisualSource.includes("this.presentationPose.walking"), "presentation relocation can play the shared directional walk cycle");
assert(authoringUiSource.includes("Дистанция интеракта от коллайдера, px"));
assert(authoringUiSource.includes("strokeRoundedRect"), "debug range renders the rounded collider padding used by availability checks");
assert(interactionApproachSource.includes("getAssetProfile(interactionProfileKey(definition))"), "all typed interactions resolve authored padding through the shared approach system");
assert(facilityRuntimeSource.includes("collisionEnabled: scene.assetProfiles?.[profileKey]?.collisionEnabled !== false"), "serving-table collision UI reflects the blocking collider contract");
assert(styleSource.includes(".collider-debug-wide-control[hidden]"), "collision toggle is visually absent outside collider selection");
assert(gridAuthoringSource.includes('["crop", "interaction-point", "timeline"]'), "global WASD/arrow capture forwards interaction and timeline point editing");
assert(mainSource.includes("selection?.id === entry.id"), "a collider miss-click on the selected object preserves its edited draft");
assert(!placementPoseSource.includes("usesTopLeftMoveGridAnchor"), "create and move share one anchor contract for every placeable owner");
assert(placementPoseSource.includes("registeredCollider(scene, instanceId"), "move snapping derives from the instance collider actually used by the world");
assert(worldBuildSource.includes("this.getBuildWallFrameDepthOffset(point, frame)"), "rendered horizontal cap sprites use topology-aware depth instead of hash tie order");
assert(worldBuildSource.includes("isBuildWallCapFrame(frame)"), "every rendered wall cap uses the shared intermediate column layer");
assert(worldBuildSource.includes("BUILD_WALL_TOPOLOGY_FRAMES"), "constructed walls consume the authored 16 px atlas topology directly");
assert(worldBuildSource.includes("getBuildHorizontalWallBodyCrop"), "horizontal edge and preview rendering share the atlas end-tile ownership contract");
const wallCatalogImportSource = worldBuildSource.match(/import \{[\s\S]*?\} from "\.\/buildAssetCatalog\.js";/)?.[0] ?? "";
assert(wallCatalogImportSource.includes("doesBuildWallTopologyOwnHorizontalHalf"), "the live coordinator imports the typed horizontal-half ownership resolver");
assert(worldBuildSource.includes('previewIncidents(first, index), "east"'), "wall previews preserve cell 2 beneath downward T junctions");
assert(worldBuildSource.includes('this.getBuildWallIncidents({ x: point.x, y: point.y }),\n        "east"'), "live wall bodies use typed east-half ownership");
assert(worldBuildSource.includes("getBuildWallJunctionFrameDepthOffset"), "live junction rendering uses typed per-frame topology depth");
assert(worldBuildSource.includes("horizontalPivotOffset"), "cell 4 overlay depth accounts for independently authored horizontal-wall pivots");
assert(worldBuildSource.includes("getBuildWallEdgeSpriteTargets"), "downward-T overlay reads both incident wall sprites instead of predicting their layer");
assert(worldBuildSource.includes("getBuildWallHorizontalOverlayDepth"), "cell 4 resolves above the actual rendered depth of continuous cell 2");
assert(worldBuildSource.includes("presentationManagedByOwner: true"), "wall sprites declare the wall coordinator as their presentation owner");
assert(universalAuthoringSource.includes("if (instance.presentationManagedByOwner) return;"), "the per-frame universal authoring sync cannot overwrite wall topology depth");
assert(universalAuthoringSource.includes("owners.worldBuildCoordinator?.applyWallAuthoringProfile?.(profileKey)"), "universal pivot and visual edits delegate wall depth reconstruction to its owner");
assert(universalAuthoringSource.includes("getColliderResizeEdges(worldPoint, scene.colliderEditSelection.draft)"), "a visible active collider handle keeps its real pointer coordinate through universal asset selection");
assert(mainSource.includes("getColliderResizeHandles(draft)"), "collider handle rendering consumes the same geometry as hit testing");
assert(worldBuildSource.includes("applyWallAuthoringProfile"), "wall and column pivot edits refresh every instance of their shared profile");
const wallProfileApplySource = worldBuildSource.match(/applyWallAuthoringProfile\(profileKey\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
assert(wallProfileApplySource.includes("this.refreshAllBuildWallJunctions()"), "wall profile edits invalidate every cached junction depth");
assert(
  wallProfileApplySource.lastIndexOf("this.refreshBuildWallEdgeVisual")
    < wallProfileApplySource.lastIndexOf("this.refreshAllBuildWallJunctions()"),
  "wall profile refresh rebuilds body sprites before junction overlays",
);
const wallTopologyRefreshSource = worldBuildSource.match(/refreshBuildWallTopologyAtVertices\(vertices\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
assert(
  wallTopologyRefreshSource.indexOf("this.refreshBuildWallEdgesAtVertex")
    < wallTopologyRefreshSource.indexOf("this.refreshBuildWallJunction"),
  "topology mutations rebuild every incident body before their junction overlays",
);
assert(worldBuildSource.includes('return [BUILD_WALL_TOPOLOGY_FRAMES.horizontalBody]'), "atlas cell 2 owns every constructed horizontal body segment");
assert(worldBuildSource.includes('{ x: vertex.x, y: vertex.y - TILE_SIZE, orientation: "vertical" }'), "topology changes refresh every incident vertical edge");
assert(atollRuntimeSource.includes('["gameplay-overlay", "option-sensitive"]'), "Atoll titles and prompts use the shared gameplay HUD visibility classes");
assert(atollRuntimeSource.includes("!collapseRecoveryActive && !hudSuppressed"), "suppressed Atoll HUD cannot leak prompts through options");
assert(mainSource.includes("isInteractionBlockedByInventoryMode"), "combat interaction filtering is routed through the typed interaction policy");
const authoringReadinessSource = authoringUiSource.match(/function isAuthoringSceneReady\(scene\) \{[\s\S]*?\n\}/)?.[0] ?? "";
assert(authoringReadinessSource.includes("worldBuildCoordinator?.getPlacedObjects"), "shared authoring waits for the location coordinator");
assert(!authoringReadinessSource.includes("scene?.buildMode"), "fixed-world authoring never depends on the construction capability");
assert(locationRuntimeSource.includes("setCurrentWorldScene(this.renderingHost)"), "all locations register the shared authoring scene");
assert(!facilityRuntimeSource.includes("setCurrentWorldScene"), "scene registration never depends on the facilities capability");
assert(interactionRuntimeSource.includes("preferredTargetId: currentCandidate?.targetId"), "interaction selection uses stable attention hysteresis");
assert(!interactionRuntimeSource.includes("if (interact && currentCandidate && currentCandidateDefinitions.length > 0)"), "Space cannot activate a stale previous-frame candidate");

console.log("Task #085 contracts OK");
