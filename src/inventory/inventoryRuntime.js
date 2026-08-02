import {
  INVENTORY_SLOT_COUNT,
  cloneInventoryItem,
  createWorldItemId,
  LOADOUT_PANELS,
  routePickedInventoryItem,
  swapInventorySlots,
  takeInventorySlot,
} from "./inventoryDomain.js";
import { drawInventoryItem, inventoryItemAsset, renderInventoryItem } from "./inventoryVisuals.js";
import { HUD_COLORS, HUD_DEPTH, drawBitmapTextInto, isPointInRect, measureBitmapText } from "../ui/hud.js";
import { FARMING_TEXTURE_KEY } from "../resources/farmingConfig.js";
import { worldDepthFromAnchorY } from "../build/buildWorldGeometry.js";
import {
  throwDirectionTowardPoint,
  throwOriginFromPlayer,
  worldPointFromPointer,
} from "./worldThrowDirection.js";

export const INVENTORY_SLOT_SIZE = 22;
export const INVENTORY_SLOT_GAP = 2;
export const INVENTORY_QUANTITY_DEPTH = HUD_DEPTH + 22;
export const INVENTORY_WATER_BAR_WIDTH = 4;
export const INVENTORY_WATER_BAR_HEIGHT = 16;
export const INVENTORY_HUD_AREA = Object.freeze({
  x: 43,
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

export function inventorySlotLabelScreenPosition(rect, {
  x = 0,
  y = 0,
  scaleX = 1,
  scaleY = 1,
} = {}) {
  return {
    x: Math.round(x + (rect.x + 2) * scaleX),
    y: Math.round(y + (rect.y + 2) * scaleY),
  };
}

const TOOL_VISIBLE_MS = 1000;
const TOOL_FADE_MS = 1000;
const DROP_HITBOX_SIZE = 2;
const DROP_THROW_DISTANCE = 28;
const DROP_THROW_DURATION_MS = 320;
const DROP_SLIDE_SPEED = 36;
const DROP_PICKUP_RADIUS = 12;
const DROP_SEARCH_LIMIT = 96;
const TINT_MODE_FILL = 1;

export function inventoryIndexFromKeyboardEvent(event) {
  if (!event || event.repeat || isEditableTarget(event.target)) return null;
  const code = String(event.code ?? "");
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (!match) return null;
  const digit = Number(match[1]);
  return digit === 0 ? 9 : digit - 1;
}

export function inventoryCycleDirectionFromKeyboardEvent(event) {
  if (!event || event.repeat || isEditableTarget(event.target)) return 0;
  if (event.code === "KeyE") return 1;
  if (event.code === "KeyQ") return -1;
  return 0;
}

export function inventoryCycleDirectionFromWheelEvent(event) {
  if (!event || isEditableTarget(event.target)) return 0;
  const deltaY = Number(event.deltaY) || 0;
  if (deltaY > 0) return 1;
  if (deltaY < 0) return -1;
  return 0;
}

export function inventoryCycleIndex(slots, baseIndex, direction) {
  const step = direction < 0 ? -1 : 1;
  const base = Number.isInteger(baseIndex) ? baseIndex : step > 0 ? -1 : 0;
  for (let offset = 1; offset <= INVENTORY_SLOT_COUNT; offset += 1) {
    const index = (base + step * offset + INVENTORY_SLOT_COUNT) % INVENTORY_SLOT_COUNT;
    if (slots?.[index]) return index;
  }
  return null;
}

export function inventorySlotIndexAt(x, y) {
  return INVENTORY_SLOT_AREAS.findIndex((rect) => isPointInRect(x, y, rect));
}

export function shouldRenderInventoryQuantity(item) {
  return Boolean(item && item.kind !== "tool");
}

export function inventoryWaterBarState(rect, currentWater, capacity) {
  const ratio = Math.min(1, Math.max(0, Number(currentWater) / Number(capacity) || 0));
  const innerHeight = INVENTORY_WATER_BAR_HEIGHT - 2;
  return {
    x: rect.x + rect.width - INVENTORY_WATER_BAR_WIDTH - 2,
    y: rect.y + 3,
    width: INVENTORY_WATER_BAR_WIDTH,
    height: INVENTORY_WATER_BAR_HEIGHT,
    ratio,
    fillHeight: Math.round(innerHeight * ratio),
  };
}

export function createInventoryRuntime(scene, options = {}) {
  const {
    getGameplayState = () => null,
    getPlayerCharacter = () => scene.playerCharacter ?? null,
    isSuppressed = () => false,
    onWorldItemCollision = () => {},
    onPersistentMutation = () => {},
    playEffect = () => {},
    onInventoryGain = () => {},
    isSlotItemHidden = () => false,
    isHeldItemSuppressed = () => false,
    setThrowAimTarget = () => {},
    loadoutDragCoordinator = null,
    isCombatMode = () => false,
  } = options;

  const presentationContainer = scene.add.container(0, 0).setDepth(HUD_DEPTH + 4).setScrollFactor(0);
  const hudGraphics = scene.add.graphics().setScrollFactor(0);
  const slotLabelGraphics = INVENTORY_SLOT_AREAS.map(() => scene.add.graphics()
    .setDepth(HUD_DEPTH + 28)
    .setScrollFactor(0));
  const slotItemGraphics = INVENTORY_SLOT_AREAS.map(() => scene.add.graphics().setScrollFactor(0));
  const slotItemImages = INVENTORY_SLOT_AREAS.map(() => scene.add.image(0, 0, FARMING_TEXTURE_KEY, 0)
    .setOrigin(0).setScrollFactor(0).setVisible(false));
  const slotQuantityGraphics = INVENTORY_SLOT_AREAS.map(() => scene.add.graphics()
    .setDepth(INVENTORY_QUANTITY_DEPTH)
    .setScrollFactor(0));
  const dragGraphics = scene.add.graphics().setScrollFactor(0).setVisible(false);
  const dragImage = scene.add.image(0, 0, FARMING_TEXTURE_KEY, 0).setOrigin(0).setScrollFactor(0).setVisible(false);
  const heldGraphics = scene.add.graphics().setDepth(900).setVisible(false);
  const heldImage = scene.add.image(0, 0, FARMING_TEXTURE_KEY, 0).setOrigin(0).setDepth(900).setVisible(false);
  const waterBarGraphics = scene.add.graphics().setScrollFactor(0).setVisible(false);
  const slotZones = INVENTORY_SLOT_AREAS.map((rect, index) => createSlotZone(scene, rect, index));
  presentationContainer.add([
    hudGraphics,
    ...slotItemGraphics,
    ...slotItemImages,
    waterBarGraphics,
    ...slotZones,
    dragGraphics,
    dragImage,
  ]);
  const worldVisuals = new Map();
  const motions = new Map();

  let destroyed = false;
  let presentationVisible = true;
  let presentationInputEnabled = true;
  let selectedIndex = null;
  let lastSelectedIndex = null;
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

  function panelVisible() {
    return !destroyed && !isSuppressed() && presentationVisible;
  }

  function active() {
    return panelVisible() && presentationInputEnabled;
  }

  function loadoutDragActive() {
    return panelVisible() && Boolean(loadoutDragCoordinator?.isEnabled?.());
  }

  function pointerActive() {
    return active() || loadoutDragActive();
  }

  function worldPresentationActive() {
    return !destroyed && !isSuppressed() && !isCombatMode();
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
      if (!pointerActive()) return;
      const current = inventory()?.slots?.[index] ?? null;
      if (loadoutDragActive()) {
        if (current) loadoutDragCoordinator.begin("peaceful", index, pointer, event);
        return;
      }
      if (!current) {
        setSelection(null);
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
      setThrowAimTarget(worldPointFromPointer(scene, pointer));
    }
  }

  function handlePointerUp(pointer) {
    if (!dragCandidate) return;
    const fromIndex = dragCandidate.index;
    const wasDragging = dragging;
    dragCandidate = null;
    dragging = false;
    dragGraphics.clear().setVisible(false);
    dragImage.setVisible(false);
    setThrowAimTarget(null);
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
        if (selectedIndex !== null) lastSelectedIndex = selectedIndex;
        onPersistentMutation(result);
      }
      render();
      return;
    }
    if (!isPointInRect(pointer.x, pointer.y, INVENTORY_HUD_AREA)) {
      dropSlot(fromIndex, worldPointFromPointer(scene, pointer));
    }
  }

  function handlePointerCancel() {
    dragCandidate = null;
    dragging = false;
    dragGraphics.clear().setVisible(false);
    dragImage.setVisible(false);
    setThrowAimTarget(null);
  }

  function handleWheel(pointer, _gameObjects, _deltaX, deltaY) {
    const direction = inventoryCycleDirectionFromWheelEvent({
      deltaY,
      target: pointer?.event?.target,
    });
    if (direction === 0 || !active()) return;
    const next = inventoryCycleIndex(inventory()?.slots, selectedIndex ?? lastSelectedIndex, direction);
    if (next === null) return;
    pointer?.event?.preventDefault?.();
    pointer?.event?.stopPropagation?.();
    setSelection(next);
    lastSelectedIndex = next;
    selectedAtMs = scene.time.now;
    render();
  }

  function handleKeyDown(event) {
    const index = inventoryIndexFromKeyboardEvent(event);
    const direction = inventoryCycleDirectionFromKeyboardEvent(event);
    if ((index === null && direction === 0) || !active()) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    if (index !== null) {
      toggleSelection(index);
      return;
    }
    const next = inventoryCycleIndex(inventory()?.slots, selectedIndex ?? lastSelectedIndex, direction);
    if (next === null) return;
    setSelection(next);
    lastSelectedIndex = next;
    selectedAtMs = scene.time.now;
    render();
  }

  function toggleSelection(index) {
    const item = inventory()?.slots?.[index] ?? null;
    if (item) lastSelectedIndex = index;
    setSelection(item && selectedIndex !== index ? index : null);
    selectedAtMs = scene.time.now;
    render();
  }

  function setSelection(nextIndex) {
    const previous = selectedIndex;
    selectedIndex = nextIndex;
    if (previous === selectedIndex) return;
    if (previous === null) playEffect("inventory-activate");
    else if (selectedIndex === null) playEffect("inventory-deactivate");
    else playEffect("inventory-change");
  }

  function dropSlot(slotIndex, pointerWorld = null) {
    return dropLoadoutSlot(LOADOUT_PANELS.PEACEFUL, slotIndex, pointerWorld);
  }

  function dropLoadoutSlot(panel, slotIndex, pointerWorld = null) {
    const collection = panel === LOADOUT_PANELS.COMBAT ? gameplay()?.combatLoadout : inventory();
    const character = getPlayerCharacter?.();
    const sprite = character?.sprite;
    if (!collection || !sprite) return { status: "unavailable", mutated: false };
    const taken = takeInventorySlot(collection, slotIndex);
    if (!taken.mutated) return taken;
    const origin = throwOriginFromPlayer(sprite);
    const direction = throwDirectionTowardPoint(origin, pointerWorld, character.lastFacing);
    const target = {
      x: origin.x + direction.x * DROP_THROW_DISTANCE,
      y: origin.y + direction.y * DROP_THROW_DISTANCE,
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
      directionX: direction.x,
      directionY: direction.y,
      arcHeight: 0,
      bounces: 0,
    });
    if (panel === LOADOUT_PANELS.PEACEFUL && selectedIndex === slotIndex) setSelection(null);
    playEffect("drop");
    render();
    syncWorldVisuals();
    onPersistentMutation({ status: "dropped", mutated: true, panel, slotIndex, worldItem });
    return { status: "dropped", mutated: true, panel, worldItem };
  }

  function render() {
    if (destroyed) return;
    const visible = panelVisible();
    presentationContainer.setVisible(visible);
    hudGraphics.clear().setVisible(visible);
    slotZones.forEach((zone) => pointerActive() ? zone.setInteractive({ useHandCursor: true }) : zone.disableInteractive());
    slotLabelGraphics.forEach((graphics) => graphics.clear());
    slotItemGraphics.forEach((graphics) => graphics.clear().setVisible(visible));
    slotItemImages.forEach((image) => image.setVisible(false));
    slotQuantityGraphics.forEach((graphics) => graphics.clear().setVisible(visible));
    waterBarGraphics.clear().setVisible(false);
    if (!visible) {
      dragGraphics.clear().setVisible(false);
      dragImage.setVisible(false);
      heldGraphics.clear().setVisible(false);
      heldImage.setVisible(false);
      syncScreenLabels();
      return;
    }
    const slots = inventory()?.slots ?? [];
    INVENTORY_SLOT_AREAS.forEach((rect, index) => {
      const selected = selectedIndex === index;
      hudGraphics.fillStyle(HUD_COLORS.panel, 0.9).fillRect(rect.x, rect.y, rect.width, rect.height);
      hudGraphics.lineStyle(selected ? 2 : 1, selected ? 0xf0c45c : HUD_COLORS.border, selected ? 1 : 0.9);
      hudGraphics.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
      drawBitmapTextInto(slotLabelGraphics[index], 0, 0, index === 9 ? "0" : String(index + 1), {
        color: selected ? 0xf0c45c : HUD_COLORS.light,
        shadow: 0,
      });
      const item = slots[index];
      if (!item) return;
      if (shouldRenderInventoryQuantity(item)) {
        const text = String(item.quantity);
        drawBitmapTextInto(
          slotQuantityGraphics[index],
          0,
          0,
          text,
          { shadow: 0 },
        );
      }
      if (item.id === "water-bucket") renderWaterBar(rect);
      if (isSlotItemHidden(index, item.id)) return;
      const graphics = slotItemGraphics[index];
      const image = slotItemImages[index];
      renderItem(graphics, image, item.id, gameplay(), rect.x + 3, rect.y + 3);
      const alpha = dragCandidate?.index === index && dragging ? 0.25 : 1;
      graphics.setScale(1).setAlpha(alpha);
      image.setAlpha(alpha);
    });
    syncScreenLabels();
  }

  function renderDrag(x, y) {
    const item = inventory()?.slots?.[dragCandidate?.index] ?? null;
    dragGraphics.clear();
    dragImage.setVisible(false);
    if (!item) return dragGraphics.setVisible(false);
    renderItem(dragGraphics, dragImage, item.id, gameplay(), Math.round(x - 8), Math.round(y - 8));
    dragGraphics.setAlpha(0.9);
    dragImage.setAlpha(0.9);
  }

  function update(time, deltaMs) {
    if (destroyed) return;
    syncScreenLabels();
    updateMotions(Math.max(0, Number(deltaMs) || 0));
    syncWorldVisuals();
    collectNearbyWorldItems();
    updateHeldItem(Number(time) || scene.time.now);
  }

  function syncScreenLabels() {
    const visible = panelVisible() && presentationContainer.visible && presentationContainer.alpha > 0.001;
    const scaleX = presentationContainer.scaleX || 1;
    const scaleY = presentationContainer.scaleY || 1;
    const alpha = presentationContainer.alpha;
    const slots = inventory()?.slots ?? [];
    INVENTORY_SLOT_AREAS.forEach((rect, index) => {
      const labelPosition = inventorySlotLabelScreenPosition(rect, presentationContainer);
      slotLabelGraphics[index]
        .setPosition(labelPosition.x, labelPosition.y)
        .setAlpha(alpha)
        .setVisible(visible);
      const text = shouldRenderInventoryQuantity(slots[index]) ? String(slots[index].quantity) : "";
      slotQuantityGraphics[index]
        .setPosition(
          Math.round(presentationContainer.x + (rect.x + rect.width - 2) * scaleX - measureBitmapText(text)),
          Math.round(presentationContainer.y + (rect.y + 13) * scaleY),
        )
        .setAlpha(alpha)
        .setVisible(visible && text.length > 0);
    });
  }

  function updateHeldItem(nowMs) {
    heldGraphics.clear().setVisible(false);
    heldImage.setVisible(false);
    if (isHeldItemSuppressed()) return;
    if (!worldPresentationActive() || selectedIndex === null) return;
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
    const x = Math.round(sprite.x - 8);
    const y = Math.round(sprite.y - 35);
    renderItem(heldGraphics, heldImage, item.id, gameplay(), x, y);
    const depth = worldDepthFromAnchorY(sprite.y, `held-${item.id}`, 700);
    heldGraphics.setDepth(depth).setAlpha(alpha);
    heldImage.setDepth(depth).setAlpha(alpha);
  }

  function syncWorldVisuals() {
    const existing = new Set();
    for (const worldItem of worldItems()) {
      existing.add(worldItem.id);
      let visual = worldVisuals.get(worldItem.id);
      if (!visual) {
        visual = createDroppedItemVisual(scene, worldItem.item.id, gameplay());
        worldVisuals.set(worldItem.id, visual);
      }
      const motion = motions.get(worldItem.id);
      const arcHeight = motion?.arcHeight ?? 0;
      visual
        .setPosition(Math.round(worldItem.x - 8), Math.round(worldItem.y - 8 - arcHeight))
        .setDepth(worldDepthFromAnchorY(worldItem.y, worldItem.id))
        .setVisible(true);
    }
    for (const [id, visual] of worldVisuals) {
      if (existing.has(id)) continue;
      visual.destroy();
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
        notifyWorldItemCollision(worldItem);
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
      notifyWorldItemCollision(worldItem);
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
      const result = routePickedInventoryItem({
        inventory: currentInventory,
        combatLoadout: gameplay()?.combatLoadout,
      }, worldItem.item, { combatMode: isCombatMode() });
      if (!result.mutated) continue;
      const index = worldItems().findIndex((item) => item.id === worldItem.id);
      if (index >= 0) worldItems().splice(index, 1);
      worldVisuals.get(worldItem.id)?.destroy();
      worldVisuals.delete(worldItem.id);
      playEffect("pickup");
      render();
      if (result.panel !== LOADOUT_PANELS.COMBAT) onInventoryGain(result);
      onPersistentMutation({ status: "picked-up", mutated: true, worldItem, inventory: result });
    }
  }

  function notifyWorldItemCollision(worldItem) {
    if (worldItem.item?.id === "wood" || worldItem.item?.id === "stone") {
      onWorldItemCollision(worldItem, dropBox(worldItem.x, worldItem.y));
    }
  }

  function spawnWorldItems(itemId, quantity, origin) {
    const count = Math.max(0, Math.floor(Number(quantity) || 0));
    if (!count) return { status: "empty", mutated: false, worldItems: [] };
    const spawned = [];
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / count);
      const id = createWorldItemId(worldItems());
      const worldItem = {
        id,
        item: { id: itemId, kind: "loot", quantity: 1 },
        x: Number(origin.x),
        y: Number(origin.y),
      };
      worldItems().push(worldItem);
      motions.set(id, {
        phase: "arc",
        elapsedMs: 0,
        settleElapsedMs: 0,
        startX: worldItem.x,
        startY: worldItem.y,
        targetX: worldItem.x + Math.cos(angle) * DROP_THROW_DISTANCE,
        targetY: worldItem.y + Math.sin(angle) * DROP_THROW_DISTANCE,
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        arcHeight: 0,
        bounces: 0,
      });
      spawned.push(worldItem);
    }
    syncWorldVisuals();
    onPersistentMutation({ status: "world-items-spawned", mutated: true, worldItems: spawned });
    return { status: "spawned", mutated: true, worldItems: spawned };
  }

  function renderWaterBar(rect) {
    const can = gameplay()?.farm?.waterBucket;
    if (!can) return;
    const bar = inventoryWaterBarState(rect, can.currentWater, can.capacity);
    waterBarGraphics.setVisible(true)
      .fillStyle(HUD_COLORS.shadow, 0.96).fillRect(bar.x, bar.y, bar.width, bar.height)
      .lineStyle(1, HUD_COLORS.border, 1).strokeRect(bar.x + 0.5, bar.y + 0.5, bar.width - 1, bar.height - 1);
    if (bar.fillHeight > 0) {
      waterBarGraphics.fillStyle(0x55b6d3, 1)
        .fillRect(bar.x + 1, bar.y + bar.height - 1 - bar.fillHeight, bar.width - 2, bar.fillHeight);
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
  scene.input.on("wheel", handleWheel);
  scene.input.keyboard?.on?.("keydown", handleKeyDown);
  scene.events.on("update", update);

  const presentation = {
    getTransformTarget: () => presentationContainer,
    addObjects(...objects) {
      presentationContainer.add(objects.flat().filter(Boolean));
    },
    setVisible(value) {
      presentationVisible = Boolean(value);
      if (!presentationVisible) handlePointerCancel();
      presentationContainer.setVisible(panelVisible());
      syncScreenLabels();
    },
    setInputEnabled(value) {
      presentationInputEnabled = Boolean(value);
      if (!presentationInputEnabled) handlePointerCancel();
      slotZones.forEach((zone) => pointerActive() ? zone.setInteractive({ useHandCursor: true }) : zone.disableInteractive());
    },
    isInputEnabled: () => presentationInputEnabled,
    syncScreenLabels,
    getState: () => ({
      x: presentationContainer.x,
      y: presentationContainer.y,
      scale: presentationContainer.scaleX,
      alpha: presentationContainer.alpha,
      visible: panelVisible(),
      inputEnabled: presentationInputEnabled,
      labelScreenScale: 1,
    }),
  };

  function handleLoadoutChange(result) {
    if (selectedIndex !== null && (
      (result?.from?.panel === "peaceful" && result.from.index === selectedIndex)
      || (result?.to?.panel === "peaceful" && result.to.index === selectedIndex)
    )) {
      setSelection(null);
    }
    render();
  }

  const unregisterLoadoutPanel = loadoutDragCoordinator?.registerPanel?.("peaceful", {
    presentation,
    slotAreas: INVENTORY_SLOT_AREAS,
    onChange: handleLoadoutChange,
  });

  render();
  syncWorldVisuals();

  return {
    render,
    update,
    dropSlot,
    dropLoadoutSlot,
    presentation,
    selectSlot(index) {
      const next = Number(index);
      if (!Number.isInteger(next) || next < 0 || next >= INVENTORY_SLOT_COUNT) return false;
      setSelection(inventory()?.slots?.[next] ? next : null);
      if (selectedIndex !== null) lastSelectedIndex = selectedIndex;
      selectedAtMs = scene.time.now;
      render();
      return selectedIndex === next;
    },
    getSelectedIndex: () => selectedIndex,
    clearSelection() {
      if (selectedIndex === null) return false;
      setSelection(null);
      render();
      return true;
    },
    getSelectedItem: () => cloneInventoryItem(
      isCombatMode() || selectedIndex === null ? null : inventory()?.slots?.[selectedIndex],
    ),
    spawnWorldItems,
    getState: () => ({
      selectedIndex,
      lastSelectedIndex,
      dragging,
      slots: (inventory()?.slots ?? []).map((item) => cloneInventoryItem(item)),
      hiddenSlots: (inventory()?.slots ?? []).flatMap((item, index) => (
        item && isSlotItemHidden(index, item.id) ? [index] : []
      )),
      quantityLabels: (inventory()?.slots ?? []).flatMap((item, slotIndex) => (
        shouldRenderInventoryQuantity(item) ? [{ slotIndex, text: String(item.quantity), depth: INVENTORY_QUANTITY_DEPTH, screenScale: 1 }] : []
      )),
      waterBars: (inventory()?.slots ?? []).flatMap((item, slotIndex) => (
        item?.id === "water-bucket"
          ? [{ slotIndex, ...inventoryWaterBarState(
            INVENTORY_SLOT_AREAS[slotIndex],
            gameplay()?.farm?.waterBucket?.currentWater,
            gameplay()?.farm?.waterBucket?.capacity,
          ) }]
          : []
      )),
      presentation: presentation.getState(),
      worldItems: worldItems().map((item) => ({ ...item, item: cloneInventoryItem(item.item) })),
    }),
    isPointInHud(x, y) {
      if (!pointerActive()) return false;
      const scaleX = presentationContainer.scaleX || 1;
      const scaleY = presentationContainer.scaleY || 1;
      return isPointInRect(
        (x - presentationContainer.x) / scaleX,
        (y - presentationContainer.y) / scaleY,
        INVENTORY_HUD_AREA,
      );
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      setThrowAimTarget(null);
      scene.input.off("pointermove", handlePointerMove);
      scene.input.off("pointerup", handlePointerUp);
      scene.input.off("pointercancel", handlePointerCancel);
      scene.input.off("wheel", handleWheel);
      scene.input.keyboard?.off?.("keydown", handleKeyDown);
      scene.events.off("update", update);
      unregisterLoadoutPanel?.();
      for (const visual of worldVisuals.values()) visual.destroy();
      worldVisuals.clear();
      motions.clear();
      presentationContainer.destroy(true);
      slotLabelGraphics.forEach((graphics) => graphics.destroy());
      slotQuantityGraphics.forEach((graphics) => graphics.destroy());
      heldGraphics.destroy();
      heldImage.destroy();
    },
  };
}

function createDroppedItemVisual(scene, itemId, gameplay) {
  const asset = inventoryItemAsset(itemId, gameplay);
  const outline = [
    [0, -1], [-1, 0], [1, 0], [0, 1],
  ].map(([x, y]) => {
    const visual = asset === null
      ? scene.add.graphics()
      : scene.add.image(x, y, asset.textureKey, asset.frame).setOrigin(0);
    if (asset === null) drawInventoryItem(visual, itemId, { colorOverride: 0xffffff });
    else visual.setTint(0xffffff).setTintMode(TINT_MODE_FILL);
    return visual.setPosition(x, y).setAlpha(0.28);
  });
  const item = asset === null
    ? scene.add.graphics()
    : scene.add.image(0, 0, asset.textureKey, asset.frame).setOrigin(0);
  if (asset === null) drawInventoryItem(item, itemId);
  return scene.add.container(0, 0, [...outline, item]);
}

function renderItem(graphics, image, itemId, gameplay, x, y) {
  renderInventoryItem(graphics, image, itemId, gameplay, x, y);
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
