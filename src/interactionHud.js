import { GAME_HEIGHT, GAME_WIDTH } from "./worldConfig.js";
import {
  HUD_COLORS,
  HUD_DEPTH,
  drawBitmapTextInto,
  isPointInRect,
  measureBitmapText,
} from "./hud.js";

const PROMPT_WIDTH = 76;
const PROMPT_RIGHT_MARGIN = 10;
const PROMPT_RECT = Object.freeze({
  x: GAME_WIDTH - PROMPT_RIGHT_MARGIN - PROMPT_WIDTH,
  y: GAME_HEIGHT - 34,
  width: PROMPT_WIDTH,
  height: 24,
});
const DIALOGUE_RECT = Object.freeze({ x: 8, y: GAME_HEIGHT - 58, width: GAME_WIDTH - 16, height: 50 });
const DIALOGUE_ACTION_RECT = Object.freeze({ x: GAME_WIDTH - 74, y: GAME_HEIGHT - 34, width: 66, height: 28 });

export function createInteractionHud(scene, options = {}) {
  const isCoarsePointer = options.isCoarsePointer ?? (() => false);
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 10).setScrollFactor(0);
  const promptHit = scene.add.zone(PROMPT_RECT.x, PROMPT_RECT.y, PROMPT_RECT.width, PROMPT_RECT.height)
    .setOrigin(0, 0).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setInteractive({ useHandCursor: true });
  const dialogueHit = scene.add.zone(DIALOGUE_ACTION_RECT.x, DIALOGUE_ACTION_RECT.y, DIALOGUE_ACTION_RECT.width, DIALOGUE_ACTION_RECT.height)
    .setOrigin(0, 0).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setInteractive({ useHandCursor: true });

  let destroyed = false;
  let promptState = null;
  let dialogueState = null;
  let renderedKey = "";
  let latchedInteract = false;

  const onPointerDown = (_pointer, _localX, _localY, event) => {
    event?.stopPropagation?.();
    _pointer?.event?.stopPropagation?.();
    latchedInteract = true;
  };
  promptHit.on("pointerdown", onPointerDown);
  dialogueHit.on("pointerdown", onPointerDown);
  promptHit.disableInteractive();
  dialogueHit.disableInteractive();

  function redraw() {
    if (destroyed) return;
    const key = JSON.stringify({ promptState, dialogueState, coarse: Boolean(isCoarsePointer()) });
    if (key === renderedKey) return;
    renderedKey = key;
    graphics.clear();

    if (dialogueState) {
      graphics.fillStyle(HUD_COLORS.panel, 0.92).fillRect(DIALOGUE_RECT.x, DIALOGUE_RECT.y, DIALOGUE_RECT.width, DIALOGUE_RECT.height);
      graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(DIALOGUE_RECT.x + 0.5, DIALOGUE_RECT.y + 0.5, DIALOGUE_RECT.width - 1, DIALOGUE_RECT.height - 1);
      drawBitmapTextInto(graphics, DIALOGUE_RECT.x + 8, DIALOGUE_RECT.y + 7, dialogueState.speaker, { color: HUD_COLORS.mid });
      drawBitmapTextInto(graphics, DIALOGUE_RECT.x + 8, DIALOGUE_RECT.y + 22, dialogueState.text, { color: HUD_COLORS.light });
      const label = `${isCoarsePointer() ? "" : "E  "}${dialogueState.continuePrompt}`;
      drawBitmapTextInto(graphics, GAME_WIDTH - 12 - measureBitmapText(label), DIALOGUE_RECT.y + 36, label, { color: HUD_COLORS.mid });
      dialogueHit.setInteractive({ useHandCursor: true });
      promptHit.disableInteractive();
      return;
    }

    dialogueHit.disableInteractive();
    if (promptState) {
      const label = `${isCoarsePointer() ? "" : "E  "}${promptState.prompt}`;
      graphics.fillStyle(HUD_COLORS.panel, 0.86).fillRect(PROMPT_RECT.x, PROMPT_RECT.y, PROMPT_RECT.width, PROMPT_RECT.height);
      graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(PROMPT_RECT.x + 0.5, PROMPT_RECT.y + 0.5, PROMPT_RECT.width - 1, PROMPT_RECT.height - 1);
      drawBitmapTextInto(graphics, PROMPT_RECT.x + 8, PROMPT_RECT.y + 9, label, { color: HUD_COLORS.light });
      promptHit.setInteractive({ useHandCursor: true });
    } else {
      promptHit.disableInteractive();
    }
  }

  return {
    showPrompt({ prompt }) { promptState = { prompt }; redraw(); },
    hidePrompt() { promptState = null; redraw(); },
    showDialogue({ speaker, text, continuePrompt }) { dialogueState = { speaker, text, continuePrompt }; promptState = null; redraw(); },
    hideDialogue() { dialogueState = null; redraw(); },
    consumeInteractPressed() { const pressed = latchedInteract; latchedInteract = false; return pressed; },
    isPointInHud(x, y) {
      return Boolean((dialogueState && isPointInRect(x, y, DIALOGUE_RECT)) || (promptState && isPointInRect(x, y, PROMPT_RECT)));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      promptHit.off("pointerdown", onPointerDown);
      dialogueHit.off("pointerdown", onPointerDown);
      promptHit.destroy();
      dialogueHit.destroy();
      graphics.destroy();
      promptState = null;
      dialogueState = null;
    },
  };
}
