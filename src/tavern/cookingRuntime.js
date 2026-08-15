import {
  advanceCookingStep,
  attemptCookingStep,
  completeCookingStep,
  COOKING_MINIGAME_CONFIG,
  startCookingStep,
} from "./cookingDomain.js";
import { HUD_COLORS, HUD_DEPTH, isPointInRect } from "../ui/hud.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../world/worldConfig.js";

export const COOKING_OVERLAY_AREA = Object.freeze({
  x: Math.round((GAME_WIDTH - 236) / 2),
  y: Math.round((GAME_HEIGHT - 86) / 2),
  width: 236,
  height: 86,
});
export const COOKING_SCALE_AREA = Object.freeze({ x: COOKING_OVERLAY_AREA.x + 14, y: COOKING_OVERLAY_AREA.y + 33, width: 208, height: 12 });
export const COOKING_ATTEMPT_AREA = Object.freeze({ x: COOKING_OVERLAY_AREA.x + 58, y: COOKING_OVERLAY_AREA.y + 56, width: 120, height: 24 });

export function createCookingRuntime(scene, {
  sessionState,
  localization,
  randomSource = Math.random,
  onActiveChange = () => {},
  onPersistentMutation = () => {},
  onInventoryGain = () => {},
  playEffect = () => {},
} = {}) {
  let activeStep = null;
  let destroyed = false;
  let inputSuppressed = false;
  let attemptLatched = false;

  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 30).setScrollFactor(0).setVisible(false);
  const titleText = createText(scene, 8);
  const timerText = createText(scene, 9);
  const comboText = createText(scene, 8);
  const feedbackText = createText(scene, 8);
  const attemptText = createText(scene, 9);
  const attemptHit = scene.add.zone(
    COOKING_ATTEMPT_AREA.x,
    COOKING_ATTEMPT_AREA.y,
    COOKING_ATTEMPT_AREA.width,
    COOKING_ATTEMPT_AREA.height,
  ).setOrigin(0).setDepth(HUD_DEPTH + 32).setScrollFactor(0).disableInteractive();

  const onPointerDown = (pointer, _x, _y, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    attempt();
  };
  const onSpaceDown = (event) => {
    if (event?.repeat || attemptLatched || inputSuppressed || !activeStep) return;
    event?.preventDefault?.();
    attemptLatched = true;
    attempt();
  };
  const onSpaceUp = () => { attemptLatched = false; };
  attemptHit.on("pointerdown", onPointerDown);
  scene.input.keyboard.on("keydown-SPACE", onSpaceDown);
  scene.input.keyboard.on("keyup-SPACE", onSpaceUp);
  const unsubscribe = localization.subscribe(render);

  function start(stepType) {
    if (destroyed || activeStep) return { status: "busy", mutated: false };
    const result = startCookingStep(sessionState.gameplay.kitchen, stepType, sessionState.gameplay.inventory, randomSource);
    if (!result.activeStep) return { ...result, mutated: false };
    activeStep = result.activeStep;
    onActiveChange(true);
    render();
    return { status: "started", mutated: false, stepType };
  }

  function update(deltaMs) {
    if (!activeStep || destroyed) return;
    activeStep = advanceCookingStep(activeStep, Math.max(0, Number(deltaMs) || 0) / 1000);
    if (activeStep.remainingSeconds === 0) {
      finish();
      return;
    }
    render();
  }

  function attempt() {
    if (!activeStep || destroyed || inputSuppressed) return { status: "inactive", mutated: false };
    const result = attemptCookingStep(activeStep, randomSource);
    playEffect(result.status === "miss" ? "cooking-miss" : "cooking-success");
    activeStep = result.activeStep;
    if (result.status === "completed") {
      finish();
      return { status: "completed", mutated: true };
    }
    render();
    return { status: result.status, mutated: false };
  }

  function finish() {
    if (!activeStep) return { status: "inactive", mutated: false };
    const completedStep = activeStep;
    const result = completeCookingStep(sessionState.gameplay.kitchen, completedStep.stepType, sessionState.gameplay.inventory);
    activeStep = null;
    onActiveChange(false);
    render();
    if (result.mutated) {
      playEffect("guest-happy");
      onInventoryGain(result.inventory);
      onPersistentMutation(result);
    }
    return result;
  }

  function completeForTest() {
    if (!activeStep) return { status: "inactive", mutated: false };
    activeStep = { ...activeStep, remainingSeconds: 0 };
    return finish();
  }

  function alignMarkerForTest() {
    if (!activeStep) return null;
    activeStep = {
      ...activeStep,
      markerPosition: activeStep.targetPosition + activeStep.targetWidth / 2,
    };
    render();
    return { ...activeStep };
  }

  function missMarkerForTest() {
    if (!activeStep) return null;
    activeStep = {
      ...activeStep,
      markerPosition: activeStep.targetPosition > 0.5 ? 0 : 1,
    };
    render();
    return { ...activeStep };
  }

  function render() {
    graphics.clear();
    for (const text of [titleText, timerText, comboText, feedbackText, attemptText]) text.setVisible(false);
    if (!activeStep || destroyed) {
      graphics.setVisible(false);
      attemptHit.disableInteractive();
      return;
    }

    graphics.setVisible(true);
    graphics.fillStyle(HUD_COLORS.panel, 0.96)
      .fillRect(COOKING_OVERLAY_AREA.x, COOKING_OVERLAY_AREA.y, COOKING_OVERLAY_AREA.width, COOKING_OVERLAY_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1)
      .strokeRect(COOKING_OVERLAY_AREA.x + 0.5, COOKING_OVERLAY_AREA.y + 0.5, COOKING_OVERLAY_AREA.width - 1, COOKING_OVERLAY_AREA.height - 1);
    graphics.fillStyle(HUD_COLORS.shadow, 1)
      .fillRect(COOKING_SCALE_AREA.x, COOKING_SCALE_AREA.y, COOKING_SCALE_AREA.width, COOKING_SCALE_AREA.height);

    const targetX = COOKING_SCALE_AREA.x + Math.round(activeStep.targetPosition * COOKING_SCALE_AREA.width);
    const targetWidth = Math.max(2, Math.round(activeStep.targetWidth * COOKING_SCALE_AREA.width));
    graphics.fillStyle(0x42c96b, 1).fillRect(targetX, COOKING_SCALE_AREA.y + 2, targetWidth, COOKING_SCALE_AREA.height - 4);
    const markerX = COOKING_SCALE_AREA.x + Math.round(activeStep.markerPosition * (COOKING_SCALE_AREA.width - 2));
    graphics.fillStyle(0xffef8a, 1).fillRect(markerX, COOKING_SCALE_AREA.y - 2, 2, COOKING_SCALE_AREA.height + 4);

    const stepKey = activeStep.stepType === "preparation" ? "preparation" : "frying";
    setText(titleText, localization.t(`hud:cooking.${stepKey}`), COOKING_OVERLAY_AREA.x + 10, COOKING_OVERLAY_AREA.y + 6);
    setText(timerText, `${localization.t("hud:cooking.time")} ${Math.ceil(activeStep.remainingSeconds)}`, COOKING_OVERLAY_AREA.x + 94, COOKING_OVERLAY_AREA.y + 5);
    setText(comboText, `${localization.t("hud:cooking.combo")} ${activeStep.combo}`, COOKING_OVERLAY_AREA.x + 174, COOKING_OVERLAY_AREA.y + 6);
    if (activeStep.feedback) {
      const feedbackKey = activeStep.feedback === "success" ? "success" : "miss";
      setText(feedbackText, localization.t(`hud:cooking.${feedbackKey}`), COOKING_OVERLAY_AREA.x + 12, COOKING_OVERLAY_AREA.y + 54);
    }

    graphics.fillStyle(inputSuppressed ? HUD_COLORS.shadow : HUD_COLORS.mid, 1)
      .fillRect(COOKING_ATTEMPT_AREA.x, COOKING_ATTEMPT_AREA.y, COOKING_ATTEMPT_AREA.width, COOKING_ATTEMPT_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1)
      .strokeRect(COOKING_ATTEMPT_AREA.x + 0.5, COOKING_ATTEMPT_AREA.y + 0.5, COOKING_ATTEMPT_AREA.width - 1, COOKING_ATTEMPT_AREA.height - 1);
    setText(attemptText, localization.t("hud:cooking.attempt"), 0, 0);
    attemptText.setPosition(
      Math.round(COOKING_ATTEMPT_AREA.x + (COOKING_ATTEMPT_AREA.width - attemptText.width) / 2),
      Math.round(COOKING_ATTEMPT_AREA.y + (COOKING_ATTEMPT_AREA.height - attemptText.height) / 2),
    );
    if (inputSuppressed) attemptHit.disableInteractive();
    else attemptHit.setInteractive({ useHandCursor: true });
  }

  function setText(text, value, x, y) {
    setManagedTextStyle(text, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: `${text.__fontSize}px`,
      color: "#f2eadc",
    }).setText(value).setVisible(true).setPosition(x, y);
  }

  function createText(targetScene, fontSize) {
    const text = createManagedText(targetScene, 0, 0, "", {
      fontFamily: localization.getLocale().fontKey,
      fontSize: `${fontSize}px`,
      color: "#f2eadc",
    }).setDepth(HUD_DEPTH + 31).setScrollFactor(0).setVisible(false);
    text.__fontSize = fontSize;
    return text;
  }

  render();
  return {
    start,
    update,
    attempt,
    completeForTest,
    alignMarkerForTest,
    missMarkerForTest,
    isActive() { return Boolean(activeStep) && !destroyed; },
    getState() { return activeStep ? { ...activeStep } : null; },
    setInputSuppressed(value) {
      inputSuppressed = Boolean(value);
      render();
    },
    isPointInHud(x, y) {
      return Boolean(activeStep) && (isPointInRect(x, y, COOKING_OVERLAY_AREA) || isPointInRect(x, y, COOKING_ATTEMPT_AREA));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      activeStep = null;
      unsubscribe?.();
      scene.input.keyboard.off("keydown-SPACE", onSpaceDown);
      scene.input.keyboard.off("keyup-SPACE", onSpaceUp);
      attemptHit.off("pointerdown", onPointerDown);
      attemptHit.destroy();
      graphics.destroy();
      for (const text of [titleText, timerText, comboText, feedbackText, attemptText]) text.destroy();
    },
  };
}
