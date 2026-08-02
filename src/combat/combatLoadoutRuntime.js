import { cloneInventoryItem } from "../inventory/inventoryDomain.js";
import { useCombatNumberSlot } from "../inventory/combatQuickUse.js";
import { FARMING_TEXTURE_KEY } from "../resources/farmingConfig.js";
import { needMeterValues } from "../needs/needsFlowRuntime.js";
import { HUD_COLORS, HUD_DEPTH, drawBitmapTextInto, isPointInRect, measureBitmapText } from "../ui/hud.js";
import {
  inventorySlotLabelScreenPosition,
  inventoryWaterBarState,
  shouldRenderInventoryQuantity,
} from "../inventory/inventoryRuntime.js";
import { renderInventoryItem } from "../inventory/inventoryVisuals.js";
import { createWildAtollRuntime } from "../world/wildAtollRuntime.js";

export const COMBAT_ACTION_LABEL_BOTTOM_OVERFLOW = 2;

export function combatActionLabelScreenPosition(rect, transform, labelWidth, labelHeight) {
  return {
    x: Math.round(transform.x + (rect.x + rect.width / 2) * transform.scaleX - labelWidth / 2),
    y: Math.round(
      transform.y
      + (rect.y + rect.height) * transform.scaleY
      - labelHeight
      + COMBAT_ACTION_LABEL_BOTTOM_OVERFLOW,
    ),
  };
}

export function createCombatLoadoutRuntime(scene, {
  slotDefinitions,
  getGameplayState = () => null,
  isSuppressed = () => false,
  dragCoordinator,
} = {}) {
  if (!Array.isArray(slotDefinitions) || slotDefinitions.length === 0) {
    throw new Error("Combat loadout runtime requires slot definitions");
  }
  const presentationContainer = scene.add.container(0, 0).setDepth(HUD_DEPTH + 4).setScrollFactor(0);
  const frameGraphics = scene.add.graphics().setScrollFactor(0);
  const itemGraphics = slotDefinitions.map(() => scene.add.graphics().setScrollFactor(0));
  const itemImages = slotDefinitions.map(() => scene.add.image(0, 0, FARMING_TEXTURE_KEY, 0)
    .setOrigin(0)
    .setScrollFactor(0)
    .setVisible(false));
  const waterBarGraphics = slotDefinitions.map(() => scene.add.graphics().setScrollFactor(0));
  const labelGraphics = slotDefinitions.map(() => scene.add.graphics().setDepth(HUD_DEPTH + 28).setScrollFactor(0));
  const quantityGraphics = slotDefinitions.map(() => scene.add.graphics().setDepth(HUD_DEPTH + 29).setScrollFactor(0));
  const slotZones = slotDefinitions.map((rect, index) => createSlotZone(rect, index));
  presentationContainer.add([
    frameGraphics,
    ...itemGraphics,
    ...itemImages,
    ...waterBarGraphics,
    ...slotZones,
  ]);

  let destroyed = false;
  let presentationVisible = true;
  let dragEnabled = false;
  const ownsWildAtollRuntime = !scene.wildAtollRuntime;
  if (ownsWildAtollRuntime) {
    scene.wildAtollRuntime = createWildAtollRuntime(scene, { localization: scene.localization });
  }

  function gameplay() {
    return getGameplayState?.() ?? null;
  }

  function slots() {
    return gameplay()?.combatLoadout?.slots ?? [];
  }

  function panelVisible() {
    return !destroyed && !isSuppressed() && presentationVisible;
  }

  function stop(pointer, event) {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
  }

  function createSlotZone(rect, index) {
    const zone = scene.add.zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setDepth(HUD_DEPTH + 6)
      .setScrollFactor(0);
    zone.on("pointerdown", (pointer, _localX, _localY, event) => {
      stop(pointer, event);
      if (!panelVisible() || !dragEnabled) return;
      dragCoordinator?.begin?.("combat", index, pointer, event);
    });
    return zone;
  }

  function quickUseEnabled() {
    const mode = scene.gameHud?.getInventoryModeState?.();
    return Boolean(mode)
      && !mode.suppressed
      && !mode.transitioning
      && !mode.altDown
      && mode.mode === "COMBAT";
  }

  function quickUse(slotIndex) {
    if (!quickUseEnabled() || slotDefinitions[slotIndex]?.kind !== "number") return { status: "blocked", mutated: false };
    const result = useCombatNumberSlot(gameplay(), slotIndex);
    if (result.messageKey) scene.gameHud?.showTransientMessage?.(result.messageKey);
    if (!result.mutated) return result;
    scene.needsFlowRuntime?.reset?.(needMeterValues(gameplay()));
    scene.syncPlayerEnergyTarget?.();
    render();
    scene.gameHud?.render?.();
    scene.audioRuntime?.playEffect?.("inventory-change");
    scene.saveSession?.();
    return result;
  }

  function onNumberKey(event) {
    if (destroyed || event?.repeat || isEditableTarget(event?.target)) return;
    const match = /^(?:Digit|Numpad)([1-6])$/.exec(String(event?.code ?? ""));
    if (!match) return;
    const slotIndex = slotDefinitions.findIndex((slot) => slot.kind === "number" && slot.label === match[1]);
    if (slotIndex < 0) return;
    const result = quickUse(slotIndex);
    if (result.status !== "blocked") event.preventDefault?.();
  }

  function render() {
    if (destroyed) return;
    const visible = panelVisible();
    presentationContainer.setVisible(visible);
    frameGraphics.clear().setVisible(visible);
    itemGraphics.forEach((graphics) => graphics.clear().setVisible(visible));
    itemImages.forEach((image) => image.setVisible(false));
    waterBarGraphics.forEach((graphics) => graphics.clear().setVisible(false));
    labelGraphics.forEach((graphics) => graphics.clear());
    quantityGraphics.forEach((graphics) => graphics.clear());
    slotZones.forEach((zone) => (
      visible && dragEnabled
        ? zone.setInteractive({ useHandCursor: true })
        : zone.disableInteractive()
    ));
    if (!visible) {
      syncScreenLabels();
      return;
    }

    slotDefinitions.forEach((rect, index) => {
      frameGraphics.fillStyle(HUD_COLORS.panel, 0.92).fillRect(rect.x, rect.y, rect.width, rect.height);
      frameGraphics.lineStyle(1, HUD_COLORS.border, 0.95)
        .strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
      renderSlotLabel(labelGraphics[index], rect);
      const item = slots()[index];
      if (!item) return;
      renderInventoryItem(itemGraphics[index], itemImages[index], item.id, gameplay(), rect.x + 3, rect.y + 3);
      if (item.id === "water-bucket") renderWaterBar(waterBarGraphics[index], rect);
      if (shouldRenderInventoryQuantity(item)) {
        drawBitmapTextInto(quantityGraphics[index], 0, 0, String(item.quantity), { shadow: 0 });
      }
    });
    syncScreenLabels();
  }

  function renderWaterBar(graphics, rect) {
    const bucket = gameplay()?.farm?.waterBucket;
    if (!bucket) return;
    const bar = inventoryWaterBarState(rect, bucket.currentWater, bucket.capacity);
    graphics.setVisible(true)
      .fillStyle(HUD_COLORS.shadow, 0.96).fillRect(bar.x, bar.y, bar.width, bar.height)
      .lineStyle(1, HUD_COLORS.border, 1).strokeRect(bar.x + 0.5, bar.y + 0.5, bar.width - 1, bar.height - 1);
    if (bar.fillHeight > 0) {
      graphics.fillStyle(0x55b6d3, 1)
        .fillRect(bar.x + 1, bar.y + bar.height - 1 - bar.fillHeight, bar.width - 2, bar.fillHeight);
    }
  }

  function syncScreenLabels() {
    const visible = panelVisible() && presentationContainer.visible && presentationContainer.alpha > 0.001;
    const scaleX = presentationContainer.scaleX || 1;
    const scaleY = presentationContainer.scaleY || 1;
    const alpha = presentationContainer.alpha;
    slotDefinitions.forEach((rect, index) => {
      const label = labelGraphics[index];
      const labelWidth = rect.kind === "number" ? measureBitmapText(rect.label) : measureCompactCombatLabel(rect.label);
      const labelHeight = rect.kind === "number" ? 7 : 5;
      const numberLabelPosition = inventorySlotLabelScreenPosition(rect, presentationContainer);
      const actionLabelPosition = combatActionLabelScreenPosition(
        rect,
        presentationContainer,
        labelWidth,
        labelHeight,
      );
      label.setPosition(
        rect.kind === "number"
          ? numberLabelPosition.x
          : actionLabelPosition.x,
        rect.kind === "number"
          ? numberLabelPosition.y
          : actionLabelPosition.y,
      ).setAlpha(alpha).setVisible(visible);
      const item = slots()[index];
      const quantity = quantityGraphics[index];
      const text = shouldRenderInventoryQuantity(item) ? String(item.quantity) : "";
      quantity.setPosition(
        Math.round(presentationContainer.x + (rect.x + rect.width - 2) * scaleX - measureBitmapText(text)),
        Math.round(presentationContainer.y + (rect.y + 13) * scaleY),
      ).setAlpha(alpha).setVisible(visible && text.length > 0);
    });
  }

  function update() {
    if (!destroyed) syncScreenLabels();
  }

  scene.events.on("update", update);
  globalThis.window?.addEventListener?.("keydown", onNumberKey);

  const presentation = {
    getTransformTarget: () => presentationContainer,
    setVisible(value) {
      presentationVisible = Boolean(value);
      if (!presentationVisible) dragCoordinator?.cancel?.();
      presentationContainer.setVisible(panelVisible());
      syncScreenLabels();
    },
    setDragEnabled(value) {
      dragEnabled = Boolean(value);
      if (!dragEnabled) dragCoordinator?.cancel?.();
      slotZones.forEach((zone) => (
        panelVisible() && dragEnabled
          ? zone.setInteractive({ useHandCursor: true })
          : zone.disableInteractive()
      ));
    },
    isDragEnabled: () => dragEnabled,
    syncScreenLabels,
    getState: () => ({
      x: presentationContainer.x,
      y: presentationContainer.y,
      scale: presentationContainer.scaleX,
      alpha: presentationContainer.alpha,
      visible: panelVisible(),
      dragEnabled,
      labelScreenScale: 1,
    }),
  };

  const unregisterPanel = dragCoordinator?.registerPanel?.("combat", {
    presentation,
    slotAreas: slotDefinitions,
    onChange: render,
    onClick: quickUse,
  });

  render();

  return {
    render,
    presentation,
    quickUse,
    getActionItem(actionId) {
      const index = slotDefinitions.findIndex((slot) => slot.kind === "action" && slot.id === actionId);
      return index >= 0 ? cloneInventoryItem(slots()[index]) : null;
    },
    getState: () => ({
      slots: slots().map((item) => cloneInventoryItem(item)),
      quantityLabels: slots().flatMap((item, slotIndex) => (
        shouldRenderInventoryQuantity(item) ? [{ slotIndex, text: String(item.quantity), screenScale: 1 }] : []
      )),
      presentation: presentation.getState(),
    }),
    isPointInHud(x, y) {
      if (!panelVisible()) return false;
      const scaleX = presentationContainer.scaleX || 1;
      const scaleY = presentationContainer.scaleY || 1;
      const localX = (x - presentationContainer.x) / scaleX;
      const localY = (y - presentationContainer.y) / scaleY;
      return slotDefinitions.some((rect) => isPointInRect(localX, localY, rect));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unregisterPanel?.();
      scene.events.off("update", update);
      globalThis.window?.removeEventListener?.("keydown", onNumberKey);
      if (ownsWildAtollRuntime) {
        scene.wildAtollRuntime?.destroy?.();
        scene.wildAtollRuntime = null;
      }
      presentationContainer.destroy(true);
      labelGraphics.forEach((graphics) => graphics.destroy());
      quantityGraphics.forEach((graphics) => graphics.destroy());
    },
  };
}

function renderSlotLabel(graphics, rect) {
  if (rect.kind === "number") {
    drawBitmapTextInto(graphics, 0, 0, rect.label, {
      color: HUD_COLORS.light,
      shadow: 0,
    });
    return;
  }
  drawCompactCombatLabel(graphics, 0, 0, rect.label);
}

const COMPACT_COMBAT_GLYPHS = Object.freeze({
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  P: ["110", "101", "110", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
});

function measureCompactCombatLabel(label) {
  return label.length * 3 + Math.max(0, label.length - 1);
}

function drawCompactCombatLabel(graphics, x, y, label) {
  let cursorX = x;
  graphics.fillStyle(HUD_COLORS.light, 0.9);
  for (const char of label) {
    const glyph = COMPACT_COMBAT_GLYPHS[char] ?? COMPACT_COMBAT_GLYPHS.E;
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if (glyph[row][col] === "1") graphics.fillRect(cursorX + col, y + row, 1, 1);
      }
    }
    cursorX += 4;
  }
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
