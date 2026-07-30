import { cloneInventoryItem, swapLoadoutSlots } from "./inventoryDomain.js";
import { FARMING_TEXTURE_KEY } from "./farmingConfig.js";
import { HUD_DEPTH, isPointInRect } from "./hud.js";
import { renderInventoryItem } from "./inventoryVisuals.js";

const DRAG_THRESHOLD = 3;

export function createLoadoutDragCoordinator(scene, {
  getGameplayState = () => null,
  onPersistentMutation = () => {},
  playEffect = () => {},
  onWorldDrop = () => {},
  onAimTarget = () => {},
} = {}) {
  const dragGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 60).setScrollFactor(0).setVisible(false);
  const dragImage = scene.add.image(0, 0, FARMING_TEXTURE_KEY, 0)
    .setOrigin(0)
    .setDepth(HUD_DEPTH + 60)
    .setScrollFactor(0)
    .setVisible(false);
  const panels = new Map();
  let enabled = false;
  let candidate = null;
  let dragging = false;
  let destroyed = false;
  let transferredDuringEdit = false;

  function slotsFor(panel) {
    const gameplay = getGameplayState?.();
    return panel === "peaceful"
      ? gameplay?.inventory?.slots ?? []
      : gameplay?.combatLoadout?.slots ?? [];
  }

  function stop(pointer, event) {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
  }

  function panelSlotAt(panel, x, y) {
    const registration = panels.get(panel);
    const target = registration?.presentation?.getTransformTarget?.();
    if (!registration || !target || !target.visible || target.alpha <= 0) return -1;
    const scaleX = target.scaleX || 1;
    const scaleY = target.scaleY || 1;
    const localX = (x - target.x) / scaleX;
    const localY = (y - target.y) / scaleY;
    return registration.slotAreas.findIndex((rect) => isPointInRect(localX, localY, rect));
  }

  function targetAt(x, y) {
    for (const panel of ["peaceful", "combat"]) {
      const index = panelSlotAt(panel, x, y);
      if (index >= 0) return { panel, index };
    }
    return null;
  }

  function renderDrag(pointer) {
    const item = slotsFor(candidate?.panel)?.[candidate?.index] ?? null;
    dragGraphics.clear();
    dragImage.setVisible(false);
    if (!item) {
      dragGraphics.setVisible(false);
      return;
    }
    renderInventoryItem(
      dragGraphics,
      dragImage,
      item.id,
      getGameplayState?.(),
      Math.round(pointer.x - 8),
      Math.round(pointer.y - 8),
    );
    dragGraphics.setAlpha(0.92);
    dragImage.setAlpha(0.92);
  }

  function begin(panel, index, pointer, event) {
    if (!enabled || destroyed || !panels.has(panel) || !slotsFor(panel)?.[index]) return false;
    stop(pointer, event);
    candidate = { panel, index, startX: pointer.x, startY: pointer.y };
    dragging = false;
    return true;
  }

  function handlePointerMove(pointer) {
    if (!enabled || !candidate) return;
    const distance = Math.hypot(pointer.x - candidate.startX, pointer.y - candidate.startY);
    if (!dragging && distance >= DRAG_THRESHOLD) dragging = true;
    if (!dragging) return;
    stop(pointer);
    renderDrag(pointer);
    onAimTarget(pointer);
  }

  function handlePointerUp(pointer) {
    if (!candidate) return;
    const source = { panel: candidate.panel, index: candidate.index };
    const wasDragging = dragging;
    cancel();
    if (!enabled || !wasDragging) return;
    const target = targetAt(pointer.x, pointer.y);
    if (!target) {
      onWorldDrop(source, pointer);
      return;
    }
    const gameplay = getGameplayState?.();
    const result = swapLoadoutSlots({
      inventory: gameplay?.inventory,
      combatLoadout: gameplay?.combatLoadout,
    }, source, target);
    if (!result.mutated) return;
    transferredDuringEdit = true;
    playEffect("inventory-change");
    for (const registration of panels.values()) registration.onChange?.(result);
    onPersistentMutation(result);
  }

  function cancel() {
    candidate = null;
    dragging = false;
    dragGraphics.clear().setVisible(false);
    dragImage.setVisible(false);
    onAimTarget(null);
  }

  scene.input.on("pointermove", handlePointerMove);
  scene.input.on("pointerup", handlePointerUp);
  scene.input.on("pointercancel", cancel);

  return {
    registerPanel(panel, registration) {
      if (panel !== "peaceful" && panel !== "combat") throw new Error(`Unsupported loadout panel: ${panel}`);
      if (!registration?.presentation || !Array.isArray(registration.slotAreas)) {
        throw new Error("Loadout panel registration requires presentation and slot areas");
      }
      panels.set(panel, registration);
      return () => panels.delete(panel);
    },
    begin,
    setEnabled(value) {
      const nextEnabled = Boolean(value);
      if (nextEnabled && !enabled) transferredDuringEdit = false;
      enabled = nextEnabled;
      if (!enabled) cancel();
    },
    isEnabled: () => enabled,
    releasePanelAt(x, y) {
      if (!transferredDuringEdit) return null;
      return targetAt(x, y)?.panel ?? null;
    },
    getState: () => ({
      enabled,
      dragging,
      source: candidate ? { panel: candidate.panel, index: candidate.index } : null,
      item: cloneInventoryItem(candidate ? slotsFor(candidate.panel)?.[candidate.index] : null),
    }),
    cancel,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      panels.clear();
      scene.input.off("pointermove", handlePointerMove);
      scene.input.off("pointerup", handlePointerUp);
      scene.input.off("pointercancel", cancel);
      dragGraphics.destroy();
      dragImage.destroy();
    },
  };
}
