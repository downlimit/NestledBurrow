import { GAME_HEIGHT, GAME_WIDTH } from "./worldConfig.js";
import { HUD_COLORS, HUD_DEPTH, isPointInRect } from "./hud.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";

const PROMPT_RIGHT_MARGIN = 10;
const PROMPT_MIN_WIDTH = 76;
const PROMPT_HEIGHT = 24;
const DIALOGUE_RECT = Object.freeze({ x: 8, y: GAME_HEIGHT - 64, width: GAME_WIDTH - 16, height: 56 });
const DIALOGUE_ACTION_RECT = Object.freeze({ x: GAME_WIDTH - 86, y: GAME_HEIGHT - 36, width: 78, height: 28 });

export function createInteractionHud(scene, options = {}) {
  const isCoarsePointer = options.isCoarsePointer ?? (() => false);
  const localization = options.localization;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 10).setScrollFactor(0);
  const promptHit = scene.add.zone(0, 0, PROMPT_MIN_WIDTH, PROMPT_HEIGHT)
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
  let promptRect = null;

  const onPointerDown = (pointer, _localX, _localY, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    latchedInteract = true;
  };
  promptHit.on("pointerdown", onPointerDown);
  dialogueHit.on("pointerdown", onPointerDown);
  promptHit.disableInteractive();
  dialogueHit.disableInteractive();

  function fontFamily() { return localization?.getLocale?.().fontKey ?? "sans-serif"; }
  function speakerStyle() { return { fontFamily: fontFamily(), fontSize: "8px", color: "#d9c18f" }; }
  function bodyStyle() { return { fontFamily: fontFamily(), fontSize: "9px", color: "#f2eadc", wordWrap: { width: DIALOGUE_RECT.width - 16, useAdvancedWrap: true } }; }
  function actionStyle() { return { fontFamily: fontFamily(), fontSize: "8px", color: "#d9c18f" }; }
  function promptStyle() { return { fontFamily: fontFamily(), fontSize: "9px", color: "#f2eadc" }; }
  function translate(descriptor) { return localization.t(descriptor.textKey ?? descriptor, descriptor.values); }
  function actionLabel(key) { return `${isCoarsePointer() ? "" : "E  "}${localization.t(key)}`; }

  function redraw(force = false) {
    if (destroyed) return;
    const key = JSON.stringify({ promptState, dialogueState, coarse: Boolean(isCoarsePointer()), lang: localization?.getLanguage?.() });
    if (!force && key === renderedKey) return;
    renderedKey = key;
    graphics.clear();
    for (const t of [speakerText, bodyText, actionText, promptText]) t.setVisible(false);

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
      const width = Math.max(PROMPT_MIN_WIDTH, Math.ceil(promptText.width) + 16);
      promptRect = { x: GAME_WIDTH - PROMPT_RIGHT_MARGIN - width, y: GAME_HEIGHT - 34, width, height: PROMPT_HEIGHT };
      graphics.fillStyle(HUD_COLORS.panel, 0.86).fillRect(promptRect.x, promptRect.y, promptRect.width, promptRect.height);
      graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(promptRect.x + 0.5, promptRect.y + 0.5, promptRect.width - 1, promptRect.height - 1);
      promptText.setPosition(Math.round(promptRect.x + 8), Math.round(promptRect.y + 7));
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
    hideDialogue() { dialogueState = null; redraw(); },
    consumeInteractPressed() { const pressed = latchedInteract; latchedInteract = false; return pressed; },
    isPointInHud(x, y) { return Boolean((dialogueState && isPointInRect(x, y, DIALOGUE_RECT)) || (promptState && promptRect && isPointInRect(x, y, promptRect))); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      promptHit.off("pointerdown", onPointerDown); dialogueHit.off("pointerdown", onPointerDown);
      promptHit.destroy(); dialogueHit.destroy(); graphics.destroy();
      speakerText.destroy(); bodyText.destroy(); actionText.destroy(); promptText.destroy();
    },
  };
}
