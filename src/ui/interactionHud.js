import { GAME_HEIGHT, GAME_WIDTH } from "../world/worldConfig.js";
import { HUD_COLORS, HUD_DEPTH, isPointInRect } from "./hud.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";
import { INVENTORY_HUD_AREA } from "../inventory/inventoryRuntime.js";

const PROMPT_HORIZONTAL_PADDING = 5;
const PROMPT_COARSE_MIN_WIDTH = 28;
const PROMPT_HEIGHT = 18;
const PROMPT_INVENTORY_GAP = 3;
const DIALOGUE_RECT = Object.freeze({ x: 8, y: GAME_HEIGHT - 64, width: GAME_WIDTH - 16, height: 56 });
const DIALOGUE_ACTION_RECT = Object.freeze({ x: GAME_WIDTH - 86, y: GAME_HEIGHT - 36, width: 78, height: 28 });

export function createInteractionHud(scene, options = {}) {
  const isCoarsePointer = options.isCoarsePointer ?? (() => false);
  const localization = options.localization;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 10).setScrollFactor(0);
  const promptHit = scene.add.zone(0, 0, PROMPT_COARSE_MIN_WIDTH, PROMPT_HEIGHT)
    .setOrigin(0, 0).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setInteractive({ useHandCursor: true });
  const dialogueHit = scene.add.zone(DIALOGUE_ACTION_RECT.x, DIALOGUE_ACTION_RECT.y, DIALOGUE_ACTION_RECT.width, DIALOGUE_ACTION_RECT.height)
    .setOrigin(0, 0).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setInteractive({ useHandCursor: true });

  const speakerText = createManagedText(scene, DIALOGUE_RECT.x + 8, DIALOGUE_RECT.y + 6, "", speakerStyle()).setDepth(HUD_DEPTH + 11).setScrollFactor(0).setVisible(false);
  const bodyText = createManagedText(scene, DIALOGUE_RECT.x + 8, DIALOGUE_RECT.y + 21, "", bodyStyle()).setDepth(HUD_DEPTH + 11).setScrollFactor(0).setVisible(false);
  const actionText = createManagedText(scene, 0, DIALOGUE_RECT.y + 40, "", actionStyle()).setDepth(HUD_DEPTH + 11).setScrollFactor(0).setVisible(false);
  const promptText = createManagedText(scene, 0, 0, "", promptStyle()).setDepth(HUD_DEPTH + 11).setScrollFactor(0).setVisible(false);

  let destroyed = false;
  let promptState = null;
  let dialogueState = null;
  let renderedKey = "";
  let latchedInteract = false;
  let heldPointerId = null;
  let heldDomPointerId = null;
  let promptRect = null;
  let messageTimer = null;
  let suppressed = false;
  let cooldownProgress = 0;
  let promptTargetAlpha = 1;

  const onPointerDown = (pointer, _localX, _localY, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    latchedInteract = true;
    heldPointerId = pointer?.id ?? pointer?.event?.pointerId ?? null;
    heldDomPointerId = pointer?.event?.pointerId ?? null;
  };
  const onPointerEnd = (pointer) => {
    const pointerId = pointer?.id ?? pointer?.event?.pointerId ?? null;
    if (heldPointerId === null || pointerId === heldPointerId) heldPointerId = null;
  };
  const onNativePointerEnd = (event) => {
    if (heldDomPointerId === null || event?.pointerId === heldDomPointerId) {
      heldPointerId = null;
      heldDomPointerId = null;
    }
  };
  const onBlur = () => { heldPointerId = null; heldDomPointerId = null; latchedInteract = false; };
  promptHit.on("pointerdown", onPointerDown);
  dialogueHit.on("pointerdown", onPointerDown);
  scene.input.on("pointerup", onPointerEnd);
  scene.input.on("pointerupoutside", onPointerEnd);
  scene.input.on("pointercancel", onPointerEnd);
  globalThis.window?.addEventListener?.("blur", onBlur);
  globalThis.window?.addEventListener?.("pointerup", onNativePointerEnd);
  globalThis.window?.addEventListener?.("pointercancel", onNativePointerEnd);
  globalThis.document?.addEventListener?.("fullscreenchange", onBlur);
  globalThis.document?.addEventListener?.("visibilitychange", onBlur);
  promptHit.disableInteractive();
  dialogueHit.disableInteractive();

  function fontFamily() { return localization?.getLocale?.().fontKey ?? "sans-serif"; }
  function speakerStyle() { return { fontFamily: fontFamily(), fontSize: "8px", color: "#d9c18f" }; }
  function bodyStyle() { return { fontFamily: fontFamily(), fontSize: "9px", color: "#f2eadc", wordWrap: { width: DIALOGUE_RECT.width - 16, useAdvancedWrap: true } }; }
  function actionStyle() { return { fontFamily: fontFamily(), fontSize: "8px", color: "#d9c18f" }; }
  function promptStyle() { return { fontFamily: fontFamily(), fontSize: "9px", color: "#f2eadc" }; }
  function translate(descriptor) { return localization.t(descriptor.textKey ?? descriptor, descriptor.values); }
  function actionLabelLegacy(key) {
    const action = localization.t(key);
    return isCoarsePointer() ? action : `SPACE · ${action}`;
  }

  function actionLabel(key) {
    const action = localization.t(key);
    return isCoarsePointer() ? action : `SPACE - ${action}`;
  }

  function transitionPromptAlpha(targetAlpha) {
    if (targetAlpha === promptTargetAlpha) return;
    promptTargetAlpha = targetAlpha;
    scene.tweens.killTweensOf(promptText);
    scene.tweens.add({
      targets: promptText,
      alpha: targetAlpha,
      duration: 300,
      ease: "Sine.easeOut",
    });
  }

  function redraw(force = false) {
    if (destroyed) return;
    const key = JSON.stringify({ promptState, dialogueState, coarse: Boolean(isCoarsePointer()), lang: localization?.getLanguage?.(), suppressed, cooldownProgress });
    if (!force && key === renderedKey) return;
    renderedKey = key;
    graphics.clear();
    for (const t of [speakerText, bodyText, actionText, promptText]) t.setVisible(false);

    if (suppressed) {
      heldPointerId = null;
      latchedInteract = false;
      promptRect = null;
      promptHit.disableInteractive();
      dialogueHit.disableInteractive();
      return;
    }

    if (dialogueState) {
      graphics.fillStyle(HUD_COLORS.panel, 0.92).fillRect(DIALOGUE_RECT.x, DIALOGUE_RECT.y, DIALOGUE_RECT.width, DIALOGUE_RECT.height);
      graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(DIALOGUE_RECT.x + 0.5, DIALOGUE_RECT.y + 0.5, DIALOGUE_RECT.width - 1, DIALOGUE_RECT.height - 1);
      setManagedTextStyle(speakerText, scene, speakerStyle()).setText(translate({ textKey: dialogueState.speakerKey, values: dialogueState.speakerValues })).setVisible(true);
      setManagedTextStyle(bodyText, scene, bodyStyle()).setText(translate(dialogueState.line)).setVisible(true);
      const label = actionLabel(dialogueState.continuePromptKey);
      setManagedTextStyle(actionText, scene, actionStyle()).setText(label).setVisible(true);
      actionText.setPosition(Math.round(GAME_WIDTH - 12 - actionText.width), Math.round(DIALOGUE_RECT.y + 40));
      dialogueHit.setInteractive({ useHandCursor: true });
      promptHit.disableInteractive();
      return;
    }

    dialogueHit.disableInteractive();
    if (promptState) {
      const label = actionLabel(promptState.promptKey);
      setManagedTextStyle(promptText, scene, promptStyle()).setText(label).setVisible(true);
      transitionPromptAlpha(cooldownProgress > 0 ? 0.5 : 1);
      const width = compactPromptWidth(promptText.width, isCoarsePointer());
      promptRect = compactPromptRect(width);
      graphics.fillStyle(HUD_COLORS.panel, 0.86).fillRect(promptRect.x, promptRect.y, promptRect.width, promptRect.height);
      const cooldownWidth = Math.round(promptRect.width * cooldownProgress);
      if (cooldownWidth > 0) graphics.fillStyle(HUD_COLORS.light, 0.2).fillRect(promptRect.x + promptRect.width - cooldownWidth, promptRect.y + 1, cooldownWidth, promptRect.height - 2);
      graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(promptRect.x + 0.5, promptRect.y + 0.5, promptRect.width - 1, promptRect.height - 1);
      promptText.setPosition(Math.round(promptRect.x + PROMPT_HORIZONTAL_PADDING), Math.round(promptRect.y + (PROMPT_HEIGHT - promptText.height) / 2));
      promptHit.setPosition(promptRect.x, promptRect.y).setSize(promptRect.width, promptRect.height).setInteractive({ useHandCursor: true });
    } else {
      promptRect = null;
      promptHit.disableInteractive();
    }
  }

  const unsubscribe = localization?.subscribe?.(() => redraw(true));

  return {
    showPrompt({ promptKey }) { promptState = { promptKey }; redraw(); },
    hidePrompt() { promptState = null; redraw(); },
    showDialogue(dialogue) { dialogueState = { ...dialogue }; promptState = null; redraw(); },
    isMessageVisible() { return Boolean(promptState?.message); },
    showMessage({ messageKey, duration = 900 }) {
      promptState = { promptKey: messageKey, message: true };
      redraw(true);
      if (messageTimer !== null) scene.time.removeEvent(messageTimer);
      scene.tweens.killTweensOf(promptText);
      messageTimer = scene.time.delayedCall(duration, () => { messageTimer = null; if (promptState?.message) { promptState = null; redraw(true); } });
    },
    hideDialogue() { dialogueState = null; redraw(); },
    setSuppressed(value) {
      suppressed = Boolean(value);
      if (suppressed) onBlur();
      redraw(true);
    },
    setCooldownProgress(value) {
      const next = Math.min(1, Math.max(0, Number(value) || 0));
      if (next === cooldownProgress) return;
      cooldownProgress = next;
      redraw();
    },
    triggerCooldownFeedback() {
      scene.tweens.killTweensOf(promptText);
      promptText.setAlpha(1);
      promptTargetAlpha = 0.5;
      scene.tweens.add({
        targets: promptText,
        alpha: 0.5,
        duration: 300,
        ease: "Sine.easeOut",
      });
    },
    getPresentationState() {
      return {
        suppressed,
        promptVisible: Boolean(!suppressed && promptState && promptRect),
        promptRect: promptRect ? { ...promptRect } : null,
        messageKey: promptState?.message ? promptState.promptKey : null,
        cooldownProgress,
        promptAlpha: promptText.alpha,
        dialogueVisible: Boolean(!suppressed && dialogueState),
      };
    },
    consumeInteractPressed() { const pressed = latchedInteract; latchedInteract = false; return pressed; },
    isInteractHeld() { return heldPointerId !== null; },
    isPointInHud(x, y) { return Boolean(!suppressed && ((dialogueState && isPointInRect(x, y, DIALOGUE_RECT)) || (promptState && promptRect && isPointInRect(x, y, promptRect)))); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      if (messageTimer !== null) scene.time.removeEvent(messageTimer);
      promptHit.off("pointerdown", onPointerDown); dialogueHit.off("pointerdown", onPointerDown);
      scene.input.off("pointerup", onPointerEnd);
      scene.input.off("pointerupoutside", onPointerEnd);
      scene.input.off("pointercancel", onPointerEnd);
      globalThis.window?.removeEventListener?.("blur", onBlur);
      globalThis.window?.removeEventListener?.("pointerup", onNativePointerEnd);
      globalThis.window?.removeEventListener?.("pointercancel", onNativePointerEnd);
      globalThis.document?.removeEventListener?.("fullscreenchange", onBlur);
      globalThis.document?.removeEventListener?.("visibilitychange", onBlur);
      onBlur();
      promptHit.destroy(); dialogueHit.destroy(); graphics.destroy();
      speakerText.destroy(); bodyText.destroy(); actionText.destroy(); promptText.destroy();
    },
  };
}

export function compactPromptRect(width) {
  const normalizedWidth = Math.max(1, Math.ceil(Number(width) || 0));
  return {
    x: INVENTORY_HUD_AREA.x + INVENTORY_HUD_AREA.width - normalizedWidth,
    y: INVENTORY_HUD_AREA.y - PROMPT_INVENTORY_GAP - PROMPT_HEIGHT,
    width: normalizedWidth,
    height: PROMPT_HEIGHT,
  };
}

export function compactPromptWidth(textWidth, coarsePointer = false) {
  return Math.max(
    coarsePointer ? PROMPT_COARSE_MIN_WIDTH : 0,
    Math.ceil(Number(textWidth) || 0) + PROMPT_HORIZONTAL_PADDING * 2,
  );
}
