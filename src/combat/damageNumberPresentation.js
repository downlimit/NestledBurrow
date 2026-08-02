import {
  INVENTORY_GAIN_DROP_MS,
  INVENTORY_GAIN_DURATION_MS,
  INVENTORY_GAIN_HOLD_MS,
} from "../inventory/inventoryGainPresentation.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import { aggregateTransientNumber, restartTransientNumberTween } from "../ui/transientNumberPresentation.js";

export function createDamageNumberPresentation(scene) {
  const active = new Map();
  let destroyed = false;

  function notify({ targetId, damage, anchor }) {
    if (destroyed || !targetId || !(damage > 0)) return null;
    const nowMs = scene.time?.now ?? globalThis.performance?.now?.() ?? Date.now();
    let entry = active.get(targetId);
    const aggregates = new Map(entry ? [[targetId, entry.aggregate]] : []);
    const aggregate = aggregateTransientNumber(aggregates, {
      key: targetId,
      amount: damage,
      nowMs,
      targetId,
    }, INVENTORY_GAIN_DURATION_MS);
    if (!entry) {
      const text = createManagedText(scene, 0, 0, "", {
        fontSize: "8px",
        color: "#fff3a6",
      }).setDepth(900);
      entry = { targetId, text, aggregate };
      active.set(targetId, entry);
    } else {
      entry.aggregate = aggregate;
    }
    setManagedTextStyle(entry.text, scene, {
      fontFamily: scene.localization?.getLocale?.().fontKey ?? "sans-serif",
      fontSize: "8px",
      color: "#fff3a6",
    }).setText(String(aggregate.amount));
    const start = { x: anchor.x - entry.text.width / 2, y: anchor.y - 8 };
    const end = { x: start.x, y: anchor.y - 20 };
    restartTransientNumberTween(scene, {
      text: entry.text,
      start,
      end,
      holdMs: INVENTORY_GAIN_HOLD_MS,
      dropMs: INVENTORY_GAIN_DROP_MS,
      onComplete: () => {
        if (active.get(targetId) !== entry) return;
        active.delete(targetId);
        entry.text.destroy();
      },
    });
    return aggregate;
  }

  return {
    notify,
    getState: () => [...active.values()].map((entry) => ({
      ...entry.aggregate,
      text: entry.text.text,
      x: entry.text.x,
      y: entry.text.y,
    })),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const entry of active.values()) {
        scene.tweens.killTweensOf(entry.text);
        entry.text.destroy();
      }
      active.clear();
    },
  };
}
