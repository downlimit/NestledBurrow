import { HUD_COLORS, drawBitmapTextInto } from "./hud.js";
import { INVENTORY_HUD_AREA, INVENTORY_SLOT_AREAS } from "./inventoryRuntime.js";

export const INVENTORY_MODES = Object.freeze({
  PEACEFUL: "PEACEFUL",
  COMBAT: "COMBAT",
  LOADOUT_EDIT: "LOADOUT_EDIT",
});

export const ALT_HOLD_THRESHOLD_MS = 180;
export const ALT_PRESS_FEEDBACK_MS = 180;
export const INVENTORY_MODE_TRANSITION_MS = 250;
export const LOADOUT_EDIT_TRANSITION_MS = 90;
export const INVENTORY_MODE_EASE = "Sine.InOut";
export const LOADOUT_EDIT_SCALE = 0.8;

const reportNumber = (value) => Number(value.toFixed(6));

export const PEACEFUL_EAR_AREA = Object.freeze({
  x: INVENTORY_HUD_AREA.x - 12,
  y: INVENTORY_HUD_AREA.y,
  width: 11,
  height: INVENTORY_HUD_AREA.height,
});

const COMBAT_SLOT_WIDTH = 22;
const COMBAT_SLOT_HEIGHT = 22;
const COMBAT_SLOT_GAP = 2;
const COMBAT_ACTION_CENTER_X = INVENTORY_SLOT_AREAS.at(-1).x;
const COMBAT_ACTION_MIDDLE_Y = 136;
const COMBAT_ACTION_VERTICAL_OFFSET = (COMBAT_SLOT_HEIGHT + COMBAT_SLOT_GAP) / 2;

export const COMBAT_SLOT_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "space", kind: "action", label: "SPACE", x: COMBAT_ACTION_CENTER_X, y: COMBAT_ACTION_MIDDLE_Y - COMBAT_ACTION_VERTICAL_OFFSET, width: COMBAT_SLOT_WIDTH, height: COMBAT_SLOT_HEIGHT }),
  Object.freeze({ id: "lmb", kind: "action", label: "LMB", x: COMBAT_ACTION_CENTER_X - COMBAT_SLOT_WIDTH - COMBAT_SLOT_GAP, y: COMBAT_ACTION_MIDDLE_Y, width: COMBAT_SLOT_WIDTH, height: COMBAT_SLOT_HEIGHT }),
  Object.freeze({ id: "rmb", kind: "action", label: "RMB", x: COMBAT_ACTION_CENTER_X + COMBAT_SLOT_WIDTH + COMBAT_SLOT_GAP, y: COMBAT_ACTION_MIDDLE_Y, width: COMBAT_SLOT_WIDTH, height: COMBAT_SLOT_HEIGHT }),
  Object.freeze({ id: "shift", kind: "action", label: "SHIFT", x: COMBAT_ACTION_CENTER_X, y: COMBAT_ACTION_MIDDLE_Y + COMBAT_ACTION_VERTICAL_OFFSET, width: COMBAT_SLOT_WIDTH, height: COMBAT_SLOT_HEIGHT }),
  ...["1", "2", "3", "4", "5", "6"].map((label, index) => Object.freeze({
    id: `number-${label}`,
    kind: "number",
    label,
    x: INVENTORY_HUD_AREA.x + index * (COMBAT_SLOT_WIDTH + COMBAT_SLOT_GAP),
    y: INVENTORY_HUD_AREA.y,
    width: COMBAT_SLOT_WIDTH,
    height: COMBAT_SLOT_HEIGHT,
  })),
]);

const combatPanelLeft = Math.min(...COMBAT_SLOT_DEFINITIONS.map(({ x }) => x));
const combatPanelTop = Math.min(...COMBAT_SLOT_DEFINITIONS.map(({ y }) => y));
const combatPanelRight = Math.max(...COMBAT_SLOT_DEFINITIONS.map(({ x, width }) => x + width));
const combatPanelBottom = Math.max(...COMBAT_SLOT_DEFINITIONS.map(({ y, height }) => y + height));

export const COMBAT_PANEL_AREA = Object.freeze({
  x: combatPanelLeft,
  y: combatPanelTop,
  width: combatPanelRight - combatPanelLeft,
  height: combatPanelBottom - combatPanelTop,
});

export const INVENTORY_MODE_LAYOUTS = Object.freeze({
  [INVENTORY_MODES.PEACEFUL]: Object.freeze({
    peaceful: Object.freeze({ x: 0, y: 0, scale: 1, alpha: 1 }),
    combat: Object.freeze({ x: 112, y: 150, scale: 0.3, alpha: 0 }),
  }),
  [INVENTORY_MODES.COMBAT]: Object.freeze({
    peaceful: Object.freeze({ x: 112, y: 76, scale: 0.3, alpha: 0 }),
    combat: Object.freeze({ x: 0, y: 0, scale: 1, alpha: 1 }),
  }),
  [INVENTORY_MODES.LOADOUT_EDIT]: Object.freeze({
    peaceful: Object.freeze({ x: 32, y: -18, scale: LOADOUT_EDIT_SCALE, alpha: 1 }),
    combat: Object.freeze({ x: 32, y: 35, scale: LOADOUT_EDIT_SCALE, alpha: 1 }),
  }),
});

export function createInventoryModeState(stableMode = INVENTORY_MODES.PEACEFUL) {
  if (stableMode !== INVENTORY_MODES.PEACEFUL && stableMode !== INVENTORY_MODES.COMBAT) {
    throw new Error(`Unsupported stable inventory mode: ${stableMode}`);
  }
  return {
    mode: stableMode,
    stableMode,
    holdOriginMode: stableMode,
    altDown: false,
    holdTriggered: false,
    suppressed: false,
  };
}

export function reduceInventoryModeState(state, event) {
  switch (event?.type) {
    case "ALT_DOWN":
      if (state.suppressed || state.altDown) return state;
      return {
        ...state,
        altDown: true,
        holdTriggered: false,
        holdOriginMode: state.stableMode,
      };
    case "ALT_HOLD":
      if (state.suppressed || !state.altDown || state.holdTriggered) return state;
      return {
        ...state,
        mode: INVENTORY_MODES.LOADOUT_EDIT,
        holdTriggered: true,
      };
    case "ALT_UP":
      if (!state.altDown) return state;
      if (event.stableMode === INVENTORY_MODES.PEACEFUL || event.stableMode === INVENTORY_MODES.COMBAT) {
        return {
          ...state,
          mode: event.stableMode,
          stableMode: event.stableMode,
          holdOriginMode: event.stableMode,
          altDown: false,
          holdTriggered: false,
        };
      }
      if (state.holdTriggered) {
        return {
          ...state,
          mode: state.holdOriginMode,
          stableMode: state.holdOriginMode,
          altDown: false,
          holdTriggered: false,
        };
      }
      {
        const stableMode = state.stableMode === INVENTORY_MODES.PEACEFUL
          ? INVENTORY_MODES.COMBAT
          : INVENTORY_MODES.PEACEFUL;
        return {
          ...state,
          mode: stableMode,
          stableMode,
          holdOriginMode: stableMode,
          altDown: false,
          holdTriggered: false,
        };
      }
    case "SET_SUPPRESSED":
      if (Boolean(event.value) === state.suppressed) return state;
      return {
        ...state,
        mode: state.stableMode,
        holdOriginMode: state.stableMode,
        altDown: false,
        holdTriggered: false,
        suppressed: Boolean(event.value),
      };
    case "RESET_INPUT":
      return {
        ...state,
        mode: state.stableMode,
        holdOriginMode: state.stableMode,
        altDown: false,
        holdTriggered: false,
      };
    default:
      return state;
  }
}

export function isPhysicalAltEvent(event, { allowEditableRelease = false } = {}) {
  if (!event || (event.code !== "AltLeft" && event.code !== "AltRight")) return false;
  if (event.repeat) return false;
  return allowEditableRelease || !isEditableTarget(event.target);
}

export function transformPresentationRect(rect, transform) {
  return {
    x: transform.x + rect.x * transform.scale,
    y: transform.y + rect.y * transform.scale,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale,
  };
}

export function createInventoryModeRuntime(scene, {
  inventoryPresentation,
  combatPresentation,
  loadoutDragCoordinator,
  isSuppressed = () => false,
  onStateChange = () => {},
} = {}) {
  if (!inventoryPresentation?.getTransformTarget
    || !inventoryPresentation?.setInputEnabled
    || !combatPresentation?.getTransformTarget
    || !combatPresentation?.setDragEnabled) {
    throw new Error("Inventory mode runtime requires peaceful and combat presentation adapters");
  }

  const peacefulEar = scene.add.graphics().setScrollFactor(0);
  inventoryPresentation.addObjects(peacefulEar);
  renderPeacefulEar(peacefulEar);

  let destroyed = false;
  let state = createInventoryModeState();
  let transitioning = false;
  let transitionToken = 0;
  let holdTimer = null;
  let initialized = false;

  const peacefulTarget = inventoryPresentation.getTransformTarget();
  const combatTarget = combatPresentation.getTransformTarget();

  function clearHoldTimer() {
    if (holdTimer === null) return;
    globalThis.clearTimeout(holdTimer);
    holdTimer = null;
  }

  function stopTweens() {
    transitionToken += 1;
    scene.tweens.killTweensOf(peacefulTarget);
    scene.tweens.killTweensOf(combatTarget);
    scene.tweens.killTweensOf(peacefulEar);
    transitioning = false;
  }

  function setPanelTransform(target, transform) {
    target
      .setPosition(transform.x, transform.y)
      .setScale(transform.scale)
      .setAlpha(transform.alpha);
  }

  function updateStablePresentation() {
    const stable = !transitioning
      && !state.altDown
      && !state.suppressed
      && state.mode !== INVENTORY_MODES.LOADOUT_EDIT;
    const peaceful = stable && state.mode === INVENTORY_MODES.PEACEFUL;
    inventoryPresentation.setInputEnabled(peaceful);
    const loadoutEditing = !state.suppressed && state.altDown;
    const combatDragging = loadoutEditing || (stable && state.mode === INVENTORY_MODES.COMBAT);
    loadoutDragCoordinator?.setEnabled?.(combatDragging);
    combatPresentation.setDragEnabled(combatDragging);
  }

  function emitStateChange() {
    if (initialized && !destroyed) onStateChange();
  }

  function applyImmediate(mode = state.mode) {
    stopTweens();
    const layout = INVENTORY_MODE_LAYOUTS[mode];
    setPanelTransform(peacefulTarget, layout.peaceful);
    setPanelTransform(combatTarget, layout.combat);
    inventoryPresentation.setVisible(!state.suppressed);
    combatPresentation.setVisible(!state.suppressed);
    peacefulEar.setVisible(!state.suppressed).setAlpha(
      !state.suppressed && !state.altDown && mode === INVENTORY_MODES.PEACEFUL ? 1 : 0,
    );
    updateStablePresentation();
    emitStateChange();
  }

  function transitionTo(mode, durationMs) {
    if (state.suppressed) {
      applyImmediate(state.stableMode);
      return;
    }
    stopTweens();
    transitioning = true;
    inventoryPresentation.setVisible(true);
    combatPresentation.setVisible(true);
    inventoryPresentation.setInputEnabled(false);
    const loadoutEditing = !state.suppressed && state.altDown;
    loadoutDragCoordinator?.setEnabled?.(loadoutEditing);
    combatPresentation.setDragEnabled(loadoutEditing);
    peacefulEar.setVisible(true);
    emitStateChange();
    const layout = INVENTORY_MODE_LAYOUTS[mode];
    const token = transitionToken;
    let remaining = 3;
    const completeOne = () => {
      if (destroyed || token !== transitionToken) return;
      remaining -= 1;
      if (remaining > 0) return;
      transitioning = false;
      updateStablePresentation();
      emitStateChange();
    };
    scene.tweens.add({
      targets: peacefulTarget,
      x: layout.peaceful.x,
      y: layout.peaceful.y,
      scaleX: layout.peaceful.scale,
      scaleY: layout.peaceful.scale,
      alpha: layout.peaceful.alpha,
      duration: durationMs,
      ease: INVENTORY_MODE_EASE,
      onComplete: completeOne,
    });
    scene.tweens.add({
      targets: combatTarget,
      x: layout.combat.x,
      y: layout.combat.y,
      scaleX: layout.combat.scale,
      scaleY: layout.combat.scale,
      alpha: layout.combat.alpha,
      duration: durationMs,
      ease: INVENTORY_MODE_EASE,
      onComplete: completeOne,
    });
    scene.tweens.add({
      targets: peacefulEar,
      alpha: mode === INVENTORY_MODES.PEACEFUL && !state.altDown ? 1 : 0,
      duration: durationMs,
      ease: INVENTORY_MODE_EASE,
      onComplete: completeOne,
    });
  }

  function resetInput({ immediate = true } = {}) {
    if (destroyed) return;
    clearHoldTimer();
    const previousMode = state.mode;
    state = reduceInventoryModeState(state, { type: "RESET_INPUT" });
    if (immediate) applyImmediate(state.stableMode);
    else if (previousMode !== state.mode || transitioning) transitionTo(state.stableMode, LOADOUT_EDIT_TRANSITION_MS);
  }

  function syncSuppression() {
    if (destroyed) return;
    const nextSuppressed = Boolean(isSuppressed());
    if (nextSuppressed === state.suppressed) return;
    clearHoldTimer();
    state = reduceInventoryModeState(state, { type: "SET_SUPPRESSED", value: nextSuppressed });
    applyImmediate(state.stableMode);
  }

  function onAltDown(event) {
    if (destroyed) return;
    syncSuppression();
    if (state.suppressed || !isPhysicalAltEvent(event)) return;
    const next = reduceInventoryModeState(state, { type: "ALT_DOWN" });
    if (next === state) return;
    state = next;
    event.preventDefault?.();
    transitionTo(INVENTORY_MODES.LOADOUT_EDIT, ALT_PRESS_FEEDBACK_MS);
    holdTimer = globalThis.setTimeout(() => {
      holdTimer = null;
      syncSuppression();
      const held = reduceInventoryModeState(state, { type: "ALT_HOLD" });
      if (held === state) return;
      state = held;
      transitionTo(INVENTORY_MODES.LOADOUT_EDIT, LOADOUT_EDIT_TRANSITION_MS);
    }, ALT_HOLD_THRESHOLD_MS);
  }

  function onAltUp(event) {
    if (destroyed) return;
    if (!isPhysicalAltEvent(event, { allowEditableRelease: true }) || !state.altDown) return;
    event.preventDefault?.();
    clearHoldTimer();
    syncSuppression();
    if (state.suppressed || !state.altDown) return;
    const wasHold = state.holdTriggered;
    const pointer = scene.input?.activePointer;
    const releasePanel = loadoutDragCoordinator?.releasePanelAt?.(pointer?.x, pointer?.y);
    const releaseMode = releasePanel === "combat"
      ? INVENTORY_MODES.COMBAT
      : releasePanel === "peaceful"
        ? INVENTORY_MODES.PEACEFUL
        : null;
    state = reduceInventoryModeState(state, { type: "ALT_UP", stableMode: releaseMode });
    transitionTo(state.mode, wasHold ? LOADOUT_EDIT_TRANSITION_MS : INVENTORY_MODE_TRANSITION_MS);
  }

  function onBlur() {
    if (destroyed) return;
    resetInput({ immediate: true });
  }

  globalThis.window?.addEventListener?.("keydown", onAltDown);
  globalThis.window?.addEventListener?.("keyup", onAltUp);
  globalThis.window?.addEventListener?.("blur", onBlur);
  scene.events.on("update", syncSuppression);
  scene.events.on("pause", onBlur);
  scene.events.on("sleep", onBlur);
  applyImmediate(INVENTORY_MODES.PEACEFUL);
  initialized = true;

  return {
    setSuppressed(value) {
      if (destroyed) return;
      clearHoldTimer();
      state = reduceInventoryModeState(state, { type: "SET_SUPPRESSED", value });
      applyImmediate(state.stableMode);
    },
    syncSuppression,
    getState: () => ({
      ...state,
      transitioning,
      interactionBlocked: !state.suppressed
        && (transitioning || state.altDown || state.mode !== INVENTORY_MODES.PEACEFUL),
      holdThresholdMs: ALT_HOLD_THRESHOLD_MS,
      transitionMs: INVENTORY_MODE_TRANSITION_MS,
      pressFeedbackMs: ALT_PRESS_FEEDBACK_MS,
      ease: INVENTORY_MODE_EASE,
      earVisible: peacefulEar.visible && peacefulEar.alpha > 0.001,
      earAlpha: reportNumber(peacefulEar.alpha),
      peaceful: {
        x: reportNumber(peacefulTarget.x),
        y: reportNumber(peacefulTarget.y),
        scale: reportNumber(peacefulTarget.scaleX),
        alpha: reportNumber(peacefulTarget.alpha),
        inputEnabled: inventoryPresentation.isInputEnabled(),
      },
      combat: {
        x: reportNumber(combatTarget.x),
        y: reportNumber(combatTarget.y),
        scale: reportNumber(combatTarget.scaleX),
        alpha: reportNumber(combatTarget.alpha),
        inputEnabled: combatPresentation.isDragEnabled(),
        slots: COMBAT_SLOT_DEFINITIONS.map(({ id, kind, label, x, y, width, height }) => ({ id, kind, label, x, y, width, height })),
      },
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      initialized = false;
      clearHoldTimer();
      globalThis.window?.removeEventListener?.("keydown", onAltDown);
      globalThis.window?.removeEventListener?.("keyup", onAltUp);
      globalThis.window?.removeEventListener?.("blur", onBlur);
      scene.events.off("update", syncSuppression);
      scene.events.off("pause", onBlur);
      scene.events.off("sleep", onBlur);
      stopTweens();
      peacefulEar.destroy();
    },
  };
}

function renderPeacefulEar(graphics) {
  graphics.clear();
  graphics.fillStyle(HUD_COLORS.panel, 0.94)
    .fillRect(PEACEFUL_EAR_AREA.x, PEACEFUL_EAR_AREA.y, PEACEFUL_EAR_AREA.width, PEACEFUL_EAR_AREA.height);
  graphics.lineStyle(1, HUD_COLORS.border, 0.95)
    .lineBetween(PEACEFUL_EAR_AREA.x + 0.5, PEACEFUL_EAR_AREA.y + 0.5, PEACEFUL_EAR_AREA.x + PEACEFUL_EAR_AREA.width, PEACEFUL_EAR_AREA.y + 0.5)
    .lineBetween(PEACEFUL_EAR_AREA.x + 0.5, PEACEFUL_EAR_AREA.y + PEACEFUL_EAR_AREA.height - 0.5, PEACEFUL_EAR_AREA.x + PEACEFUL_EAR_AREA.width, PEACEFUL_EAR_AREA.y + PEACEFUL_EAR_AREA.height - 0.5)
    .lineBetween(PEACEFUL_EAR_AREA.x + 0.5, PEACEFUL_EAR_AREA.y + 0.5, PEACEFUL_EAR_AREA.x + 0.5, PEACEFUL_EAR_AREA.y + PEACEFUL_EAR_AREA.height - 0.5);
  drawBitmapTextInto(graphics, PEACEFUL_EAR_AREA.x + 1, PEACEFUL_EAR_AREA.y + 2, "Q", { shadow: 0 });
  drawFilledArrow(graphics, PEACEFUL_EAR_AREA.x + 7, PEACEFUL_EAR_AREA.y + 3, -1);
  drawBitmapTextInto(graphics, PEACEFUL_EAR_AREA.x + 1, PEACEFUL_EAR_AREA.y + 13, "E", { shadow: 0 });
  drawFilledArrow(graphics, PEACEFUL_EAR_AREA.x + 7, PEACEFUL_EAR_AREA.y + 14, 1);
}


function drawFilledArrow(graphics, x, y, direction) {
  const pixels = direction < 0
    ? ["001", "011", "111", "011", "001"]
    : ["100", "110", "111", "110", "100"];
  graphics.fillStyle(HUD_COLORS.light, 0.9);
  for (let row = 0; row < pixels.length; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (pixels[row][col] === "1") graphics.fillRect(x + col, y + row, 1, 1);
    }
  }
}

function isEditableTarget(target) {
  const tagName = String(target?.tagName ?? "").toLowerCase();
  return tagName === "input"
    || tagName === "textarea"
    || tagName === "select"
    || Boolean(target?.isContentEditable);
}
