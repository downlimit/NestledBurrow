import { createMovementState } from "../character/characterMovement.js";
import { dayNightMultiplyColor, formatClock } from "../session/gameClock.js";
import { BED_WAKE_TILE } from "../resources/debrisConfig.js";
import { FACILITIES } from "../facilities/facilityConfig.js";
import { TAVERN_SIGN } from "../tavern/guestConfig.js";
import { DEFAULT_RESOURCE_ID, RESOURCE_OBJECTS } from "../resources/resourceConfig.js";
import { addInventoryItem, createInventoryItem, routePickedInventoryItem } from "../inventory/inventoryDomain.js";
import { DEFAULT_SERVING_TABLE_ID } from "../tavern/cookingDomain.js";
import { collides } from "../character/movement.js";
import { needMeterValues } from "../needs/needsFlowRuntime.js";
import { evaluatePopulationPerson } from "../character/populationDomain.js";

export function installWorldE2EBridge(scene) {
  if (!import.meta.env.VITE_E2E) return null;
  const getLocationOwners = () => scene.worldLocationRuntime?.getOwners?.() ?? {};
  let forcedFacilityId = null;
  const getForcedFacility = () => forcedFacilityDefinition(scene, forcedFacilityId);
  const bridge = {
    getSession: () => clone(scene.sessionState),
    getLanguage: () => scene.localization.getLanguage(),
    setLanguage: async (language) => {
      await scene.localization.changeLanguage(language);
      scene.gameHud?.render();
      scene.interactionRuntime?.refresh();
    },
    placePlayerNear: (entityId) => {
      const facility = getLocationOwners().facilityRuntime?.getDefinition?.(entityId) ?? null;
      forcedFacilityId = facility ? entityId : null;
      const placed = placePlayerNear(scene, entityId);
      return placed || Boolean(facility);
    },
    placePlayerAt: ({ x, y, facing = { x: 0, y: -1 } }) => {
      forcedFacilityId = null;
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
        facilityCount: getLocationOwners().facilityRuntime?.getDefinitions?.().length ?? 0,
        tavernPresent: Boolean(getLocationOwners().tavernSignRuntime),
        farmingPresent: Boolean(getLocationOwners().farmingRuntime),
        buildModePresent: Boolean(getLocationOwners().buildModeRuntime),
        bedPresent: Boolean(getLocationOwners().debrisRuntime?.getBedDefinition?.()),
      },
    }),
    getWildAtollState: () => clone(scene.wildAtollRuntime?.getState?.() ?? null),
    saveSession: () => scene.saveSession(),
    getInteractionState: () => ({
      candidate: getForcedFacility()
        ? interactionCandidate(getForcedFacility())
        : scene.interactionRuntime?.getCurrentCandidate() ?? null,
      dialogueActive: scene.interactionRuntime?.isDialogueActive() ?? false,
      dialogue: { ...scene.sessionState.dialogue },
    }),
    getInteractionHudState: () => scene.interactionHud?.getPresentationState?.(),
    getMerchantState: () => getLocationOwners().merchantRuntime?.getState?.() ?? null,
    getFarmingState: () => getLocationOwners().farmingRuntime?.getState?.() ?? null,
    setFarmingWeather: (segments) => getLocationOwners().farmingRuntime?.setWeatherSegments?.(segments),
    setFarmingRandomValue: (value) => getLocationOwners().farmingRuntime?.setRng?.(() => Number(value)),
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
    placeWell: (point) => getLocationOwners().worldBuildCoordinator?.place?.({ placement: "well" }, point),
    getBuildModeState: () => getLocationOwners().buildModeRuntime?.getState?.() ?? null,
    toggleBuildMode: () => getLocationOwners().buildModeRuntime?.toggle?.(),
    setBuildPanelView: (view) => getLocationOwners().buildModeRuntime?.setView?.(view) ?? false,
    grantSimulationTestItem: ({ itemId, quantity = 1 } = {}) => clone(
      getLocationOwners().buildModeRuntime?.grantTestItem?.(itemId, quantity) ?? null,
    ),
    grantSimulationTestCoins: (amount = 100) => clone(
      getLocationOwners().buildModeRuntime?.grantTestCoins?.(amount) ?? null,
    ),
    moveTavernSign: ({ x, y }) => {
      const owners = getLocationOwners();
      const state = owners.tavernSignRuntime?.getState?.();
      const target = state ? owners.worldBuildCoordinator?.getMoveTargetAt?.(state.position) : null;
      if (!target) return { status: "ignored" };
      owners.worldBuildCoordinator?.beginBuildAction?.();
      const result = owners.worldBuildCoordinator?.applyBuildMove?.(target, { x: Number(x), y: Number(y) });
      owners.worldBuildCoordinator?.endBuildAction?.();
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
    getMeleeState: () => getLocationOwners().meleeRuntime?.getState?.() ?? null,
    interact: () => {
      const forced = getForcedFacility();
      if (forced) {
        const facility = getLocationOwners().facilityRuntime?.getDefinition?.(forcedFacilityId);
        const result = scene.worldInteractionCoordinator?.handle?.(interactionCandidate(forced));
        if (!["shower", "toilet", "sink", "table"].includes(facility?.facilityType)) forcedFacilityId = null;
        scene.interactionRuntime?.refresh?.();
        return result;
      }
      scene.frameActions = Object.freeze({ interact: true, primary: false, secondary: false });
      scene.interactionRuntime?.update({ actions: scene.frameActions });
      return null;
    },
    completeInteractionApproach: () => {
      const needsInteractionCoordinator = getLocationOwners().needsInteractionCoordinator;
      const point = needsInteractionCoordinator?.getApproachPoint?.();
      if (!point) return false;
      const player = scene.characterSystem.require(scene.sessionState.playerId);
      player.motor.position = { ...point };
      player.motor.movement = createMovementState();
      needsInteractionCoordinator.update(0);
      return true;
    },
    expireHitCooldown: () => scene.worldInteractionCoordinator?.expireResourceCooldown?.(),
    getDebrisState: () => ({
      present: getLocationOwners().debrisRuntime?.isPresent?.() ?? false,
      definition: scene.worldLayout?.resourceDefinitions?.[0] ?? RESOURCE_OBJECTS.find((item) => item.id === DEFAULT_RESOURCE_ID),
      definitions: scene.worldLayout?.resourceDefinitions ?? [],
      plantedTrees: getLocationOwners().movementDebugPanel?.authoringRuntime?.getPlantDefinitions?.() ?? [],
      bed: getLocationOwners().debrisRuntime?.getBedDefinition?.() ?? null,
      beds: getLocationOwners().debrisRuntime?.getBedDefinitions?.() ?? [],
      wakeTile: BED_WAKE_TILE,
    }),
    getFacilityState: () => ({
      definitions: getLocationOwners().facilityRuntime?.getDefinitions?.() ?? FACILITIES,
      activeId: getLocationOwners().facilityRuntime?.getActiveId?.() ?? null,
      visuals: getLocationOwners().facilityRuntime?.getVisualStates?.() ?? {},
      servingTableVisuals: getLocationOwners().facilityRuntime?.getServingTableVisualStates?.() ?? {},
    }),
    getCookingState: () => getLocationOwners().cookingRuntime?.getState?.() ?? null,
    getTavernState: () => ({
      open: scene.sessionState.gameplay.tavernOpen,
      offer: clone(scene.sessionState.gameplay.venueOffer),
      menu: getLocationOwners().tavernServiceRuntime?.venueMenuRuntime?.getState?.() ?? null,
      sign: getLocationOwners().tavernSignRuntime?.getState?.(),
      guest: getLocationOwners().guestRuntime?.getState?.(),
      service: getLocationOwners().tavernServiceRuntime?.getState?.(),
    }),
    getCoinState: () => getLocationOwners().coinRuntime?.getState?.() ?? [],
    getVenueOffer: () => clone(scene.sessionState.gameplay.venueOffer),
    setVenueOfferItemActive: ({ itemId, active }) => getLocationOwners()
      .tavernServiceRuntime?.venueMenuRuntime?.setItemActive?.(itemId, active),
    toggleVenueOfferItem: (itemId) => getLocationOwners()
      .tavernServiceRuntime?.venueMenuRuntime?.toggleItem?.(itemId),
    getTavernOpen: () => Boolean(scene.sessionState.gameplay.tavernOpen),
    addFacility: ({ facilityType, x, y } = {}) => {
      const facility = getLocationOwners().facilityRuntime?.add?.(facilityType, { x: Number(x), y: Number(y) }) ?? null;
      scene.interactionRuntime?.refresh?.();
      return facility;
    },
    forceGuestSpawn: (personId) => getLocationOwners().tavernServiceRuntime?.forceGuestVisit?.(personId),
    forceGuestOrder: ({ personId = null, itemId = null } = {}) => getLocationOwners()
      .tavernServiceRuntime?.forceGuestOrder?.(personId, itemId),
    acceptGuestOrder: (guestId) => clone(getLocationOwners()
      .tavernServiceRuntime?.acceptGuestOrder?.(guestId) ?? null),
    setGuestOrderElapsedMs: ({ guestId, value } = {}) => getLocationOwners()
      .tavernServiceRuntime?.setGuestOrderElapsedMs?.(guestId, value) ?? false,
    getGuestOrder: (guestId = null) => {
      const guests = getLocationOwners().guestRuntime?.getState?.().guests ?? [];
      const guest = guestId ? guests.find((candidate) => candidate.id === guestId) : guests[0];
      return clone(guest ? {
        guestId: guest.id,
        personId: guest.personId,
        displayName: guest.displayName,
        servingTableId: guest.servingTableId,
        order: guest.order,
      } : null);
    },
    setGuestRandomValue: (value) => getLocationOwners()
      .tavernServiceRuntime?.setDemandRandomSource?.(() => Number(value)),
    getDemandProfilePerson: (personId) => {
      const person = scene.sessionState.gameplay.population.find((candidate) => candidate.id === personId);
      return person ? clone({
        personId: person.id,
        displayName: person.displayName,
        spendingCapacity: person.spendingCapacity,
        foodPreferences: person.foodPreferences,
      }) : null;
    },
    setVisitCandidatePersonId: (personId) => getLocationOwners()
      .tavernServiceRuntime?.setForcedCandidatePersonId?.(personId),
    setVisitDecisionRoll: (value) => getLocationOwners()
      .tavernServiceRuntime?.setDecisionRandomSource?.(() => Number(value)),
    forceVisitOpportunity: (options) => clone(getLocationOwners()
      .tavernServiceRuntime?.forceVisitOpportunity?.(options) ?? null),
    getLastVisitDecision: () => clone(getLocationOwners().tavernServiceRuntime?.getLastDecision?.() ?? null),
    getGuestPersonMapping: () => Object.fromEntries(
      (getLocationOwners().guestRuntime?.getState?.().guests ?? []).map(({ id, personId }) => [id, personId]),
    ),
    getVisitorHistory: () => clone(getLocationOwners().tavernServiceRuntime?.getVisitorHistory?.() ?? {}),
    setVisitOpportunityRemainingMs: (value) => {
      scene.sessionState.gameplay.tavernService.opportunityRemainingMs = Math.max(0, Number(value) || 0);
      return scene.sessionState.gameplay.tavernService.opportunityRemainingMs;
    },
    setPopulationPersonDemand: ({ personId, satiety, spendingCapacity, foodPreferences } = {}) => {
      const person = scene.sessionState.gameplay.population.find((candidate) => candidate.id === personId);
      if (!person) return false;
      if (Number.isFinite(Number(satiety))) person.needs.satiety = Math.min(100, Math.max(0, Number(satiety)));
      if (Number.isFinite(Number(spendingCapacity))) person.spendingCapacity = Number(spendingCapacity);
      if (foodPreferences && typeof foodPreferences === "object") person.foodPreferences = clone(foodPreferences);
      return true;
    },
    setServingDish: (present) => {
      scene.sessionState.gameplay.kitchen.servingTables[DEFAULT_SERVING_TABLE_ID] = {
        itemId: present ? "fried-potato-dish" : null,
        quantity: present ? 1 : 0,
        reservations: [],
      };
      getLocationOwners().facilityRuntime?.syncKitchenVisuals?.();
    },
    setServingStock: ({ itemId = null, quantity = 0, servingTableId = DEFAULT_SERVING_TABLE_ID } = {}) => {
      scene.sessionState.gameplay.kitchen.servingTables[servingTableId] = {
        itemId: quantity > 0 ? itemId : null,
        quantity: Math.max(0, Math.min(1, Math.floor(Number(quantity) || 0))),
        reservations: [],
      };
      getLocationOwners().facilityRuntime?.syncKitchenVisuals?.();
      scene.interactionRuntime?.refresh?.();
    },
    setFarmWater: (value) => {
      scene.sessionState.gameplay.farm.waterBucket.currentWater = Math.max(0, Math.min(8, Math.floor(Number(value) || 0)));
      scene.gameHud?.render?.();
    },
    purchaseSeed: (itemId) => getLocationOwners().merchantRuntime?.purchase?.(itemId),
    attemptCooking: () => getLocationOwners().cookingRuntime?.attempt?.(),
    completeCooking: () => getLocationOwners().cookingRuntime?.completeForTest?.(),
    alignCookingMarker: () => getLocationOwners().cookingRuntime?.alignMarkerForTest?.(),
    missCookingMarker: () => getLocationOwners().cookingRuntime?.missMarkerForTest?.(),
    newGame: () => scene.startNewGame(),
    getNeedsState: () => ({
      values: clone(scene.sessionState.gameplay.needs),
      flow: clone(scene.needsFlow ?? {}),
      activity: scene.getNeedsActivityContext(),
      runtime: clone(scene.needsRuntime?.getState?.() ?? {}),
    }),
    getPopulation: () => clone(scene.sessionState.gameplay.population),
    getPopulationPerson: (personId) => clone(
      scene.sessionState.gameplay.population.find((person) => person.id === personId) ?? null,
    ),
    getPersonInspectionState: () => clone(getLocationOwners().personInspectionRuntime?.getState?.() ?? null),
    inspectPopulationPerson: (personId) => getLocationOwners().personInspectionRuntime?.inspectPerson?.(personId) ?? false,
    forcePersonInspectionExpanded: (personId) => getLocationOwners().personInspectionRuntime?.forceExpanded?.(personId) ?? false,
    setInspectedPersonNeed: ({ needId, value } = {}) => clone(
      getLocationOwners().personInspectionRuntime?.setInspectedNeed?.(needId, value) ?? null,
    ),
    evaluatePopulationPerson: (personId) => clone(evaluatePopulationPerson(
      scene.sessionState.gameplay.population,
      personId,
      scene.sessionState.gameplay.worldTimeSeconds,
    )),
    setNeeds: (values) => {
      for (const [id, value] of Object.entries(values ?? {})) {
        if (!(id in scene.sessionState.gameplay.needs)) continue;
        scene.sessionState.gameplay.needs[id] = Math.min(100, Math.max(0, Number(value) || 0));
      }
      scene.needsFlowRuntime?.reset?.(needMeterValues(scene.sessionState.gameplay));
      scene.gameHud?.render?.();
    },
    setNeedsDebugPreset: (preset) => {
      const result = preset === "clear"
        ? scene.needsRuntime?.clearDebugPreset?.()
        : scene.needsRuntime?.setDebugPreset?.(preset);
      scene.needsFlowRuntime?.reset?.(needMeterValues(scene.sessionState.gameplay));
      scene.syncPlayerEnergyTarget();
      scene.gameHud?.render?.();
      return result;
    },
    performPhysicalAction: (toolId) => scene.needsRuntime?.recordPhysicalAction?.(toolId),
    setEnergy: (value) => {
      scene.sessionState.gameplay.currentEnergy = Math.max(
        0,
        Math.min(scene.sessionState.gameplay.maximumEnergy, Number(value) || 0),
      );
      scene.needsFlowRuntime?.reset?.(needMeterValues(scene.sessionState.gameplay));
      scene.syncPlayerEnergyTarget();
      scene.gameHud?.render();
    },
    setEnergyState: ({ current, maximum }) => {
      scene.sessionState.gameplay.maximumEnergy = Math.max(1, Number(maximum) || 1);
      scene.sessionState.gameplay.currentEnergy = Math.max(
        0,
        Math.min(scene.sessionState.gameplay.maximumEnergy, Number(current) || 0),
      );
      scene.needsFlowRuntime?.reset?.(needMeterValues(scene.sessionState.gameplay));
      scene.syncPlayerEnergyTarget();
      scene.gameHud?.render();
    },
    setPlayerMotion: ({ moving = false, running = false } = {}) => {
      const player = scene.characterSystem.require(scene.sessionState.playerId);
      player.motor.movement = createMovementState({ facing: { x: 1, y: 0 } });
      player.motor.movement.velocity.x = moving ? player.motor.movementConfig.movingSpeedThreshold : 0;
      const runningAllowed = scene.needsRuntime?.movementState?.().runningAllowed ?? true;
      scene.e2eEnergyMotion = { moving: Boolean(moving), running: Boolean(running && runningAllowed) };
      scene.isRunning = Boolean(running && runningAllowed);
      scene.syncPlayerEnergyTarget();
    },
    advanceGameplayTime: (milliseconds) => {
      const deltaMs = Math.max(0, Number(milliseconds) || 0);
      scene.worldLocationRuntime?.updateRealTime?.(deltaMs);
    },
    advanceWorldSimulation: (milliseconds) => {
      let remainingMs = Math.max(0, Number(milliseconds) || 0);
      while (remainingMs > 0) {
        const stepMs = Math.min(50, remainingMs);
        scene.worldLocationRuntime?.runWorldStep?.(
          stepMs,
          (deltaMs) => scene.characterSystem?.update?.(deltaMs),
        );
        remainingMs -= stepMs;
      }
      return true;
    },
    getRuntimeState: () => ({
      sleeping: scene.sleeping,
      exhaustedSleeping: scene.exhaustedSleeping,
      cookingActive: getLocationOwners().cookingRuntime?.isActive?.() ?? false,
      timeScale: scene.simulationScale,
      selectedTimeScale: scene.playerTimeScale,
      needsRuntime: clone(scene.needsRuntime?.getState?.() ?? {}),
      interactionTimeline: clone(getLocationOwners().needsInteractionCoordinator?.getState?.() ?? {}),
    }),
    getPuddleState: () => clone(scene.puddleRuntime?.getState?.() ?? []),
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
    getResourceVisualState: (id) => getLocationOwners().debrisRuntime?.getVisualState?.(id) ?? null,
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

function forcedFacilityDefinition(scene, entityId) {
  if (!entityId) return null;
  return scene.worldInteractionCoordinator?.getStaticInteractionDefinitions?.().find((definition) => (
    definition.kind === "use-facility"
      && (definition.id === entityId || definition.entityId === entityId)
  )) ?? null;
}

function interactionCandidate(definition) {
  return {
    targetId: definition.id,
    entityId: definition.entityId ?? definition.id,
    kind: definition.kind,
    prompt: definition.prompt,
    payload: { ...(definition.payload ?? {}) },
    distance: 0,
  };
}

function placePlayerNear(scene, entityId) {
  const owners = scene.worldLocationRuntime?.getOwners?.() ?? {};
  const resource = owners.debrisRuntime?.getResourceDefinitions?.().find((item) => item.id === entityId);
  const facility = owners.facilityRuntime?.getDefinition?.(entityId);
  const bed = owners.debrisRuntime?.getBedDefinition?.(entityId);
  const well = owners.worldBuildCoordinator?.getWellState?.().find((item) => item.id === entityId);
  const sign = entityId === TAVERN_SIGN.id ? { position: owners.tavernSignRuntime?.getState?.().interactionPosition } : null;
  const atollInstance = scene.wildAtollRuntime?.getAuthoringInstances?.().find((instance) => instance.id === entityId);
  const interactionDefinition = scene.worldInteractionCoordinator?.getStaticInteractionDefinitions?.().find((definition) => (
    definition.id === entityId || definition.entityId === entityId
  ));
  const target = atollInstance
    ? { position: atollInstance.anchor }
    : interactionDefinition
    ? { position: interactionDefinition.aimPosition ?? interactionDefinition.position }
    : resource ? { position: resource.position }
    : bed ? { position: bed.position }
      : facility ? { position: facility.position }
        : well ? { position: { x: well.x + 8, y: well.y + 8 } }
        : sign ?? (scene.characterSystem.has(entityId) ? scene.characterSystem.getSnapshot(entityId) : null);
  if (!target?.position) throw new Error(`Unknown E2E placement target: ${entityId}`);
  const collider = scene.worldLayout?.getResourceCollider?.(entityId)
    ?? scene.worldLayout?.getWorldObjectColliders?.().find((entry) => (
      entry.id === entityId || entry.id === interactionDefinition?.id || entry.id === interactionDefinition?.entityId
    ))?.rect
    ?? null;
  const attentionPosition = collider
    ? { x: (collider.left + collider.right) / 2, y: (collider.top + collider.bottom) / 2 }
    : target.position;
  const player = scene.characterSystem.require(scene.sessionState.playerId);
  const directions = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  ];
  let placed = false;
  for (const distance of [4, 8, 12, 20, 28, 34]) {
    for (const direction of directions) {
      player.motor.position = collider
        ? pointOutsideRect(collider, attentionPosition, direction, distance)
        : {
          x: attentionPosition.x + direction.x * distance,
          y: attentionPosition.y + direction.y * distance,
        };
      if (collides(player.motor.position, scene.worldLayout, player.motor.footWidth, player.motor.footDepth)) continue;
      player.motor.movement = createMovementState({ facing: {
        x: attentionPosition.x - player.motor.position.x,
        y: attentionPosition.y - player.motor.position.y,
      } });
      if (atollInstance) {
        placed = true;
        break;
      }
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
  if (!placed) scene.interactionRuntime?.refresh?.();
  return placed;
}

function pointOutsideRect(rect, center, direction, distance) {
  const xBoundary = direction.x === 0
    ? Number.POSITIVE_INFINITY
    : (direction.x > 0 ? rect.right - center.x : center.x - rect.left) / Math.abs(direction.x);
  const yBoundary = direction.y === 0
    ? Number.POSITIVE_INFINITY
    : (direction.y > 0 ? rect.bottom - center.y : center.y - rect.top) / Math.abs(direction.y);
  const boundaryDistance = Math.min(xBoundary, yBoundary);
  return {
    x: center.x + direction.x * (boundaryDistance + distance),
    y: center.y + direction.y * (boundaryDistance + distance),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
