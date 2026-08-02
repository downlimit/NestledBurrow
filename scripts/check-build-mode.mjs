import assert from "node:assert/strict";
import { BUILD_ASSET_GROUPS, BUILD_CARPET_FRAME_BY_MASK, BUILD_SURFACE_CUSTOM_MASKS, BUILD_SURFACE_FRAME_BY_MASK, getBuildSurfaceMask, getBuildVerticalWallFrame, getBuildVerticalWallOffset, getBuildWallColumnDepthOffset, getBuildWallColumnOffset, getBuildWallFrames } from "../src/build/buildAssetCatalog.js";
import { BUILD_GRID, BuildModeRuntime, getBuildDragPoints, getBuildWallDragAxis, shouldToggleBuildMode, snapBuildPoint, snapBuildSurfacePoint, snapBuildWallDragPoint, snapBuildWallEdge } from "../src/build/buildModeRuntime.js";
import { HOUSE_FRAMES, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "../src/world/worldConfig.js";
import { HUD_DEPTH } from "../src/ui/hud.js";
import { createFacilityRuntime } from "../src/facilities/facilityRuntime.js";
import { createWorldLayout } from "../src/world/worldLayout.js";

class DisplayStub {
  constructor() {
    this.visible = true;
    this.interactive = false;
    this.listeners = new Map();
    this.lines = [];
  }
  setDepth(value) { this.depth = value; return this; }
  setVisible(value) { this.visible = value; return this; }
  setScrollFactor() { return this; }
  setOrigin() { return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setScale(value) { this.scale = value; return this; }
  clear() { this.lines = []; return this; }
  lineStyle(width, color, alpha) { this.lastLineStyle = { width, color, alpha }; return this; }
  lineBetween(...line) { this.lines.push(line); return this; }
  fillStyle() { return this; }
  fillRect() { return this; }
  fillTriangle() { return this; }
  fillRoundedRect() { return this; }
  fillEllipse() { return this; }
  fillCircle() { return this; }
  strokeRect() { return this; }
  setText(value) { this.text = value; return this; }
  setInteractive() { this.interactive = true; return this; }
  disableInteractive() { this.interactive = false; return this; }
  on(type, listener) { this.listeners.set(type, listener); return this; }
  emit(type, ...args) { this.listeners.get(type)?.(...args); }
  destroy() { this.destroyed = true; }
}

const keyboardListeners = new Map();
const inputListeners = new Map();
const sceneEventListeners = new Map();
const scene = {
  add: {
    graphics: () => new DisplayStub(),
    image: () => new DisplayStub(),
    text: () => new DisplayStub(),
    zone: () => new DisplayStub(),
  },
  input: {
    on(type, listener) { inputListeners.set(type, listener); },
    off(type, listener) { if (inputListeners.get(type) === listener) inputListeners.delete(type); },
    emit(type, ...args) { inputListeners.get(type)?.(...args); },
    keyboard: {
      on(type, listener) { keyboardListeners.set(type, listener); },
      off(type, listener) { if (keyboardListeners.get(type) === listener) keyboardListeners.delete(type); },
    },
  },
  events: {
    on(type, listener) { sceneEventListeners.set(type, listener); },
    off(type, listener) { if (sceneEventListeners.get(type) === listener) sceneEventListeners.delete(type); },
    emit(type, ...args) { sceneEventListeners.get(type)?.(...args); },
  },
};
const localizationListeners = new Set();
const localization = {
  getLocale: () => ({ fontKey: "Pixelify Sans" }),
  t: (key) => key,
  subscribe(listener) { localizationListeners.add(listener); return () => localizationListeners.delete(listener); },
};
const modeChanges = [];
const placements = [];
const demolitions = [];
const previews = [];
const previewClears = [];
const demolitionPreviews = [];
const moves = [];
const movePreviews = [];
const moveHovers = [];
const actionEvents = [];
let undoCount = 0;
let activationAllowed = true;
let movableHit = false;
const runtime = new BuildModeRuntime(scene, {
  localization,
  worldBounds: { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT },
  onModeChange: (active) => modeChanges.push(active),
  onPlace: (item, point, context) => placements.push({ item, point, context }),
  onDemolish: (point, onlyType) => {
    demolitions.push({ point, onlyType });
    return { status: "removed", type: onlyType ?? "wall" };
  },
  onPreview: (item, points) => previews.push({ item, points }),
  onPreviewClear: () => previewClears.push(true),
  onDemolitionPreview: (point) => demolitionPreviews.push(point),
  onMoveStart: (point) => movableHit
    ? { status: "picked", target: { id: "movable-bed", point, placementPosition: { x: 32, y: 48 }, snapAnchorOffset: { x: 0, y: 0 } } }
    : { status: "ignored" },
  onMove: (target, point) => moves.push({ target, point }),
  onMovePreview: (target, point) => movePreviews.push({ target, point }),
  onMoveHover: (point) => { moveHovers.push(point); return movableHit; },
  onActionBegin: (type) => actionEvents.push(`begin:${type}`),
  onActionEnd: () => actionEvents.push("end"),
  isActivationAllowed: () => activationAllowed,
  onUndo: () => { undoCount += 1; },
});

assert.deepEqual(BUILD_GRID, { step: TILE_SIZE, color: 0x42ff75, alpha: 0.1, lineWidth: 1 });
assert.equal(shouldToggleBuildMode({ repeat: false }), true);
assert.equal(shouldToggleBuildMode({ repeat: true }), false, "held Tab does not retrigger the mode");
assert.deepEqual(snapBuildPoint({ x: 35, y: 50 }), { x: 32, y: 48 });
assert.deepEqual(snapBuildSurfacePoint({ x: 41, y: 55 }), { x: 48, y: 48 }, "surface painting chooses the nearest grid intersection");
assert.deepEqual(snapBuildWallEdge({ x: 33, y: 40 }), { x: 32, y: 32, orientation: "vertical" });
assert.deepEqual(snapBuildWallEdge({ x: 40, y: 47 }), { x: 32, y: 48, orientation: "horizontal" });
assert.deepEqual(getBuildWallDragAxis({ x: 35, y: 40 }, { x: 43, y: 84 }), { x: 32, y: 48, orientation: "vertical" }, "the first meaningful movement chooses the wall axis");
assert.deepEqual(snapBuildWallDragPoint({ x: 55, y: 84 }, { x: 32, y: 48, orientation: "vertical" }), { x: 32, y: 80 }, "vertical wall drag follows grid intersections and ignores horizontal hand jitter");
assert.deepEqual(getBuildDragPoints({ x: 32, y: 48 }, { x: 80, y: 48 }), [
  { x: 48, y: 48 },
  { x: 64, y: 48 },
  { x: 80, y: 48 },
]);
assert.deepEqual(BUILD_ASSET_GROUPS.map((group) => group.id), ["tools", "ground", "walls", "furniture", "decorations"]);
assert.deepEqual(BUILD_ASSET_GROUPS.find((group) => group.id === "tools").items.map((item) => item.id), ["demolish"], "moving existing objects needs no catalog tool");
assert.deepEqual(BUILD_ASSET_GROUPS.find((group) => group.id === "walls").items.map((item) => item.id), ["wall"], "the library exposes one automatic wall brush");
assert(BUILD_ASSET_GROUPS.find((group) => group.id === "ground").items.some((item) => item.id === "parquet"), "parquet is buildable");
assert(BUILD_ASSET_GROUPS.find((group) => group.id === "ground").items.some((item) => item.id === "carpet"), "carpet is buildable");
assert.deepEqual([
  BUILD_CARPET_FRAME_BY_MASK[8],
  BUILD_CARPET_FRAME_BY_MASK[4],
  BUILD_CARPET_FRAME_BY_MASK[2],
  BUILD_CARPET_FRAME_BY_MASK[1],
], [57, 59, 81, 83], "one carpet click uses the four actual atlas corner sprites");
assert.deepEqual(getBuildWallFrames({ explicit: true }), [HOUSE_FRAMES.sideLeft], "an explicit column uses frame 3 without flipping");
assert.deepEqual(getBuildWallFrames({ north: true }), [HOUSE_FRAMES.sideLeft], "a vertical wall terminus receives a column");
assert.deepEqual(getBuildWallFrames({ south: true }), [HOUSE_FRAMES.sideLeft], "both vertical wall ends use the same upright column");
assert.deepEqual(getBuildWallFrames({ north: true, east: true, west: true }), [HOUSE_FRAMES.sideLeft], "a three-way junction receives a column");
assert.deepEqual(getBuildWallFrames({ north: true, south: true }), [], "the middle of a vertical wall keeps its wall-body sprite visible");
assert.deepEqual(getBuildWallFrames({ east: true }), [], "a horizontal end already carries its column in the cap sprite");
assert.equal(getBuildVerticalWallFrame(), HOUSE_FRAMES.wallRightCap, "an isolated vertical edge uses a visible wall-body frame");
assert.equal(getBuildVerticalWallFrame({ joinsEast: true }), HOUSE_FRAMES.wallLeftCap, "a joined vertical edge selects the matching wall-body side");
assert.equal(getBuildWallColumnOffset({ verticalTerminus: true }), -TILE_SIZE, "vertical end columns keep their bases on their grid intersections");
assert.equal(getBuildWallColumnOffset({ explicit: true }), -TILE_SIZE, "a clicked standalone column keeps its base on the intersection");
assert.equal(getBuildVerticalWallOffset(), 0, "the vertical wall body stays on its whole grid tile");
assert.equal(getBuildWallColumnDepthOffset({ verticalTerminus: true }), -1, "the upper endpoint column stays behind the wall body");
assert.equal(getBuildWallColumnDepthOffset({ verticalTerminus: true, isBottom: true }), 1, "the lower endpoint column renders in front of the wall body");
assert.equal(getBuildSurfaceMask({ northWest: true }), 1);
assert.equal(getBuildSurfaceMask({ northWest: true, northEast: true, southWest: true }), 7, "a grass island requests an inner-corner mask");
assert.equal(getBuildSurfaceMask({ northWest: true, northEast: true, southWest: true, southEast: true }), 15);
assert.equal(BUILD_SURFACE_FRAME_BY_MASK[1], 29, "one path sample renders an offset outer corner");
assert.deepEqual([
  BUILD_SURFACE_FRAME_BY_MASK[7],
  BUILD_SURFACE_FRAME_BY_MASK[11],
  BUILD_SURFACE_FRAME_BY_MASK[13],
  BUILD_SURFACE_FRAME_BY_MASK[14],
], [18, 19, 30, 31], "grass corners use the four dedicated sprites");
assert(!BUILD_SURFACE_CUSTOM_MASKS.includes(7), "dedicated grass corners do not use procedural composition");
assert.equal(BUILD_SURFACE_FRAME_BY_MASK[15], 16, "four path samples render a fill tile");
assert.equal(runtime.grid.visible, false);
assert.equal(runtime.grid.lastLineStyle.alpha, 0.1);
assert.equal(runtime.grid.lines.length, WORLD_WIDTH / TILE_SIZE + 1 + WORLD_HEIGHT / TILE_SIZE + 1);
assert.equal(runtime.openButton.visible, true, "a minimal build-menu opener stays visible while the panel is closed");
assert.equal(runtime.closeButton.visible, false);

keyboardListeners.get("keydown-TAB")({ repeat: true });
assert.equal(runtime.isActive(), false);
let prevented = false;
keyboardListeners.get("keydown-TAB")({ repeat: false, preventDefault: () => { prevented = true; } });
assert.equal(prevented, true);
assert.equal(runtime.isActive(), true);
assert.equal(runtime.grid.visible, false, "construction grid remains hidden until its debug checkbox is enabled");
runtime.setGridEnabled(true);
assert.equal(runtime.grid.visible, true, "debug setting shows the construction grid immediately");
runtime.setGridEnabled(false);
assert.equal(runtime.grid.visible, false, "debug setting hides the construction grid immediately");
assert.equal(runtime.getState().gridEnabled, false);
runtime.setGridEnabled(true);
assert.equal(runtime.grid.visible, true, "construction grid can be restored without reopening build mode");
assert.equal(runtime.panel.visible, true);
assert.equal(runtime.openButton.visible, false);
assert.equal(runtime.closeButton.visible, true, "the open panel exposes a compact close button");
assert(runtime.panel.depth > HUD_DEPTH, "the library renders above the day-night multiply overlay");
assert.equal(runtime.getState().selectedId, null, "opening build mode always starts in dedicated object-movement mode");
assert(modeChanges.at(-1), "entering build mode emits its visibility lifecycle");
let undoPrevented = false;
keyboardListeners.get("keydown-Z")({ ctrlKey: true, repeat: false, preventDefault: () => { undoPrevented = true; } });
assert.equal(undoPrevented, true, "Ctrl+Z is captured while build mode is active");
assert.equal(undoCount, 1, "Ctrl+Z requests one editor undo");

function selectLibraryItem(entry) {
  runtime.setScrollOffset(Math.max(0, entry.baseY - 140));
  const pointer = { x: entry.x + 1, y: entry.baseY - runtime.getState().scrollOffset + 1, id: 3, event: { timeStamp: 10 } };
  scene.input.emit("pointerdown", pointer);
  scene.input.emit("pointerup", pointer);
}

const placementsBeforePanelDrag = placements.length;
scene.input.emit("pointerdown", { x: 20, y: 110, id: 91, event: { timeStamp: 10 } });
scene.input.emit("pointermove", { x: 23, y: 70, id: 91, event: { timeStamp: 30 } });
assert(runtime.getState().scrollOffset > 0, "vertical touch drag scrolls the build library");
assert.equal(placements.length, placementsBeforePanelDrag, "panel drag never starts world placement");
const offsetAfterDrag = runtime.getState().scrollOffset;
scene.input.emit("pointerup", { x: 23, y: 70, id: 91, event: { timeStamp: 31 } });
scene.events.emit("update", 0, 16);
assert(runtime.getState().scrollOffset >= offsetAfterDrag, "release carries a bounded scroll inertia");
scene.input.emit("pointerdown", { x: 20, y: 100, id: 92, event: { timeStamp: 40 } });
scene.input.emit("pointercancel", { id: 92 });
assert.equal(runtime.panelDrag, null, "pointer cancellation clears the panel gesture");
runtime.setScrollOffset(0);

const demolishEntry = runtime.objects.find((entry) => entry.type === "item" && entry.item.id === "demolish");
selectLibraryItem(demolishEntry);
scene.input.emit("pointermove", { x: 200, worldX: 35, worldY: 50, isDown: false });
assert.deepEqual(demolitionPreviews.at(-1), { x: 32, y: 48, rawX: 35, rawY: 50 }, "demolition hover identifies the precise target before click");
scene.input.emit("pointerdown", { x: 200, worldX: 35, worldY: 50 });
assert.deepEqual(demolitions[0], { point: { x: 32, y: 48, rawX: 35, rawY: 50 }, onlyType: null }, "demolition keeps snapped and precise world coordinates");
scene.input.emit("pointermove", { x: 220, worldX: 49, worldY: 50, isDown: true });
assert.equal(demolitions[1].onlyType, "wall", "demolition drag locks to the first removed object type");
scene.input.emit("pointerup", {});
const pathEntry = runtime.objects.find((entry) => entry.type === "item" && entry.item.id === "path");
selectLibraryItem(pathEntry);
movableHit = true;
const moveHoverCountBeforeSurface = moveHovers.length;
scene.input.emit("pointermove", { x: 200, worldX: 35, worldY: 50, isDown: false });
assert.equal(moveHovers.length, moveHoverCountBeforeSurface, "ground brushes suppress existing-object move hover");
const movesBeforeSurface = moves.length;
scene.input.emit("pointerdown", { x: 200, worldX: 35, worldY: 50 });
scene.input.emit("pointermove", { x: 220, worldX: 67, worldY: 82, isDown: true });
scene.input.emit("pointerup", {});
assert.equal(moves.length, movesBeforeSurface, "ground brushes cannot pick up an existing object");
movableHit = false;
assert.equal(runtime.getState().selectedId, "path", "library selection is explicit");
placements.length = 0;
scene.input.emit("pointerdown", { x: 200, worldX: 35, worldY: 50 });
assert.equal(placements.length, 0, "pointerdown creates only a build preview");
assert.deepEqual(previews.at(-1).points, [{ x: 32, y: 48, rawX: 35, rawY: 50 }], "the preview starts on the snapped world grid");
scene.input.emit("pointermove", { x: 260, worldX: 83, worldY: 50, isDown: true });
assert.equal(placements.length, 0, "drag prediction does not mutate the world");
assert.deepEqual(previews.at(-1).points.map(({ x, y }) => ({ x, y })), [
  { x: 32, y: 48 },
  { x: 48, y: 48 },
  { x: 64, y: 48 },
  { x: 80, y: 48 },
], "paint preview fills skipped ground cells");
scene.input.emit("pointerup", {});
assert.deepEqual(placements.map(({ point }) => ({ x: point.x, y: point.y })), [
  { x: 32, y: 48 },
  { x: 48, y: 48 },
  { x: 64, y: 48 },
  { x: 80, y: 48 },
], "paint drag commits all predicted cells on pointerup");

const bedEntry = runtime.objects.find((entry) => entry.type === "item" && entry.item.id === "bed");
selectLibraryItem(bedEntry);
movableHit = true;
const movesBeforeOccupiedPlacement = moves.length;
const placementsBeforeOccupiedPlacement = placements.length;
scene.input.emit("pointerdown", { x: 200, worldX: 35, worldY: 50 });
assert.equal(runtime.drag?.mode, "place", "a selected catalog object stays in placement mode over an existing movable object");
scene.input.emit("pointermove", { x: 220, worldX: 67, worldY: 82, isDown: true });
scene.input.emit("pointerup", {});
assert.equal(moves.length, movesBeforeOccupiedPlacement, "occupied placement never picks up the object under the cursor");
assert.equal(placements.length, placementsBeforeOccupiedPlacement + 1, "occupied placement still delegates final validity to the world placement contract");

selectLibraryItem(bedEntry);
assert.equal(runtime.getState().selectedId, null, "clicking the selected catalog object again enters dedicated movement mode");
const hoverCountBeforeMoveMode = moveHovers.length;
scene.input.emit("pointermove", { x: 200, worldX: 35, worldY: 50, isDown: false });
assert.equal(moveHovers.length, hoverCountBeforeMoveMode + 1, "dedicated movement mode highlights an existing object under the cursor");
scene.input.emit("pointerdown", { x: 200, worldX: 35, worldY: 50 });
scene.input.emit("pointermove", { x: 220, worldX: 67, worldY: 82, isDown: true });
assert.deepEqual(
  (({ x, y, rawX, rawY }) => ({ x, y, rawX, rawY }))(movePreviews.at(-1).point),
  { x: 64, y: 80, rawX: 67, rawY: 82 },
  "object placement modes preserve pointer-relative movement of existing objects",
);
scene.input.emit("pointerup", {});
assert.deepEqual(
  (({ x, y, rawX, rawY }) => ({ x, y, rawX, rawY }))(moves.at(-1).point),
  { x: 64, y: 80, rawX: 67, rawY: 82 },
  "existing-object movement commits the exact preview once on release",
);

runtime.setScrollOffset(Math.max(0, bedEntry.baseY - 140));
const bedPanelY = bedEntry.baseY - runtime.getState().scrollOffset + 1;
const placementsBeforeDirectDrag = placements.length;
scene.input.emit("pointerdown", { x: bedEntry.x + 1, y: bedPanelY, id: 77, event: { timeStamp: 100 } });
scene.input.emit("pointermove", { x: 190, y: bedPanelY, worldX: 96, worldY: 112, id: 77, isDown: true, event: { timeStamp: 116 } });
assert.equal(runtime.panelDrag, null, "horizontal drag of a placeable asset leaves the catalog and starts world placement");
assert.equal(runtime.drag?.mode, "place", "catalog drag always creates a new object even over an existing movable object");
scene.input.emit("pointermove", { x: 220, y: bedPanelY, worldX: 128, worldY: 144, id: 77, isDown: true, event: { timeStamp: 132 } });
scene.input.emit("pointerup", { id: 77 });
assert.equal(placements.length, placementsBeforeDirectDrag + 1, "releasing a catalog drag places one new object at its final preview");
movableHit = false;

const wallEntry = runtime.objects.find((entry) => entry.type === "item" && entry.item.id === "wall");
selectLibraryItem(wallEntry);
movableHit = true;
const movesBeforeWall = moves.length;
const placementsBeforeWallDrag = placements.length;
scene.input.emit("pointerdown", { x: 200, worldX: 35, worldY: 40 });
assert.equal(placements.length, placementsBeforeWallDrag, "wall placement waits for the gesture direction");
scene.input.emit("pointermove", { x: 220, worldX: 43, worldY: 84, isDown: true });
assert.equal(placements.length, placementsBeforeWallDrag, "wall drag remains a preview until release");
assert.deepEqual(previews.at(-1).points.map(({ x, y }) => ({ x, y })), [
  { x: 32, y: 48 },
  { x: 32, y: 64 },
  { x: 32, y: 80 },
], "vertical wall preview follows adjacent grid vertices and ignores horizontal jitter");
scene.input.emit("pointerup", {});
assert.equal(moves.length, movesBeforeWall, "wall mode cannot pick up an existing object");
movableHit = false;
assert.deepEqual(placements.slice(placementsBeforeWallDrag).map(({ point }) => ({ x: point.x, y: point.y })), [
  { x: 32, y: 64 },
  { x: 32, y: 80 },
], "vertical wall drag commits explicit edges on pointerup");
assert.deepEqual(
  placements.slice(placementsBeforeWallDrag).map(({ context }) => ({
    gesture: context.gesture,
    previous: { x: context.previousPoint.x, y: context.previousPoint.y },
  })),
  [
    { gesture: "drag", previous: { x: 32, y: 48 } },
    { gesture: "drag", previous: { x: 32, y: 64 } },
  ],
  "wall drag passes adjacent vertex pairs instead of auto-connecting clicks",
);
const placementsBeforeWallClick = placements.length;
scene.input.emit("pointerdown", { x: 200, worldX: 40, worldY: 47 });
scene.input.emit("pointerup", {});
assert.equal(placements.length, placementsBeforeWallClick + 1, "a wall can still be placed with a single click");
assert.deepEqual(placements.at(-1).point, { x: 48, y: 48, rawX: 40, rawY: 47 }, "a wall click creates a column at the nearest grid intersection");
assert.deepEqual(placements.at(-1).context, { gesture: "click" }, "a wall click remains an isolated column gesture");
assert(actionEvents.filter((event) => event === "end").length >= 4, "every pointer gesture closes one undo group");
assert(previewClears.length > 0, "preview visuals are cleared after commit and mode changes");
scene.input.emit("wheel", {}, [], 0, 1);
assert(runtime.getState().scrollOffset > 0, "mouse wheel scrolls the asset library");
runtime.toggle();
assert.equal(runtime.isActive(), false);
assert.equal(runtime.grid.visible, true, "grid visibility is independent from the build-mode panel");
assert.equal(pathEntry.hit.interactive, false);
assert.equal(modeChanges.at(-1), false, "leaving build mode restores the ordinary UI lifecycle");
assert.equal(runtime.openButton.visible, true);
assert.equal(runtime.closeButton.visible, false);
let openerPropagationStopped = false;
const openerPointer = { id: 91, x: 10, y: 160 };
runtime.openButtonHit.emit("pointerdown", openerPointer, 0, 0, { stopPropagation() { openerPropagationStopped = true; } });
scene.input.emit("pointerdown", openerPointer);
scene.input.emit("pointerup", openerPointer);
assert.equal(runtime.isActive(), true, "the minimal opener activates build mode without Tab");
assert.equal(openerPropagationStopped, true, "the opener pointer does not leak into the newly opened catalog");
assert.equal(runtime.getState().selectedId, null, "reopening the build menu clears the previous catalog selection");
runtime.closeButtonHit.emit("pointerdown");
assert.equal(runtime.isActive(), false, "the compact close button dismisses build mode");
activationAllowed = false;
runtime.openButtonHit.emit("pointerdown");
assert.equal(runtime.isActive(), false, "runtime lock blocks the build opener during exclusive gameplay");
keyboardListeners.get("keydown-TAB")?.({ repeat: false, preventDefault() {} });
assert.equal(runtime.isActive(), false, "runtime lock blocks Tab during exclusive gameplay");
activationAllowed = true;

runtime.destroy();
assert.equal(keyboardListeners.size, 0, "cleanup removes the Tab listener");
assert.equal(inputListeners.size, 0, "cleanup removes placement and scroll listeners");
assert.equal(sceneEventListeners.size, 0, "cleanup removes scroll inertia updates");
assert.equal(localizationListeners.size, 0, "cleanup removes localization subscription");
assert.equal(runtime.grid.destroyed, true);
assert.equal(runtime.openButton.destroyed, true);
assert.equal(runtime.closeButton.destroyed, true);

const editableWorld = createWorldLayout();
const facilityRuntime = createFacilityRuntime(scene, { worldLayout: editableWorld });
assert.equal(facilityRuntime.getDefinitions().length, 8);
const placedFacility = facilityRuntime.add("table", { x: 640, y: 400 });
assert(placedFacility, "furniture placement creates a live facility");
assert.equal(facilityRuntime.getDefinitions().length, 9);
assert.equal(editableWorld.isBlockedBox({ left: 640, right: 672, top: 400, bottom: 432 }), true, "placed furniture registers collision");
assert.equal(facilityRuntime.removeAt({ x: 640, y: 400 }), true, "demolition removes placed furniture");
assert.equal(facilityRuntime.getDefinitions().length, 8);
assert.equal(facilityRuntime.restore(placedFacility), true, "undo can restore demolished furniture with the same definition");
assert.equal(facilityRuntime.getDefinitions().length, 9);
const movedFacility = facilityRuntime.move(placedFacility.id, { x: 640, y: 368 });
assert(movedFacility && facilityRuntime.getDefinition(placedFacility.id).footprint.y === 368, "move relocates furniture without cloning its ID");
assert.equal(facilityRuntime.replace(movedFacility.previous), true, "move undo restores the original furniture position");
facilityRuntime.destroy();

console.log("build mode checks passed: Tab toggle, crisp managed text, scrolling, explicit wall gestures, undo, demolition, 16 px grid, lifecycle and cleanup");
