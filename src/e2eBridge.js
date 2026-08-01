import { createMovementState } from "./characterMovement.js";
import { dayNightMultiplyColor, formatClock } from "./gameClock.js";
import { BED_WAKE_TILE } from "./debrisConfig.js";
import { FACILITIES } from "./facilityConfig.js";
import { TAVERN_SIGN } from "./guestConfig.js";
import { DEFAULT_RESOURCE_ID, RESOURCE_OBJECTS } from "./resourceConfig.js";
import { addInventoryItem, createInventoryItem, routePickedInventoryItem } from "./inventoryDomain.js";
import { DEFAULT_SERVING_TABLE_ID } from "./cookingDomain.js";

export function installWorldE2EBridge(scene) {
  if (!import.meta.env.VITE_E2E) return null;
  const bridge = {
    getSession: () => clone(scene.sessionState),
    getLanguage: () => scene.localization.getLanguage(),
    setLanguage: async (language) => {
      await scene.localization.changeLanguage(language);
      scene.gameHud?.render();
      scene.interactionRuntime?.refresh();
    },
    placePlayerNear: (entityId) => placePlayerNear(scene, entityId),
    placePlayerAt: ({ x, y, facing = { x: 0, y: -1 } }) => {
      const player = scene.characterSystem.require(scene.sessionState.playerId);
      player.motor.position = { x: Number(x), y: Number(y) };
      player.motor.movement = createMovementState({ facing });
      player.visual.setPresentationPose(null);
      scene.cameraRuntime?.reset(player.motor.position);
      scene.interactionRuntime?.refresh?.();
    },
    enterTransport: (transportId = null) => {
      const transition = scene.worldLayout?.transitions?.find(({ id }) => !transportId || id === transportId);
      if (!transition) throw new Error(`Unknown active transport: ${String(transportId)}`);
      const player = scene.characterSystem.require(scene.sessionState.playerId);
      player.motor.position = {
        x: (transition.triggerBounds.left + transition.triggerBounds.right) / 2,
        y: (transition.triggerBounds.top + transition.triggerBounds.bottom) / 2,
      };
      player.motor.movement = createMovementState({ facing: { x: 0, y: -1 } });
      return scene.worldLocationCoordinator?.update?.();
    },
    getLocationState: () => ({
      ...scene.worldLocationCoordinator?.getState?.(),
      layout: scene.worldLayout ? {
        locationId: scene.worldLayout.locationId,
        bounds: { ...scene.worldLayout.bounds },
        transitions: scene.worldLayout.transitions?.map((transition) => ({
          id: transition.id,
          destinationWorldId: transition.destinationWorldId,
          footprintBounds: { ...transition.footprintBounds },
          triggerBounds: { ...transition.triggerBounds },
          safeSpawn: { ...transition.safeSpawn, facing: { ...transition.safeSpawn.facing } },
        })) ?? [],
      } : null,
      home: {
        npcCount: (scene.characterSystem?.values?.() ?? []).filter(({ id }) => id !== scene.sessionState.playerId).length,
        facilityCount: scene.facilityRuntime?.getDefinitions?.().length ?? 0,
        tavernPresent: Boolean(scene.tavernSignRuntime),
        farmingPresent: Boolean(scene.farmingRuntime),
        buildModePresent: Boolean(scene.buildMode),
        bedPresent: Boolean(scene.debrisRuntime?.getBedDefinition?.()),
      },
    }),
    saveSession: () => scene.saveSession(),
    getInteractionState: () => ({
      candidate: scene.interactionRuntime?.getCurrentCandidate() ?? null,
      dialogueActive: scene.interactionRuntime?.isDialogueActive() ?? false,
      dialogue: { ...scene.sessionState.dialogue },
    }),
    getInteractionHudState: () => scene.interactionHud?.getPresentationState?.(),
    getMerchantState: () => scene.merchantRuntime?.getState?.() ?? null,
    getFarmingState: () => scene.farmingRuntime?.getState?.() ?? null,
    setFarmingWeather: (segments) => scene.farmingRuntime?.setWeatherSegments?.(segments),
    setFarmingRandomValue: (value) => scene.farmingRuntime?.setRng?.(() => Number(value)),
    setCoins: (value) => {
      scene.sessionState.gameplay.coins = Math.max(0, Math.floor(Number(value) || 0));
      scene.gameHud?.render?.();
    },
    selectInventorySlot: (index) => {
      const selected = scene.gameHud?.selectInventorySlot?.(index) ?? false;
      scene.interactionRuntime?.refresh?.();
      return selected;
    },
    addInventoryItem: ({ itemId, quantity = 1 }) => {
      const result = addInventoryItem(scene.sessionState.gameplay.inventory, createInventoryItem(itemId, quantity));
      scene.gameHud?.render?.();
      return result;
    },
    addCombatInventoryItem: ({ itemId, quantity = 1 }) => {
      const gameplay = scene.sessionState.gameplay;
      const result = routePickedInventoryItem(
        { inventory: gameplay.inventory, combatLoadout: gameplay.combatLoadout },
        createInventoryItem(itemId, quantity),
        { combatMode: true },
      );
      scene.gameHud?.render?.();
      return result;
    },
    dropInventorySlot: (index) => scene.gameHud?.dropInventorySlot?.(index),
    placeWell: (point) => {
      const result = scene.worldBuildCoordinator?.place?.({ placement: "well" }, point);
      scene.interactionRuntime?.refresh?.();
      if (result?.status === "placed") scene.saveSession();
      return result;
    },
    getBuildModeState: () => scene.buildMode?.getState?.() ?? null,
    toggleBuildMode: () => scene.buildMode?.toggle?.(),
    moveTavernSign: ({ x, y }) => {
      const state = scene.tavernSignRuntime?.getState?.();
      const target = state ? scene.tavernSignRuntime?.getBuildMoveTargetAt?.(state.position) : null;
      if (!target) return { status: "ignored" };
      scene.beginBuildAction?.();
      const result = scene.applyBuildMove?.(target, { x: Number(x), y: Number(y) });
      scene.endBuildAction?.();
      return result;
    },
    getHudState: () => ({
      newGameConfirming: scene.gameHud?.isConfirming?.() ?? false,
      resources: scene.gameHud?.getResourceState?.(),
      ...scene.gameHud?.getLayoutState?.(),
    }),
    getInventoryGainState: () => scene.gameHud?.getResourceState?.()?.inventoryGain ?? null,
    getTransientMessageState: () => scene.gameHud?.getTransientMessageState?.() ?? null,
    isHudPoint: ({ x, y }) => scene.isHudPoint(x, y),
    getAudioSettings: () => scene.audioSettings?.getSettings(),
    setAudioChannel: ({ channel, value }) => scene.audioSettings?.setChannel?.(channel, value),
    getAudioEffectState: () => ({
      lastEffectType: scene.audioRuntime?.lastEffectType ?? null,
      playCount: scene.audioRuntime?.effectPlayCount ?? 0,
    }),
    getMeleeState: () => scene.meleeRuntime?.getState?.() ?? null,
    interact: () => {
      scene.frameActions = Object.freeze({ interact: true, primary: false, secondary: false });
      scene.interactionRuntime?.update({ actions: scene.frameActions });
    },
    expireHitCooldown: () => { scene.lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY; },
    getDebrisState: () => ({
      present: scene.debrisRuntime?.isPresent?.() ?? false,
      definition: scene.worldLayout?.resourceDefinitions?.[0] ?? RESOURCE_OBJECTS.find((item) => item.id === DEFAULT_RESOURCE_ID),
      definitions: scene.worldLayout?.resourceDefinitions ?? [],
      plantedTrees: scene.movementDebugPanel?.authoringRuntime?.getPlantDefinitions?.() ?? [],
      bed: scene.debrisRuntime?.getBedDefinition?.() ?? null,
      beds: scene.debrisRuntime?.getBedDefinitions?.() ?? [],
      wakeTile: BED_WAKE_TILE,
    }),
    getFacilityState: () => ({
      definitions: scene.facilityRuntime?.getDefinitions?.() ?? FACILITIES,
      activeId: scene.facilityRuntime?.getActiveId?.() ?? null,
      visuals: scene.facilityRuntime?.getVisualStates?.() ?? {},
      servingTableVisuals: scene.facilityRuntime?.getServingTableVisualStates?.() ?? {},
    }),
    getCookingState: () => scene.cookingRuntime?.getState?.() ?? null,
    getTavernState: () => ({
      open: scene.sessionState.gameplay.tavernOpen,
      sign: scene.tavernSignRuntime?.getState?.(),
      guest: scene.tavernServiceRuntime?.guestRuntime?.getState?.(),
      service: scene.tavernServiceRuntime?.getState?.(),
    }),
    getCoinState: () => scene.coinRuntime?.getState?.() ?? [],
    addFacility: ({ facilityType, x, y } = {}) => {
      const facility = scene.facilityRuntime?.add?.(facilityType, { x: Number(x), y: Number(y) }) ?? null;
      scene.interactionRuntime?.refresh?.();
      return facility;
    },
    forceGuestSpawn: () => scene.tavernServiceRuntime?.guestRuntime?.forceSpawn?.(),
    setGuestRandomValue: (value) => scene.tavernServiceRuntime?.guestRuntime?.setRandomSource?.(() => Number(value)),
    setServingDish: (present) => {
      scene.sessionState.gameplay.kitchen.servingTables[DEFAULT_SERVING_TABLE_ID] = {
        itemId: present ? "fried-potato-dish" : null,
        quantity: present ? 1 : 0,
        reservations: [],
      };
      scene.facilityRuntime?.syncKitchenVisuals?.();
    },
    setServingStock: ({ itemId = null, quantity = 0, servingTableId = DEFAULT_SERVING_TABLE_ID } = {}) => {
      scene.sessionState.gameplay.kitchen.servingTables[servingTableId] = {
        itemId: quantity > 0 ? itemId : null,
        quantity: Math.max(0, Math.min(1, Math.floor(Number(quantity) || 0))),
        reservations: [],
      };
      scene.facilityRuntime?.syncKitchenVisuals?.();
      scene.interactionRuntime?.refresh?.();
    },
    setFarmWater: (value) => {
      scene.sessionState.gameplay.farm.waterBucket.currentWater = Math.max(0, Math.min(8, Math.floor(Number(value) || 0)));
      scene.gameHud?.render?.();
    },
    purchaseSeed: (itemId) => scene.merchantRuntime?.purchase?.(itemId),
    attemptCooking: () => scene.cookingRuntime?.attempt?.(),
    completeCooking: () => scene.cookingRuntime?.completeForTest?.(),
    alignCookingMarker: () => scene.cookingRuntime?.alignMarkerForTest?.(),
    missCookingMarker: () => scene.cookingRuntime?.missMarkerForTest?.(),
    newGame: () => scene.startNewGame(),
    getNeedsState: () => ({
      values: clone(scene.sessionState.gameplay.needs),
      flow: clone(scene.needsFlow ?? {}),
      activity: scene.getNeedsActivityContext(),
    }),
    setNeeds: (values) => {
      for (const [id, value] of Object.entries(values ?? {})) {
        if (!(id in scene.sessionState.gameplay.needs)) continue;
        scene.sessionState.gameplay.needs[id] = Math.min(100, Math.max(0, Number(value) || 0));
      }
      scene.gameHud?.render?.();
    },
    setEnergy: (value) => {
      scene.sessionState.gameplay.currentEnergy = Math.max(
        0,
        Math.min(scene.sessionState.gameplay.maximumEnergy, Number(value) || 0),
      );
      scene.syncPlayerEnergyTarget();
      scene.gameHud?.render();
    },
    setEnergyState: ({ current, maximum }) => {
      scene.sessionState.gameplay.maximumEnergy = Math.max(1, Number(maximum) || 1);
      scene.sessionState.gameplay.currentEnergy = Math.max(
        0,
        Math.min(scene.sessionState.gameplay.maximumEnergy, Number(current) || 0),
      );
      scene.syncPlayerEnergyTarget();
      scene.gameHud?.render();
    },
    setPlayerMotion: ({ moving = false, running = false } = {}) => {
      const player = scene.characterSystem.require(scene.sessionState.playerId);
      player.motor.movement = createMovementState({ facing: { x: 1, y: 0 } });
      player.motor.movement.velocity.x = moving ? player.motor.movementConfig.movingSpeedThreshold : 0;
      scene.e2eEnergyMotion = { moving: Boolean(moving), running: Boolean(running) };
      scene.isRunning = Boolean(running);
    },
    advanceGameplayTime: (milliseconds) => scene.updateGameplayTime(Math.max(0, Number(milliseconds) || 0)),
    getRuntimeState: () => ({
      sleeping: scene.sleeping,
      exhaustedSleeping: scene.exhaustedSleeping,
      cookingActive: scene.cookingRuntime?.isActive?.() ?? false,
      timeScale: scene.simulationScale,
      selectedTimeScale: scene.playerTimeScale,
    }),
    setWorldTimeSeconds: (value) => {
      const seconds = Math.max(0, Number(value) || 0);
      scene.sessionState.gameplay.worldTimeSeconds = seconds;
      scene.sessionState.gameplay.farm.lastProcessedWorldTimeSeconds = seconds;
      scene.updateDayNightLighting();
      scene.gameHud?.render();
    },
    getClockText: () => formatClock(scene.sessionState.gameplay.worldTimeSeconds, scene.localization.getLanguage()),
    getDayNightState: () => ({
      color: dayNightMultiplyColor(scene.sessionState.gameplay.worldTimeSeconds),
      worldTimeSeconds: scene.sessionState.gameplay.worldTimeSeconds,
    }),
    getResourceState: () => clone(scene.sessionState.gameplay),
    getResourceNodeState: (id) => clone(scene.sessionState.gameplay.resourceNodes[id]),
    getResourceVisualState: (id) => scene.debrisRuntime?.getVisualState?.(id) ?? null,
    getResourceCollider: (id) => scene.worldLayout?.getResourceCollider?.(id) ?? null,
    getCharacterSnapshot: (id) => scene.characterSystem.has(id) ? scene.characterSystem.getSnapshot(id) : null,
    getPlayerMovementState: () => ({
      targetMultiplier: scene.playerCharacter?.motor?.targetSpeedMultiplier,
      effectiveMultiplier: scene.playerCharacter?.motor?.effectiveSpeedMultiplier,
      runSpeedMultiplier: scene.playerCharacter?.motor?.runSpeedMultiplier,
    }),
    getPlayerVisualState: () => {
      const sprite = scene.playerCharacter?.sprite;
      return sprite ? { x: sprite.x, y: sprite.y, angle: sprite.angle, textureKey: sprite.texture?.key } : null;
    },
    getCameraState: () => scene.cameraRuntime?.getState?.() ?? null,
    getLowEnergyMarkerState: () => {
      const visual = scene.playerCharacter?.visual;
      const marker = visual?.lowEnergyMarker;
      return marker ? { x: marker.x, y: marker.y, playerX: visual.sprite.x, playerY: visual.sprite.y } : null;
    },
    setWakeRandomValue: (value) => { scene.e2eWakeRandom = () => Number(value); },
    wakeUp: () => scene.wakeUp(),
    tryWakeFromExhaustion: () => scene.tryWakeFromExhaustion(() => 0),
  };
  scene.e2eBridge = bridge;
  window.__NESTLED_BURROW_E2E__ = bridge;
  return bridge;
}

function placePlayerNear(scene, entityId) {
  const resource = scene.debrisRuntime?.getResourceDefinitions?.().find((item) => item.id === entityId);
  const facility = scene.facilityRuntime?.getDefinition?.(entityId);
  const bed = scene.debrisRuntime?.getBedDefinition?.(entityId);
  const well = scene.worldBuildCoordinator?.getWellState?.().find((item) => item.id === entityId);
  const sign = entityId === TAVERN_SIGN.id ? { position: scene.tavernSignRuntime?.getState?.().interactionPosition } : null;
  const target = resource
    ? { position: resource.position }
    : bed ? { position: bed.position }
      : facility ? { position: facility.position }
        : well ? { position: { x: well.x + 8, y: well.y + 8 } }
        : sign ?? scene.characterSystem.getSnapshot(entityId);
  if (!target?.position) throw new Error(`Unknown E2E placement target: ${entityId}`);
  const player = scene.characterSystem.require(scene.sessionState.playerId);
  const directions = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  ];
  let placed = false;
  for (const distance of [12, 20, 28, 34]) {
    for (const direction of directions) {
      player.motor.position = {
        x: target.position.x + direction.x * distance,
        y: target.position.y + direction.y * distance,
      };
      player.motor.movement = createMovementState({ facing: { x: -direction.x, y: -direction.y } });
      scene.interactionRuntime?.update?.({ actions: { interact: false, primary: false, secondary: false } });
      if (scene.interactionRuntime?.getCurrentCandidate?.()?.entityId === entityId) {
        placed = true;
        break;
      }
    }
    if (placed) break;
  }
  player.visual.setPresentationPose(null);
  scene.cameraRuntime?.reset(player.motor.position);
  scene.interactionRuntime?.refresh?.();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
