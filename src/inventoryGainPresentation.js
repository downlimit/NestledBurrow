import { HUD_DEPTH } from "./hud.js";
import { FARMING_TEXTURE_KEY } from "./farmingConfig.js";
import { drawInventoryItem, inventoryItemAsset, renderInventoryItem } from "./inventoryVisuals.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";
import { aggregateTransientNumber, restartTransientNumberTween } from "./transientNumberPresentation.js";

export const INVENTORY_GAIN_HOLD_MS = 700;
export const INVENTORY_GAIN_DROP_MS = 300;
export const INVENTORY_GAIN_DURATION_MS = INVENTORY_GAIN_HOLD_MS + INVENTORY_GAIN_DROP_MS;
export const INVENTORY_GAIN_ICON_HOLD_SCALE = 1.5;

const OUTLINE_OFFSETS = Object.freeze([[0, -1], [-1, 0], [1, 0], [0, 1]]);
const TINT_MODE_FILL = 1;

export function aggregateInventoryGain(active, { itemId, slotIndex, added, nowMs }, durationMs = INVENTORY_GAIN_DURATION_MS) {
  const key = `${itemId}:${slotIndex}`;
  return aggregateTransientNumber(active, {
    key,
    itemId,
    slotIndex,
    amount: added,
    nowMs,
  }, durationMs);
}

export function createInventoryGainPresentation(scene, {
  slotAreas,
  getGameplayState = () => null,
  onChange = () => {},
  presentation = null,
} = {}) {
  const activeLabels = new Map();
  const activeIcons = new Set();
  let destroyed = false;

  function notify(result) {
    if (destroyed || !result?.mutated || !Array.isArray(result.plan)) return [];
    const created = result.plan.flatMap((operation) => {
      const rect = slotAreas?.[operation.slotIndex];
      if (!rect) return [];
      return [operation.wasEmpty
        ? showIcon(result.item.id, rect)
        : showAmount(result.item.id, operation, rect)];
    });
    if (created.length > 0) onChange();
    return created;
  }

  function showIcon(itemId, rect) {
    const outline = createOutline(scene, itemId, getGameplayState());
    const graphics = scene.add.graphics();
    const image = scene.add.image(0, 0, FARMING_TEXTURE_KEY, 0).setOrigin(0);
    const x = rect.x + Math.round((rect.width - 16) / 2);
    const startY = rect.y - 15;
    const endY = rect.y + Math.round((rect.height - 16) / 2);
    renderInventoryItem(graphics, image, itemId, getGameplayState(), 0, 0);
    const container = scene.add.container(x, startY, [...outline, graphics, image])
      .setDepth(HUD_DEPTH + 20)
      .setScrollFactor(0)
      .setScale(INVENTORY_GAIN_ICON_HOLD_SCALE);
    presentation?.addObjects?.(container);
    const pair = {
      container,
      outline,
      itemId,
      slotIndex: slotAreas.indexOf(rect),
      kind: "icon",
    };
    activeIcons.add(pair);
    scene.tweens.add({
      targets: container,
      y: endY,
      scaleX: 1,
      scaleY: 1,
      delay: INVENTORY_GAIN_HOLD_MS,
      duration: INVENTORY_GAIN_DROP_MS,
      ease: "Linear",
      onComplete: () => {
        activeIcons.delete(pair);
        container.destroy(true);
        onChange();
      },
    });
    scene.tweens.add({
      targets: outline,
      alpha: 0,
      delay: INVENTORY_GAIN_HOLD_MS,
      duration: INVENTORY_GAIN_DROP_MS,
      ease: "Linear",
    });
    return pair;
  }

  function showAmount(itemId, operation, rect) {
    const nowMs = scene.time?.now ?? globalThis.performance?.now?.() ?? Date.now();
    const key = `${itemId}:${operation.slotIndex}`;
    let entry = activeLabels.get(key);
    const aggregate = aggregateInventoryGain(
      new Map(entry ? [[key, entry.aggregate]] : []),
      { itemId, slotIndex: operation.slotIndex, added: operation.added, nowMs },
    );
    if (!entry) {
      const text = createManagedText(scene, 0, 0, "", {
        fontSize: "8px",
        color: "#fff3a6",
      }).setDepth(HUD_DEPTH + 21).setScrollFactor(0);
      entry = { key, text, aggregate };
      activeLabels.set(key, entry);
      presentation?.addObjects?.(text);
    } else {
      entry.aggregate = aggregate;
    }
    const startY = rect.y - 9;
    const endY = rect.y + 7;
    setManagedTextStyle(entry.text, scene, {
      fontFamily: scene.localization?.getLocale?.().fontKey ?? "sans-serif",
      fontSize: "8px",
      color: "#fff3a6",
    }).setText(`+${aggregate.amount}`)
      .setVisible(true);
    restartTransientNumberTween(scene, {
      text: entry.text,
      start: { x: rect.x + (rect.width - entry.text.width) / 2, y: startY },
      end: { x: rect.x + (rect.width - entry.text.width) / 2, y: endY },
      holdMs: INVENTORY_GAIN_HOLD_MS,
      dropMs: INVENTORY_GAIN_DROP_MS,
      onComplete: () => {
        if (activeLabels.get(key) !== entry) return;
        activeLabels.delete(key);
        entry.text.destroy();
      },
    });
    return entry;
  }

  return {
    notify,
    getState: () => ({
      durationMs: INVENTORY_GAIN_DURATION_MS,
      holdMs: INVENTORY_GAIN_HOLD_MS,
      dropMs: INVENTORY_GAIN_DROP_MS,
      labels: [...activeLabels.values()].map((entry) => ({
        ...entry.aggregate,
        text: entry.text.text,
        y: entry.text.y,
      })),
      icons: [...activeIcons].map(({ itemId, slotIndex, kind, container, outline }) => ({
        itemId,
        slotIndex,
        kind,
        y: container.y,
        scale: container.scaleX,
        outlineAlpha: outline[0]?.alpha ?? 0,
      })),
    }),
    isSlotPending(slotIndex, itemId) {
      return [...activeIcons].some((entry) => entry.slotIndex === slotIndex && entry.itemId === itemId);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const entry of activeLabels.values()) {
        scene.tweens.killTweensOf(entry.text);
        entry.text.destroy();
      }
      for (const pair of activeIcons) {
        scene.tweens.killTweensOf([pair.container, ...pair.outline]);
        pair.container.destroy(true);
      }
      activeLabels.clear();
      activeIcons.clear();
    },
  };
}

function createOutline(scene, itemId, gameplay) {
  const asset = inventoryItemAsset(itemId, gameplay);
  return OUTLINE_OFFSETS.map(([x, y]) => {
    if (asset) {
      return scene.add.image(x, y, asset.textureKey, asset.frame)
        .setOrigin(0)
        .setTint(0xffffff)
        .setTintMode(TINT_MODE_FILL);
    }
    const graphics = scene.add.graphics().setPosition(x, y);
    drawInventoryItem(graphics, itemId, { colorOverride: 0xffffff });
    return graphics;
  });
}
