import {
  INVENTORY_SLOT_COUNT,
  addInventoryItem,
  canAddInventoryItem,
  cloneInventoryItem,
  createWorldItemId,
  swapInventorySlots,
  takeInventorySlot,
} from "./inventoryDomain.js";
import { drawInventoryItem } from "./inventoryVisuals.js";
import { HUD_COLORS, HUD_DEPTH, drawBitmapTextInto, isPointInRect, measureBitmapText } from "./hud.js";

export const INVENTORY_SLOT_SIZE = 22;
export const INVENTORY_SLOT_GAP = 2;
export const INVENTORY_HUD_AREA = Object.freeze({
  x: 41,
  y: 156,
  width: INVENTORY_SLOT_COUNT * INVENTORY_SLOT_SIZE + (INVENTORY_SLOT_COUNT - 1) * INVENTORY_SLOT_GAP,
  height: INVENTORY_SLOT_SIZE,
});
export const INVENTORY_SLOT_AREAS = Object.freeze(Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => Object.freeze({
  x: INVENTORY_HUD_AREA.x + index * (INVENTORY_SLOT_SIZE + INVENTORY_SLOT_GAP),
  y: INVENTORY_HUD_AREA.y,
  width: INVENTORY_SLOT_SIZE,
  height: INVENTORY_SLOT_SIZE,
})));

const TOOL_VISIBLE_MS = 1000;
const TOOL_FADE_MS = 1000;
const DROP_HITBOX_SIZE = 2;
const DROP_THROW_DISTANCE = 28;
const DROP_THROW_DURATION_MS = 320;
const DROP_SLIDE_SPEED = 36;
const DROP_PICKUP_RADIUS = 12;
const DROP_SEARCH_LIMIT = 96;

export function inventoryIndexFromKeyboardEvent(event) {
  if (!event || event.repeat || isEditableTarget(event.target)) return null;
  const code = String(event.code ?? "");
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (!match) return null;
  const digit = Number(match[1]);
  return digit === 0 ? 9 : digit - 1;
}

export function inventorySlotIndexAt(x, y) {
  return INVENTORY_SLOT_AREAS.findIndex((rect) => isPointInRect(x, y, rect));
}

export function createInventoryRuntime(scene, options = {}) {
  const {
    getGameplayState = () => null,
    getPlayerCharacter = () => scene.playerCharacter ?? null,
    isSuppressed = () => false,
    onPersistentMutation = () => {},
  } = options;

  const hudGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 4).setScrollFactor(0);
  const slotItemGraphics = INVENTORY_SLOT_AREAS.map(() => scene.add.graphics().setDepth(HUD_DEPTH + 5).setScrollFactor(0));
  const dragGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 7).setScrollFactor(0).setVisible(false);
  const heldGraphics = scene.add.graphics().setDepth(900).setVisible(false);
  const slotZones = INVENTORY_SLOT_AREAS.map((rect, index) => createSlotZone(scene, rect, index));
  const worldVisuals = new Map();
  const motions = new Map();

  let destroyed = false;
  let selectedIndex = null;
  let selectedAtMs = 0;
  let dragCandidate = null;
  let dragging = false;

  function gameplay() {
    return getGameplayState?.() ?? null;
  }

  function inventory() {
    return gameplay()?.inventory ?? null;
  }

  function worldItems() {
    return gameplay()?.worldItems ?? [];
  }

  function active() {
    return !destroyed && !isSuppressed();
  }

  function stop(pointer, event) {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
  }

  function createSlotZone(_scene, rect, index) {
    const zone = _scene.add.zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setDepth(HUD_DEPTH + 6)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerdown", (pointer, _localX, _localY, event) => {
      stop(pointer, event);
      if (!active()) return;
      const current = inventory()?.slots?.[index] ?? null;
      if (!current) {
        selectedIndex = null;
        selectedAtMs = scene.time.now;
        render();
        return;
      }
      dragCandidate = { index, startX: pointer.x, startY: pointer.y };
      dragging = false;
    });
    return zone;
  }

  function handlePointerMove(pointer) {
    if (!dragCandidate || !active()) return;
    const distance = Math.hypot(pointer.x - dragCandidate.startX, pointer.y - dragCandidate.startY);
    if (!dragging && distance >= 3) dragging = true;
    if (dragging) {
      stop(pointer);
      renderDrag(pointer.x, pointer.y);
    }
  }

  function handlePointerUp(pointer) {
    if (!dragCandidate) return;
    const fromIndex = dragCandidate.index;
    const wasDragging = dragging;
    dragCandidate = null;
    dragging = false;
    dragGraphics.clear().setVisible(false);
    if (!active()) return;
    if (!wasDragging) {
      toggleSelection(fromIndex);
      return;
    }
    const targetIndex = inventorySlotIndexAt(pointer.x, pointer.y);
    if (targetIndex >= 0) {
      const result = swapInventorySlots(inventory(), fromIndex, targetIndex);
      if (result.mutated) {
        if (selectedIndex === fromIndex) selectedIndex = targetIndex;
        else if (selectedIndex === targetIndex) selectedIndex = fromIndex;
        onPersistentMutation(result);
      }
      render();
      return;
    }
    if (!isPointInRect(pointer.x, pointer.y, INVENTORY_HUD_AREA)) dropSlot(fromIndex);
  }

  function handlePointerCancel() {
    dragCandidate = null;
    dragging = false;
    dragGraphics.clear().setVisible(false);
  }

  function handleKeyDown(event) {
    const index = inventoryIndexFromKeyboardEvent(event);
    if (index === null || !active()) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    toggleSelection(index);
  }

  function toggleSelection(index) {
    const item = inventory()?.slots?.[index] ?? null;
    selectedIndex = item && selectedIndex !== index ? index : null;
    selectedAtMs = scene.time.now;
    render();
  }

  function dropSlot(slotIndex) {
    const currentInventory = inventory();
    const character = getPlayerCharacter?.();
    const sprite = character?.sprite;
    if (!currentInventory || !sprite) return { status: "unavailable", mutated: false };
    const taken = takeInventorySlot(currentInventory, slotIndex);
    if (!taken.mutated) return taken;
    const facing = facingVector(character.lastFacing);
    const origin = { x: Number(sprite.x), y: Number(sprite.y) - 2 };
    const target = {
      x: origin.x + facing.x * DROP_THROW_DISTANCE,
      y: origin.y + facing.y * DROP_THROW_DISTANCE,
    };
    const id = createWorldItemId(worldItems());
    const worldItem = { id, item: cloneInventoryItem(taken.item), x: origin.x, y: origin.y };
    worldItems().push(worldItem);
    motions.set(id, {
      phase: "arc",
      elapsedMs: 0,
      settleElapsedMs: 0,
      startX: origin.x,
      startY: origin.y,
      targetX: target.x,
      targetY: target.y,
      directionX: facing.x || 1,
      directionY: facing.y,
      arcHeight: 0,
      bounces: 0,
    });
    if (selectedIndex === slotIndex) selectedIndex = null;
    render();
    syncWorldVisuals();
    onPersistentMutation({ status: "dropped", mutated: true, slotIndex, worldItem });
    return { status: "dropped", mutated: true, worldItem };
  }

  function render() {
    if (destroyed) return;
    const visible = active();
    hudGraphics.clear().setVisible(visible);
    slotZones.forEach((zone) => visible ? zone.setInteractive({ useHandCursor: true }) : zone.disableInteractive());
    slotItemGraphics.forEach((graphics) => graphics.clear().setVisible(visible));
    if (!visible) {
      dragGraphics.clear().setVisible(false);
      heldGraphics.clear().setVisible(false);
      return;
    }
    const slots = inventory()?.slots ?? [];
    INVENTORY_SLOT_AREAS.forEach((rect, index) => {
      const selected = selectedIndex === index;
      hudGraphics.fillStyle(HUD_COLORS.panel, 0.9).fillRect(rect.x, rect.y, rect.width, rect.height);
      hudGraphics.lineStyle(selected ? 2 : 1, selected ? 0xf0c45c : HUD_COLORS.border, selected ? 1 : 0.9)
        .strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
      drawBitmapTextInto(hudGraphics, rect.x + 2, rect.y + 2, index === 9 ? "0" : String(index + 1), {
        color: selected ? 0xf0c45c : HUD_COLORS.light,
        shadow: 0,
      });
      const item = slots[index];
      if (!item) return;
      const graphics = slotItemGraphics[index];
      drawInventoryItem(graphics, item.id);
      graphics.setPosition(rect.x + 3, rect.y + 3).setScale(1).setAlpha(dragCandidate?.index === index && dragging ? 0.25 : 1);
      if (item.kind === "loot" && item.quantity > 1) {
        const text = String(item.quantity);
        drawBitmapTextInto(hudGraphics, rect.x + rect.width - measureBitmapText(text) - 2, rect.y + 13, text, { shadow: 0 });
      }
    });
  }

  function renderDrag(x, y) {
    const item = inventory()?.slots?.[dragCandidate?.index] ?? null;
    dragGraphics.clear();
    if (!item) return dragGraphics.setVisible(false);
    drawInventoryItem(dragGraphics, item.id);
    dragGraphics.setPosition(Math.round(x - 8), Math.round(y - 8)).setVisible(true).setAlpha(0.9);
  }

  function update(time, deltaMs) {
    if (destroyed) return;
    updateMotions(Math.max(0, Number(deltaMs) || 0));
    syncWorldVisuals();
    collectNearbyWorldItems();
    updateHeldItem(Number(time) || scene.time.now);
  }

  function updateHeldItem(nowMs) {
    heldGraphics.clear().setVisible(false);
    if (!active() || selectedIndex === null) return;
    const item = inventory()?.slots?.[selectedIndex] ?? null;
    const character = getPlayerCharacter?.();
    const sprite = character?.sprite;
    if (!item || !sprite) return;
    let alpha = 1;
    if (item.kind === "tool") {
      const elapsed = Math.max(0, nowMs - selectedAtMs);
      if (elapsed >= TOOL_VISIBLE_MS + TOOL_FADE_MS) return;
      if (elapsed > TOOL_VISIBLE_MS) alpha = 1 - (elapsed - TOOL_VISIBLE_MS) / TOOL_FADE_MS;
    }
    drawInventoryItem(heldGraphics, item.id);
    heldGraphics
      .setPosition(Math.round(sprite.x - 8), Math.round(sprite.y - 35))
      .setDepth(700 + Math.round(sprite.y))
      .setAlpha(alpha)
      .setVisible(true);
  }

  function syncWorldVisuals() {
    const existing = new Set();
    for (const worldItem of worldItems()) {
      existing.add(worldItem.id);
      let graphics = worldVisuals.get(worldItem.id);
      if (!graphics) {
        graphics = scene.add.graphics();
        drawInventoryItem(graphics, worldItem.item.id);
        worldVisuals.set(worldItem.id, graphics);
      }
      const motion = motions.get(worldItem.id);
      const arcHeight = motion?.arcHeight ?? 0;
      graphics
        .setPosition(Math.round(worldItem.x - 8), Math.round(worldItem.y - 8 - arcHeight))
        .setDepth(500 + Math.round(worldItem.y))
        .setVisible(true);
    }
    for (const [id, graphics] of worldVisuals) {
      if (existing.has(id)) continue;
      graphics.destroy();
      worldVisuals.delete(id);
      motions.delete(id);
    }
  }

  function updateMotions(deltaMs) {
    for (const [id, motion] of motions) {
      const worldItem = worldItems().find((item) => item.id === id);
      if (!worldItem) {
        motions.delete(id);
        continue;
      }
      if (motion.phase === "arc") {
        motion.elapsedMs += deltaMs;
        const t = Math.min(1, motion.elapsedMs / DROP_THROW_DURATION_MS);
        worldItem.x = lerp(motion.startX, motion.targetX, t);
        worldItem.y = lerp(motion.startY, motion.targetY, t);
        motion.arcHeight = Math.sin(Math.PI * t) * 12;
        if (t < 1) continue;
        motion.arcHeight = 0;
        if (isDropPointFree(worldItem, worldItem.x, worldItem.y)) finishMotion(worldItem, motion);
        else motion.phase = "slide";
        continue;
      }
      if (motion.phase !== "slide") continue;
      motion.settleElapsedMs += deltaMs;
      const distance = DROP_SLIDE_SPEED * deltaMs / 1000;
      let nextX = worldItem.x + motion.directionX * distance;
      let nextY = worldItem.y + motion.directionY * distance;
      if (isBlockedByWorld(nextX, worldItem.y)) {
        motion.directionX *= -1;
        motion.bounces += 1;
        nextX = worldItem.x + motion.directionX * distance;
      }
      if (isBlockedByWorld(worldItem.x, nextY)) {
        motion.directionY *= -1;
        motion.bounces += 1;
        nextY = worldItem.y + motion.directionY * distance;
      }
      if (motion.directionX === 0 && motion.directionY === 0) motion.directionX = 1;
      worldItem.x = nextX;
      worldItem.y = nextY;
      if (isDropPointFree(worldItem, nextX, nextY)) {
        finishMotion(worldItem, motion);
        continue;
      }
      if (motion.settleElapsedMs > 7000 || motion.bounces > 64) {
        const point = findNearestFreePoint(worldItem, nextX, nextY);
        worldItem.x = point.x;
        worldItem.y = point.y;
        finishMotion(worldItem, motion);
      }
    }
  }

  function finishMotion(worldItem, motion) {
    motion.phase = "rest";
    motion.arcHeight = 0;
    motions.delete(worldItem.id);
    onPersistentMutation({ status: "drop-settled", mutated: true, worldItem });
  }

  function collectNearbyWorldItems() {
    const character = getPlayerCharacter?.();
    const sprite = character?.sprite;
    const currentInventory = inventory();
    if (!sprite || !currentInventory) return;
    for (const worldItem of [...worldItems()]) {
      if (motions.has(worldItem.id)) continue;
      if (Math.hypot(sprite.x - worldItem.x, sprite.y - worldItem.y) > DROP_PICKUP_RADIUS) continue;
      const availability = canAddInventoryItem(currentInventory, worldItem.item);
      if (!availability.canAdd) continue;
      const result = addInventoryItem(currentInventory, worldItem.item);
      if (!result.mutated) continue;
      const index = worldItems().findIndex((item) => item.id === worldItem.id);
      if (index >= 0) worldItems().splice(index, 1);
      worldVisuals.get(worldItem.id)?.destroy();
      worldVisuals.delete(worldItem.id);
      render();
      onPersistentMutation({ status: "picked-up", mutated: true, worldItem, inventory: result });
    }
  }

  function isDropPointFree(worldItem, x, y) {
    return !isBlockedByWorld(x, y) && !worldItems().some((other) => other.id !== worldItem.id && overlapsDrop(x, y, other.x, other.y));
  }

  function isBlockedByWorld(x, y) {
    const box = dropBox(x, y);
    const bounds = scene.worldLayout?.bounds;
    if (bounds && (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom)) return true;
    return (scene.worldLayout?.getBlockingColliders?.(box)?.length ?? 0) > 0;
  }

  function findNearestFreePoint(worldItem, startX, startY) {
    for (let radius = 1; radius <= DROP_SEARCH_LIMIT; radius += 1) {
      for (let offset = -radius; offset <= radius; offset += 1) {
        const candidates = [
          { x: startX + offset, y: startY - radius },
          { x: startX + offset, y: startY + radius },
          { x: startX - radius, y: startY + offset },
          { x: startX + radius, y: startY + offset },
        ];
        const point = candidates.find((candidate) => isDropPointFree(worldItem, candidate.x, candidate.y));
        if (point) return point;
      }
    }
    return { x: startX, y: startY };
  }

  scene.input.on("pointermove", handlePointerMove);
  scene.input.on("pointerup", handlePointerUp);
  scene.input.on("pointercancel", handlePointerCancel);
  scene.input.keyboard?.on?.("keydown", handleKeyDown);
  scene.events.on("update", update);
  render();
  syncWorldVisuals();

  return {
    render,
    update,
    dropSlot,
    getSelectedIndex: () => selectedIndex,
    getState: () => ({
      selectedIndex,
      dragging,
      slots: (inventory()?.slots ?? []).map((item) => cloneInventoryItem(item)),
      worldItems: worldItems().map((item) => ({ ...item, item: cloneInventoryItem(item.item) })),
    }),
    isPointInHud(x, y) {
      return active() && isPointInRect(x, y, INVENTORY_HUD_AREA);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off("pointermove", handlePointerMove);
      scene.input.off("pointerup", handlePointerUp);
      scene.input.off("pointercancel", handlePointerCancel);
      scene.input.keyboard?.off?.("keydown", handleKeyDown);
      scene.events.off("update", update);
      slotZones.forEach((zone) => zone.destroy());
      slotItemGraphics.forEach((graphics) => graphics.destroy());
      for (const graphics of worldVisuals.values()) graphics.destroy();
      worldVisuals.clear();
      motions.clear();
      hudGraphics.destroy();
      dragGraphics.destroy();
      heldGraphics.destroy();
    },
  };
}

function facingVector(facing) {
  if (facing === "up") return { x: 0, y: -1 };
  if (facing === "left") return { x: -1, y: 0 };
  if (facing === "right") return { x: 1, y: 0 };
  return { x: 0, y: 1 };
}

function dropBox(x, y) {
  const half = DROP_HITBOX_SIZE / 2;
  return { left: x - half, right: x + half, top: y - half, bottom: y + half };
}

function overlapsDrop(ax, ay, bx, by) {
  const a = dropBox(ax, ay);
  const b = dropBox(bx, by);
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function isEditableTarget(target) {
  const tagName = String(target?.tagName ?? "").toLowerCase();
  return Boolean(target?.isContentEditable) || tagName === "input" || tagName === "textarea" || tagName === "select";
}
