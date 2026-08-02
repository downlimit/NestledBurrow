import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALT_HOLD_THRESHOLD_MS,
  ALT_PRESS_FEEDBACK_MS,
  COMBAT_PANEL_AREA,
  COMBAT_SLOT_DEFINITIONS,
  INVENTORY_MODE_EASE,
  INVENTORY_MODE_LAYOUTS,
  INVENTORY_MODE_TRANSITION_MS,
  INVENTORY_MODES,
  LOADOUT_EDIT_SCALE,
  createInventoryModeState,
  isPhysicalAltEvent,
  reduceInventoryModeState,
  transformPresentationRect,
} from "../src/inventoryModeRuntime.js";
import {
  INVENTORY_HUD_AREA,
  INVENTORY_SLOT_AREAS,
  inventorySlotLabelScreenPosition,
} from "../src/inventoryRuntime.js";
import {
  LOADOUT_PANELS,
  createEmptyCombatLoadout,
  createNewGameInventory,
  swapLoadoutSlots,
} from "../src/inventoryDomain.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";
import { createGameCanvasInputGuard } from "../src/gameCanvasInputGuard.js";
import {
  COMBAT_ACTION_LABEL_BOTTOM_OVERFLOW,
  combatActionLabelScreenPosition,
} from "../src/combatLoadoutRuntime.js";

let state = createInventoryModeState();
assert.deepEqual(state, {
  mode: INVENTORY_MODES.PEACEFUL,
  stableMode: INVENTORY_MODES.PEACEFUL,
  holdOriginMode: INVENTORY_MODES.PEACEFUL,
  altDown: false,
  holdTriggered: false,
  suppressed: false,
});

state = reduceInventoryModeState(state, { type: "ALT_DOWN" });
assert.equal(state.altDown, true);
state = reduceInventoryModeState(state, { type: "ALT_UP" });
assert.equal(state.mode, INVENTORY_MODES.COMBAT, "short Alt toggles PEACEFUL to COMBAT");
assert.equal(state.stableMode, INVENTORY_MODES.COMBAT);

state = reduceInventoryModeState(state, { type: "ALT_DOWN" });
state = reduceInventoryModeState(state, { type: "ALT_HOLD" });
assert.equal(state.mode, INVENTORY_MODES.LOADOUT_EDIT, "held Alt enters the transient two-panel layout");
assert.equal(state.holdOriginMode, INVENTORY_MODES.COMBAT);
state = reduceInventoryModeState(state, { type: "ALT_UP" });
assert.equal(state.mode, INVENTORY_MODES.COMBAT, "releasing held Alt returns to its origin mode");
assert.equal(state.stableMode, INVENTORY_MODES.COMBAT, "held Alt never toggles the stable mode");
assert.equal(state.altDown, false);

state = reduceInventoryModeState(state, { type: "ALT_DOWN" });
state = reduceInventoryModeState(state, { type: "ALT_HOLD" });
state = reduceInventoryModeState(state, { type: "ALT_UP", stableMode: INVENTORY_MODES.PEACEFUL });
assert.equal(state.mode, INVENTORY_MODES.PEACEFUL, "a completed transfer may activate the panel under the release pointer");

state = reduceInventoryModeState(state, { type: "ALT_DOWN" });
state = reduceInventoryModeState(state, { type: "ALT_UP" });
assert.equal(state.mode, INVENTORY_MODES.COMBAT, "short Alt still toggles after the transfer-selected mode");

state = reduceInventoryModeState(state, { type: "ALT_DOWN" });
state = reduceInventoryModeState(state, { type: "ALT_UP" });
assert.equal(state.mode, INVENTORY_MODES.PEACEFUL, "second short Alt toggles COMBAT back to PEACEFUL");

state = reduceInventoryModeState(state, { type: "ALT_DOWN" });
state = reduceInventoryModeState(state, { type: "ALT_HOLD" });
state = reduceInventoryModeState(state, { type: "RESET_INPUT" });
assert.equal(state.mode, INVENTORY_MODES.PEACEFUL, "blur/reset cannot leave LOADOUT_EDIT latched");
assert.equal(state.altDown, false);

state = reduceInventoryModeState(state, { type: "SET_SUPPRESSED", value: true });
assert.equal(state.suppressed, true);
assert.strictEqual(reduceInventoryModeState(state, { type: "ALT_DOWN" }), state, "modal suppression ignores Alt");
state = reduceInventoryModeState(state, { type: "SET_SUPPRESSED", value: false });
assert.equal(state.mode, INVENTORY_MODES.PEACEFUL);

assert.equal(ALT_HOLD_THRESHOLD_MS, 180);
assert.equal(ALT_PRESS_FEEDBACK_MS, 180);
assert.equal(INVENTORY_MODE_TRANSITION_MS, 250);
assert.equal(INVENTORY_MODE_EASE, "Sine.InOut");
assert.equal(isPhysicalAltEvent({ code: "AltLeft" }), true);
assert.equal(isPhysicalAltEvent({ code: "AltRight" }), true);
assert.equal(isPhysicalAltEvent({ code: "AltLeft", repeat: true }), false);
assert.equal(isPhysicalAltEvent({ code: "AltLeft", target: { tagName: "INPUT" } }), false);
assert.equal(isPhysicalAltEvent({ code: "AltLeft", target: { isContentEditable: true } }), false);
assert.equal(isPhysicalAltEvent({ code: "ControlLeft" }), false);

assert.deepEqual(
  COMBAT_SLOT_DEFINITIONS.map(({ label }) => label),
  ["SPACE", "LMB", "RMB", "SHIFT", "1", "2", "3", "4", "5", "6"],
  "combat panel contains exactly four action slots and six numbered slots",
);
assert.equal(COMBAT_SLOT_DEFINITIONS.length, 10);
const actionSlots = Object.fromEntries(
  COMBAT_SLOT_DEFINITIONS.filter(({ kind }) => kind === "action").map((slot) => [slot.id, slot]),
);
assert.deepEqual(
  [actionSlots.space.x, actionSlots.lmb.x, actionSlots.rmb.x, actionSlots.shift.x],
  [259, 235, 283, 259],
  "the combat cross keeps its spacing while Space aligns under the peaceful zero slot",
);
assert.equal(actionSlots.space.x, INVENTORY_SLOT_AREAS.at(-1).x, "Space is directly below the peaceful zero slot");
assert.deepEqual(
  [actionSlots.space.y, actionSlots.lmb.y, actionSlots.rmb.y, actionSlots.shift.y],
  [124, 136, 136, 148],
  "all four combat action slots move four logical pixels down",
);
assert.equal(
  actionSlots.shift.y - (actionSlots.space.y + actionSlots.space.height),
  actionSlots.shift.x - (actionSlots.lmb.x + actionSlots.lmb.width),
  "Space-to-Shift and LMB-to-Shift gaps match",
);
const actionLabelPosition = combatActionLabelScreenPosition(
  actionSlots.lmb,
  { x: 0, y: 0, scaleX: 1, scaleY: 1 },
  11,
  5,
);
assert.equal(COMBAT_ACTION_LABEL_BOTTOM_OVERFLOW, 2);
assert.equal(
  actionLabelPosition.y + 5,
  actionSlots.lmb.y + actionSlots.lmb.height + 2,
  "combat action labels extend two logical pixels below the slot bottom",
);
for (const slot of COMBAT_SLOT_DEFINITIONS) {
  assert(slot.x >= COMBAT_PANEL_AREA.x && slot.y >= COMBAT_PANEL_AREA.y);
  assert(slot.x + slot.width <= COMBAT_PANEL_AREA.x + COMBAT_PANEL_AREA.width);
  assert(slot.y + slot.height <= COMBAT_PANEL_AREA.y + COMBAT_PANEL_AREA.height);
}

const loadout = INVENTORY_MODE_LAYOUTS[INVENTORY_MODES.LOADOUT_EDIT];
const peacefulLoadoutRect = transformPresentationRect(INVENTORY_HUD_AREA, loadout.peaceful);
const combatLoadoutRect = transformPresentationRect(COMBAT_PANEL_AREA, loadout.combat);
assert.equal(LOADOUT_EDIT_SCALE, 0.8);
assert.equal(loadout.peaceful.scale, LOADOUT_EDIT_SCALE);
assert.equal(loadout.combat.scale, LOADOUT_EDIT_SCALE);
assert.equal(loadout.peaceful.y, -18, "held-Alt peaceful slots move nine logical pixels down");
assert.equal(loadout.peaceful.alpha, 1);
assert.equal(loadout.combat.alpha, 1);
assert(peacefulLoadoutRect.y + peacefulLoadoutRect.height < combatLoadoutRect.y, "LOADOUT_EDIT panels do not overlap");
for (const rect of [peacefulLoadoutRect, combatLoadoutRect]) {
  assert(rect.x >= 0 && rect.y >= 0);
  assert(rect.x + rect.width <= GAME_WIDTH && rect.y + rect.height <= GAME_HEIGHT);
}

const peaceful = INVENTORY_MODE_LAYOUTS[INVENTORY_MODES.PEACEFUL];
const combat = INVENTORY_MODE_LAYOUTS[INVENTORY_MODES.COMBAT];
assert(peaceful.combat.y > combat.combat.y, "combat panel grows into view from below");
assert(combat.peaceful.y > peaceful.peaceful.y, "peaceful panel shrinks upward when combat opens");

const mainSource = readFileSync("src/main.js", "utf8");
const hudSource = readFileSync("src/gameHud.js", "utf8");
const inventorySource = readFileSync("src/inventoryRuntime.js", "utf8");
const modeSource = readFileSync("src/inventoryModeRuntime.js", "utf8");
const combatSource = readFileSync("src/combatLoadoutRuntime.js", "utf8");
const dragSource = readFileSync("src/loadoutDragCoordinator.js", "utf8");
const persistenceSource = readFileSync("src/sessionPersistence.js", "utf8");

assert(!mainSource.includes("INVENTORY_MODES"), "composition root does not own the presentation state machine");
assert(hudSource.includes("createInventoryModeRuntime(scene"), "GameHud composes the canonical mode owner");
assert(inventorySource.includes("presentationContainer") && inventorySource.includes("setInputEnabled"), "inventory exposes a narrow screen-space adapter");
assert(modeSource.includes('event.code !== "AltLeft"') && modeSource.includes('event.code !== "AltRight"'), "physical Alt code owns the input route");
assert(modeSource.includes('globalThis.window?.addEventListener?.("blur", onBlur)'), "window blur resets held Alt");
assert(modeSource.includes('scene.events.on("pause", onBlur)') && modeSource.includes('scene.events.on("sleep", onBlur)'), "scene blur-like lifecycle resets held Alt");
const modeDestroySource = modeSource.slice(modeSource.indexOf("    destroy() {"), modeSource.indexOf("\n    },", modeSource.indexOf("    destroy() {")));
assert(!modeDestroySource.includes("resetInput("), "mode teardown never reapplies presentation or input state");
assert(modeDestroySource.includes("removeEventListener") && modeDestroySource.includes("stopTweens()"), "mode teardown detaches external listeners before disposing owned visuals");
assert(/function onBlur\(\) \{\r?\n    if \(destroyed\) return;/.test(modeSource), "late blur events cannot mutate a destroyed mode runtime");
assert(modeSource.includes("transitionTo(INVENTORY_MODES.LOADOUT_EDIT, ALT_PRESS_FEEDBACK_MS)"), "Alt keydown starts visible motion before tap/hold classification");
assert(modeSource.includes("targets: peacefulEar") && modeSource.includes("alpha: mode === INVENTORY_MODES.PEACEFUL"), "Q/E ear follows the mode transition with an opacity tween");
assert(modeSource.includes("drawFilledArrow") && modeSource.includes('"001", "011", "111", "011", "001"'), "Q/E ear uses filled three-pixel arrows");
assert(inventorySource.includes("slotLabelGraphics") && inventorySource.includes("labelScreenScale: 1"), "peaceful labels remain at one screen-space scale");
assert(combatSource.includes("labelScreenScale: 1") && combatSource.includes("syncScreenLabels"), "combat labels remain at one screen-space scale");
const peacefulNumberLabel = inventorySlotLabelScreenPosition(INVENTORY_SLOT_AREAS[0]);
const combatNumberRect = COMBAT_SLOT_DEFINITIONS.find(({ kind }) => kind === "number");
const combatNumberLabel = inventorySlotLabelScreenPosition(combatNumberRect);
assert.deepEqual(
  [peacefulNumberLabel.x - INVENTORY_SLOT_AREAS[0].x, peacefulNumberLabel.y - INVENTORY_SLOT_AREAS[0].y],
  [combatNumberLabel.x - combatNumberRect.x, combatNumberLabel.y - combatNumberRect.y],
  "peaceful and combat numbers share the same top-left in-cell anchor",
);
assert(combatSource.includes("inventorySlotLabelScreenPosition(rect, presentationContainer)"), "combat number labels reuse the peaceful slot anchor");
assert(dragSource.includes("swapLoadoutSlots") && hudSource.includes("createLoadoutDragCoordinator"), "both panels share one atomic loadout drag coordinator");
assert(modeSource.includes("stable && state.mode === INVENTORY_MODES.COMBAT"), "stable combat HUD keeps drag-to-world enabled without holding Alt");
assert(dragSource.includes("onAimTarget(pointer)") && hudSource.includes("throwAimIndicator.show(worldPointFromPointer(scene, pointer))"), "combat drag reuses the peaceful world-throw aim indicator");
assert(dragSource.includes("releasePanelAt") && modeSource.includes("stableMode: releaseMode"), "a successful transfer activates the panel under the Alt-release pointer");
assert(modeSource.includes("interactionBlocked: !state.suppressed") && modeSource.includes("state.mode !== INVENTORY_MODES.PEACEFUL"), "mode owner separates Alt/combat interaction blocking from modal suppression");
assert(hudSource.includes("isInventoryInteractionBlocked: () => inventoryModeHud.getState().interactionBlocked"), "GameHud exposes the canonical interaction block from the mode owner");
assert(hudSource.includes("inventoryHud?.clearSelection?.()"), "entering combat clears the peaceful tool selection and its target highlight");
assert(hudSource.includes("getGameplayState?.()?.sleeping")
  && hudSource.includes("getLocationOwners().facilityRuntime?.isUsing?.()")
  && hudSource.includes("getLocationOwners().cookingRuntime?.isActive?.()"), "peaceful-only sleep, facility use and cooking suppress combat inventory switching");
assert(mainSource.includes('"inventory-action-blocked"') && mainSource.includes("isInventoryInteractionBlocked"), "interaction HUD is hidden whenever inventory mode blocks interaction");
assert(mainSource.includes("interactionBlocked || this.suppressNextInteract"), "frame input ignores interaction while Alt or combat mode blocks it");
assert(!persistenceSource.includes("LOADOUT_EDIT") && !persistenceSource.includes("inventoryMode"), "UI mode remains transient and outside save data");
assert(persistenceSource.includes("migrateV10Envelope") && persistenceSource.includes("createEmptyCombatLoadout"), "schema migration initializes the persistent combat loadout");

let contextMenuListener = null;
let removedContextMenuListener = null;
const canvasInputGuard = createGameCanvasInputGuard({
  addEventListener(type, listener) {
    if (type === "contextmenu") contextMenuListener = listener;
  },
  removeEventListener(type, listener) {
    if (type === "contextmenu") removedContextMenuListener = listener;
  },
});
let contextMenuPrevented = false;
contextMenuListener({ preventDefault() { contextMenuPrevented = true; } });
assert.equal(contextMenuPrevented, true, "the game canvas suppresses the browser context menu");
canvasInputGuard.destroy();
assert.equal(removedContextMenuListener, contextMenuListener, "the canvas context-menu guard is removed with the scene");

const transferInventory = createNewGameInventory();
const transferCombat = createEmptyCombatLoadout();
const toCombat = swapLoadoutSlots(
  { inventory: transferInventory, combatLoadout: transferCombat },
  { panel: LOADOUT_PANELS.PEACEFUL, index: 4 },
  { panel: LOADOUT_PANELS.COMBAT, index: 0 },
);
assert.equal(toCombat.mutated, true);
assert.equal(transferInventory.slots[4], null);
assert.equal(transferCombat.slots[0].id, "potato-seed");
const toPeaceful = swapLoadoutSlots(
  { inventory: transferInventory, combatLoadout: transferCombat },
  { panel: LOADOUT_PANELS.COMBAT, index: 0 },
  { panel: LOADOUT_PANELS.PEACEFUL, index: 4 },
);
assert.equal(toPeaceful.mutated, true);
assert.equal(transferInventory.slots[4].id, "potato-seed");
assert.equal(transferCombat.slots[0], null);

console.log("Task #053 checks passed: tap/hold state, interaction blocking, loadout drag, readable labels, ear fade and presentation ownership");
