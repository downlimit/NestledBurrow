export function mountWorldLocation(scene) {
  if (scene.worldLocationCoordinator.hasCapability("npcs")) {
    scene.mountVillageCharacters();
    scene.createMerchantRuntime();
  }
  scene.createDebrisRuntime();
  if (scene.worldLocationCoordinator.hasCapability("meleeWeapons")) scene.createMeleeRuntime();
  if (scene.worldLocationCoordinator.hasCapability("facilities")) {
    scene.createFacilityRuntime();
    scene.createTavernRuntime();
    scene.createFarmingRuntime();
    scene.createCookingRuntime();
  }
  if (scene.worldLocationCoordinator.hasCapability("buildMode")) {
    scene.createMovementDebugPanel();
    scene.createBuildCoordinator();
  }
  scene.worldInteractionCoordinator?.rebindLocationOwners?.({
    merchantRuntime: scene.merchantRuntime,
    farmingRuntime: scene.farmingRuntime,
    tavernSignRuntime: scene.tavernSignRuntime,
    facilityRuntime: scene.facilityRuntime,
    kitchenInteractionRuntime: scene.kitchenInteractionRuntime,
    needsInteractionCoordinator: scene.needsInteractionCoordinator,
    cookingRuntime: scene.cookingRuntime,
    debrisRuntime: scene.debrisRuntime,
  });
  scene.interactionRuntime?.resetCandidate?.();
  scene.syncGameplayHudVisibility();
}

export function renderWorldLocation(scene, { outdoorTextureKey, houseTextureKey, treesTextureKey, tileSize }) {
  scene.worldRenderSprites = [];
  scene.groundSprites = new Map();
  scene.worldLayout.groundTiles.forEach((tile) => {
    const sprite = scene.addTile(tile, outdoorTextureKey, 0);
    scene.groundSprites.set(worldCellKey({ x: tile.x * tileSize, y: tile.y * tileSize }), { sprite, tile });
  });
  scene.floorSprites = new Map();
  scene.worldLayout.houseFloorTiles.forEach((tile) => {
    const sprite = scene.addTile(tile, houseTextureKey, 20);
    scene.floorSprites.set(worldCellKey({ x: tile.x * tileSize, y: tile.y * tileSize }), { sprite, tile });
  });
  scene.wallSprites = new Map();
  scene.worldLayout.houseWallTiles.forEach((tile) => scene.wallSprites.set(tile.id, scene.createCanonicalWallEntry(tile)));
  scene.worldLayout.decorationTiles.forEach((tile) => scene.addTile(tile, treesTextureKey, tile.depth));
  scene.transportSprites = (scene.worldLayout.transportTiles ?? []).map((tile) => {
    const sprite = scene.add.image(tile.worldX, tile.worldY, tile.textureKey, tile.frame).setOrigin(0, 0).setDepth(tile.depth);
    if (tile.crop) sprite.setCrop(tile.crop.x, 0, tile.crop.width, tileSize);
    scene.worldRenderSprites.push(sprite);
    return sprite;
  });
}

export function destroyWorldLocation(scene) {
  scene.interactionRuntime?.resetCandidate?.();
  scene.worldInteractionCoordinator?.unbindLocationOwners?.();
  scene.movementDebugPanel?.destroy();
  scene.movementDebugPanel = null;
  scene.worldBuildCoordinator?.destroy?.();
  scene.worldBuildCoordinator = null;
  scene.buildMode = null;
  scene.meleeRuntime?.destroy();
  scene.meleeRuntime = null;
  scene.cookingRuntime?.destroy();
  scene.cookingRuntime = null;
  scene.kitchenInteractionRuntime = null;
  scene.farmingRuntime?.destroy();
  scene.farmingRuntime = null;
  scene.tavernServiceRuntime?.destroy();
  scene.tavernServiceRuntime = null;
  scene.guestRuntime = null;
  scene.coinRuntime = null;
  scene.facilityRuntime?.destroy();
  scene.facilityRuntime = null;
  scene.tavernSignRuntime?.destroy();
  scene.tavernSignRuntime = null;
  scene.debrisRuntime?.destroy();
  scene.debrisRuntime = null;
  scene.unregisterMerchantVisibility?.();
  scene.unregisterMerchantVisibility = null;
  scene.merchantRuntime?.destroy();
  scene.merchantRuntime = null;
  scene.destroyVillageCharacters();
  destroyRenderedWorld(scene);
}

export function canTransitionWorldLocation(scene) {
  return !Boolean(
    scene.sleeping
    || scene.optionsOpen
    || scene.gameHudConfirmationActive
    || scene.buildMode?.isActive?.()
    || scene.facilityRuntime?.isUsing?.()
    || scene.cookingRuntime?.isActive?.()
    || scene.interactionRuntime?.isDialogueActive?.()
    || scene.merchantRuntime?.isActive?.()
  );
}

function destroyRenderedWorld(scene) {
  for (const sprite of scene.worldRenderSprites ?? []) sprite?.destroy?.();
  scene.worldRenderSprites = [];
  scene.transportSprites = [];
  scene.groundSprites?.clear?.();
  scene.floorSprites?.clear?.();
  scene.wallSprites?.clear?.();
}

function worldCellKey(point) {
  return `${point.x},${point.y}`;
}
