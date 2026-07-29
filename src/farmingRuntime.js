import {
  FARMING_FRAMES,
  FARMING_INTERACTION_KINDS,
  FARMING_TEXTURE_KEY,
} from "./farmingConfig.js";
import {
  advanceFarmTime,
  axeFarmCell,
  cropFrame,
  destroyCropsByCollider,
  farmCellKey,
  findSoilCell,
  harvestPotato,
  plantPotato,
  refillWateringCan,
  soilFrame,
  tillSoil,
  waterSoil,
} from "./farmingDomain.js";
import { assetDepthFromPivot } from "./buildWorldGeometry.js";
import { TILE_SIZE } from "./worldConfig.js";

const CROP_DEPTH_ANCHOR = Object.freeze({ x: 8, y: 14 });

export function createFarmingRuntime(scene, {
  sessionState,
  worldLayout,
  getSelectedItem = () => null,
  spawnHarvestDrops = () => {},
  isModalActive = () => false,
  onPersistentMutation = () => {},
  playEffect = () => {},
  rng = Math.random,
} = {}) {
  const farm = sessionState.gameplay.farm;
  const soilVisuals = new Map();
  const cropVisuals = new Map();
  const highlight = scene.add.graphics().setVisible(false);
  let worldBuildCoordinator = null;
  let weatherSegments = [];
  let highlightMode = null;
  let hoeAimDirection = null;
  let farmAimAnchorCell = null;
  let destroyed = false;

  function targetCell() {
    const character = scene.playerCharacter;
    if (!character) return null;
    const desired = character.motor?.movement?.desiredDirection;
    const selectedId = getSelectedItem()?.id;
    const usingStableFarmAim = selectedId === "hoe" || selectedId === "axe" || selectedId === "watering-can";
    if (usingStableFarmAim) {
      hoeAimDirection = stableHoeAimDirection(hoeAimDirection, desired, facingVector(character.lastFacing));
      farmAimAnchorCell = stableGridAnchor(
        farmAimAnchorCell,
        characterBoundsCenter(character),
        TILE_SIZE,
        0.2,
      );
      return {
        x: farmAimAnchorCell.x + hoeAimDirection.x * TILE_SIZE,
        y: farmAimAnchorCell.y + hoeAimDirection.y * TILE_SIZE,
      };
    }
    farmAimAnchorCell = null;
    const direction = facingVector(character.lastFacing);
    const point = {
      x: character.motor.position.x + direction.x * 18,
      y: character.motor.position.y + direction.y * 18,
    };
    return {
      x: Math.floor(point.x / TILE_SIZE) * TILE_SIZE,
      y: Math.floor(point.y / TILE_SIZE) * TILE_SIZE,
    };
  }

  function isTillingValid(point) {
    if (!worldLayout.isFarmableTile(point)) return false;
    const box = { left: point.x, top: point.y, right: point.x + TILE_SIZE, bottom: point.y + TILE_SIZE };
    return worldLayout.getBlockingColliders(box).length === 0;
  }

  function interactionForCell(point) {
    const cell = findSoilCell(farm, point);
    const selected = getSelectedItem();
    if (cell?.crop?.mature && !cell.crop.rotten && selected?.id !== "axe" && !isModalActive()) {
      return definition("harvest", FARMING_INTERACTION_KINDS.harvest, point, "hud:interaction.harvestPotato", 32);
    }
    if (selected?.id === "axe" && cell) {
      return definition("axe", FARMING_INTERACTION_KINDS.axeCell, point, cell.crop ? "hud:interaction.destroyCrop" : "hud:interaction.destroySoil", 33);
    }
    if (selected?.id === "hoe") {
      if (cell?.crop?.rotten) return definition("clear-rotten", FARMING_INTERACTION_KINDS.clearRotten, point, "hud:interaction.clearRottenCrop", 30);
      if (!cell?.crop && (cell || isTillingValid(point))) {
        return definition("till", FARMING_INTERACTION_KINDS.till, point, "hud:interaction.tillSoil", 26);
      }
    }
    if (selected?.id === "potato-seed" && cell && !cell.crop) {
      return definition("plant", FARMING_INTERACTION_KINDS.plant, point, "hud:interaction.plantPotato", 27);
    }
    if (selected?.id === "watering-can" && cell) {
      return definition("water", FARMING_INTERACTION_KINDS.water, point, "hud:interaction.waterSoil", 28);
    }
    return null;
  }

  function definition(prefix, kind, point, prompt, priority) {
    return {
      id: `${prefix}-${farmCellKey(point)}`,
      entityId: `farm-cell-${farmCellKey(point)}`,
      kind,
      position: { x: point.x + TILE_SIZE / 2, y: point.y + TILE_SIZE / 2 },
      radius: 30,
      priority,
      requiresFacing: false,
      facingDotThreshold: -1,
      prompt,
      payload: { x: point.x, y: point.y },
    };
  }

  function render() {
    if (destroyed) return;
    const present = new Set();
    for (const cell of farm.soilCells) {
      const key = farmCellKey(cell);
      present.add(key);
      let soil = soilVisuals.get(key);
      if (!soil) {
        soil = scene.add.image(cell.x, cell.y, FARMING_TEXTURE_KEY, soilFrame(cell)).setOrigin(0).setDepth(10);
        soilVisuals.set(key, soil);
      }
      soil.setFrame(soilFrame(cell)).setPosition(cell.x, cell.y).setVisible(true);
      const frame = cropFrame(cell.crop);
      let crop = cropVisuals.get(key);
      if (frame === null) {
        crop?.destroy();
        cropVisuals.delete(key);
        continue;
      }
      if (!crop) {
        crop = scene.add.image(cell.x, cell.y, FARMING_TEXTURE_KEY, frame).setOrigin(0);
        cropVisuals.set(key, crop);
      }
      crop.setFrame(frame)
        .setPosition(cell.x, cell.y)
        .setDepth(assetDepthFromPivot(cell, CROP_DEPTH_ANCHOR, 500, `crop-${key}`))
        .setVisible(true);
    }
    for (const [key, visual] of soilVisuals) {
      if (present.has(key)) continue;
      visual.destroy();
      soilVisuals.delete(key);
    }
    for (const [key, visual] of cropVisuals) {
      if (present.has(key)) continue;
      visual.destroy();
      cropVisuals.delete(key);
    }
  }

  function handleInteraction(candidate) {
    const point = { x: Number(candidate.payload?.x), y: Number(candidate.payload?.y) };
    const hadCrop = Boolean(findSoilCell(farm, point)?.crop);
    let result;
    if (candidate.kind === FARMING_INTERACTION_KINDS.till || candidate.kind === FARMING_INTERACTION_KINDS.clearRotten) {
      result = tillSoil(farm, point, { valid: isTillingValid(point) });
    } else if (candidate.kind === FARMING_INTERACTION_KINDS.plant) {
      result = plantPotato(farm, point, sessionState.gameplay.inventory, sessionState.gameplay.worldTimeSeconds);
    } else if (candidate.kind === FARMING_INTERACTION_KINDS.water) {
      result = waterSoil(farm, point, sessionState.gameplay.worldTimeSeconds);
    } else if (candidate.kind === FARMING_INTERACTION_KINDS.harvest) {
      result = harvestPotato(farm, point, rng);
      if (result.mutated) {
        const origin = scene.playerCharacter?.motor?.position ?? { x: point.x + 8, y: point.y + 8 };
        spawnHarvestDrops("potato", result.quantity, origin);
      }
    } else if (candidate.kind === FARMING_INTERACTION_KINDS.axeCell) {
      result = axeFarmCell(farm, point);
    } else if (candidate.kind === FARMING_INTERACTION_KINDS.refill) {
      result = refillWateringCan(farm);
    } else {
      return { status: "ignored", mutated: false };
    }
    if (result.mutated) {
      if (candidate.kind === FARMING_INTERACTION_KINDS.till
        || candidate.kind === FARMING_INTERACTION_KINDS.clearRotten) playEffect("hoe-use");
      if (candidate.kind === FARMING_INTERACTION_KINDS.plant) playEffect("plant-seed");
      if (candidate.kind === FARMING_INTERACTION_KINDS.water) playEffect("water");
      if (candidate.kind === FARMING_INTERACTION_KINDS.refill) playEffect("well-refill");
      if (candidate.kind === FARMING_INTERACTION_KINDS.harvest) playEffect("harvest");
      if ((candidate.kind === FARMING_INTERACTION_KINDS.axeCell
        || candidate.kind === FARMING_INTERACTION_KINDS.clearRotten) && hadCrop) playEffect("plant-destroy");
      render();
      onPersistentMutation(result);
    }
    return {
      ...result,
      messageKey: messageKeyForStatus(result.status),
    };
  }

  function advanceTo(worldTimeSeconds) {
    const beforeFrames = new Map(farm.soilCells
      .filter((cell) => cell.crop)
      .map((cell) => [farmCellKey(cell), cropFrame(cell.crop)]));
    const result = advanceFarmTime(farm, worldTimeSeconds, { weatherSegments });
    if (result.mutated) {
      const stageChanged = farm.soilCells.some((cell) => cell.crop
        && beforeFrames.has(farmCellKey(cell))
        && beforeFrames.get(farmCellKey(cell)) !== cropFrame(cell.crop));
      if (stageChanged) playEffect("crop-stage");
      render();
    }
    return result;
  }

  function updateCandidate(candidate) {
    highlight.clear().setVisible(false);
    highlightMode = null;
    if (isModalActive()) return;
    const point = targetCell();
    if (!point) return;
    const cell = findSoilCell(farm, point);
    const selectedId = getSelectedItem()?.id;
    const harvesting = candidate?.kind === FARMING_INTERACTION_KINDS.harvest;
    if (!harvesting && !["axe", "hoe", "watering-can", "potato-seed"].includes(selectedId)) return;
    if (selectedId === "axe" && !cell) return;
    const valid = harvesting
      || selectedId === "hoe" && (cell?.crop?.rotten || !cell?.crop && (cell || isTillingValid(point)))
      || selectedId === "watering-can" && Boolean(cell)
      || selectedId === "potato-seed" && Boolean(cell && !cell.crop)
      || selectedId === "axe" && Boolean(cell);
    const color = valid ? selectedId === "watering-can" ? 0x62c7e5 : selectedId === "potato-seed" ? 0x93d36e : selectedId === "axe" ? 0xe58b62 : 0xf6d766 : 0xd87867;
    const { x, y } = point;
    highlight.fillStyle(color, 0.12).fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    highlight.lineStyle(1, color, 0.9)
      .strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
      .setDepth(assetDepthFromPivot({ x, y }, CROP_DEPTH_ANCHOR, 500, "harvest-highlight") + 0.1)
      .setVisible(true);
    highlightMode = harvesting ? "harvest" : `${selectedId}-${valid ? "valid" : "invalid"}`;
  }

  render();

  return {
    attachWorldBuildCoordinator(coordinator) { worldBuildCoordinator = coordinator; },
    getInteractionDefinitions() {
      const point = targetCell();
      const cellInteraction = point ? interactionForCell(point) : null;
      return [
        ...(cellInteraction ? [cellInteraction] : []),
        ...(worldBuildCoordinator?.getInteractionDefinitions?.(getSelectedItem()) ?? []),
      ];
    },
    handleInteraction,
    handleDroppedItemCollision(worldItem, collider) {
      if (!["wood", "stone"].includes(worldItem?.item?.id)) return { status: "ignored", mutated: false };
      const result = destroyCropsByCollider(farm, collider);
      if (result.mutated) { playEffect("crop-impact"); render(); onPersistentMutation(result); }
      return result;
    },
    advanceTo,
    updateCandidate,
    render,
    hasFarmCell(point) { return Boolean(findSoilCell(farm, point)); },
    getState() {
      return {
        farm: JSON.parse(JSON.stringify(farm)),
        targetCell: targetCell(),
        selectedItem: getSelectedItem()?.id ?? null,
        hoeAimDirection: hoeAimDirection ? { ...hoeAimDirection } : null,
        farmAimAnchorCell: farmAimAnchorCell ? { ...farmAimAnchorCell } : null,
        highlightVisible: Boolean(highlight.visible),
        highlightMode,
      };
    },
    setWeatherSegments(segments) { weatherSegments = JSON.parse(JSON.stringify(segments ?? [])); },
    setRng(nextRng) { if (typeof nextRng === "function") rng = nextRng; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const visual of soilVisuals.values()) visual.destroy();
      for (const visual of cropVisuals.values()) visual.destroy();
      soilVisuals.clear();
      cropVisuals.clear();
      highlight.destroy();
    },
  };
}

function facingVector(facing) {
  if (facing === "up") return { x: 0, y: -1 };
  if (facing === "left" || facing === "up-left" || facing === "down-left") return { x: -1, y: 0 };
  if (facing === "right" || facing === "up-right" || facing === "down-right") return { x: 1, y: 0 };
  return { x: 0, y: 1 };
}

export function stableHoeAimDirection(previous, input, fallback = { x: 0, y: 1 }) {
  const x = Number(input?.x) || 0;
  const y = Number(input?.y) || 0;
  const absoluteX = Math.abs(x);
  const absoluteY = Math.abs(y);
  if (Math.hypot(x, y) < 0.1) return previous ? { ...previous } : cardinalVector(fallback);
  if (absoluteX > 0.05 && absoluteY > 0.05 && Math.abs(absoluteX - absoluteY) <= 0.2) {
    if (previous?.x) return { x: Math.sign(x), y: 0 };
    if (previous?.y) return { x: 0, y: Math.sign(y) };
  }
  return cardinalVector({ x, y });
}

export function stableGridAnchor(previous, point, tileSize = TILE_SIZE, threshold = 0.2) {
  if (!previous) {
    return {
      x: Math.floor(point.x / tileSize) * tileSize,
      y: Math.floor(point.y / tileSize) * tileSize,
    };
  }
  const anchor = { ...previous };
  const margin = tileSize * threshold;
  while (point.x >= anchor.x + tileSize + margin) anchor.x += tileSize;
  while (point.x < anchor.x - margin) anchor.x -= tileSize;
  while (point.y >= anchor.y + tileSize + margin) anchor.y += tileSize;
  while (point.y < anchor.y - margin) anchor.y -= tileSize;
  return anchor;
}

export function characterBoundsCenter(character) {
  const position = character?.motor?.position ?? { x: 0, y: 0 };
  const sprite = character?.sprite;
  const width = Number(sprite?.displayWidth);
  const height = Number(sprite?.displayHeight);
  const originX = Number(sprite?.originX);
  const originY = Number(sprite?.originY);
  if ([width, height, originX, originY].every(Number.isFinite)) {
    return {
      x: position.x + (0.5 - originX) * width,
      y: position.y + (0.5 - originY) * height,
    };
  }
  return {
    x: position.x,
    y: position.y - (Number(character?.footDepth) || 0) / 2,
  };
}

function cardinalVector(vector) {
  if (Math.abs(vector?.x ?? 0) >= Math.abs(vector?.y ?? 0)) return { x: Math.sign(vector?.x) || 1, y: 0 };
  return { x: 0, y: Math.sign(vector?.y) || 1 };
}

function messageKeyForStatus(status) {
  const keys = {
    "watering-can-empty": "hud:interaction.wateringCanEmpty",
    "watering-can-full": "hud:interaction.wateringCanFull",
    "watering-can-refilled": "hud:interaction.wateringCanRefilled",
    "no-potato-seed": "hud:interaction.noPotatoSeed",
    "invalid-soil": "hud:interaction.invalidSoil",
  };
  return keys[status] ?? null;
}
