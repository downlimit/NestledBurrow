import { HUD_DEPTH } from "../ui/hud.js";
import { createManagedText } from "../ui/textResolution.js";

const FEEDBACK_MOVE_X = 14;
const FEEDBACK_MOVE_MS = 160;
const FEEDBACK_HOLD_MS = 180;
const FEEDBACK_FADE_MS = 300;
const FEEDBACK_DEPTH = HUD_DEPTH + 70;

export function emitSimulationTestActionFeedback({
  scene,
  itemId = null,
  delta = 0,
  deltas = [],
} = {}) {
  if (!scene) return false;
  scene.audioRuntime?.playEffect?.("inventory-change");

  const entries = [
    ...(Number(delta) ? [{ itemId, delta: Number(delta) }] : []),
    ...(Array.isArray(deltas) ? deltas : []),
  ].filter((entry) => Number.isFinite(Number(entry?.delta)) && Number(entry.delta) !== 0);
  if (!entries.length) return true;

  const show = () => {
    for (const feedback of entries) showFeedbackDelta(scene, feedback);
  };
  if (scene.time?.delayedCall) scene.time.delayedCall(0, show);
  else show();
  return true;
}

function showFeedbackDelta(scene, feedback) {
  const buildMode = scene.buildMode;
  if (!buildMode?.isActive?.() || buildMode.view !== "test") return;
  const entry = findFeedbackEntry(buildMode, feedback);
  if (!entry?.label?.visible) return;

  const delta = Number(feedback.delta);
  const labelWidth = Number(entry.label.width) || 0;
  const isReadout = Boolean(feedback.debugId);
  const maxStartX = isReadout ? 206 : 160;
  const startX = Math.min(maxStartX, Math.max(74, Number(entry.label.x) + labelWidth + 4));
  const startY = Number(entry.label.y) - 1;
  const text = createManagedText(scene, startX, startY, signedDelta(delta), {
    fontFamily: scene.localization?.getLocale?.().fontKey,
    fontSize: "7px",
    color: delta > 0 ? "#9fe39f" : "#e79b91",
  }).setDepth(FEEDBACK_DEPTH).setScrollFactor(0);
  text.__testFeedbackDestroyed = false;

  const cleanup = () => {
    if (text.__testFeedbackDestroyed) return;
    text.__testFeedbackDestroyed = true;
    text.destroy?.();
  };
  const fade = () => {
    if (text.__testFeedbackDestroyed) return;
    if (!scene.tweens?.add) return cleanup();
    scene.tweens.add({
      targets: text,
      alpha: 0,
      duration: FEEDBACK_FADE_MS,
      ease: "Linear",
      onComplete: cleanup,
    });
  };

  if (!scene.tweens?.add) return cleanup();
  scene.tweens.add({
    targets: text,
    x: startX + FEEDBACK_MOVE_X,
    duration: FEEDBACK_MOVE_MS,
    ease: "Quad.Out",
    onComplete: () => {
      if (text.__testFeedbackDestroyed) return;
      if (scene.time?.delayedCall) scene.time.delayedCall(FEEDBACK_HOLD_MS, fade);
      else fade();
    },
  });
}

function findFeedbackEntry(buildMode, feedback) {
  const objects = Array.isArray(buildMode.objects) ? buildMode.objects : [];
  if (feedback.debugId) {
    return objects.find((entry) => entry.type === "test-item" && entry.item?.debugId === feedback.debugId) ?? null;
  }
  if (!feedback.itemId) return null;
  return objects.find((entry) => entry.type === "test-item"
    && entry.item?.id === feedback.itemId
    && !entry.item?.populationTest) ?? null;
}

function signedDelta(value) {
  const rounded = Math.round(Number(value) || 0);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
