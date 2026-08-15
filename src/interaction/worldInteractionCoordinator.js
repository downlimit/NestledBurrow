import { BED_INTERACTION_KIND } from "../resources/debrisConfig.js";
import { FACILITY_INTERACTION_KIND } from "../facilities/facilityConfig.js";
import { shouldShakeEnergyAfterInteraction } from "../ui/gameHud.js";
import { hitResourceDefinition } from "../session/gameSessionState.js";
import { TAVERN_SIGN_KIND } from "../tavern/guestConfig.js";
import { GUEST_ORDER_INTERACTION_KIND, GUEST_TALK_INTERACTION_KIND } from "../tavern/guestRuntime.js";
import { RESOURCE_INTERACTION_KIND } from "../resources/resourceConfig.js";
import { getResourceProfile, resourceActionForTool, resourceEffectType } from "../resources/resourceDomain.js";
import { WORLD_IDS, WORLD_TRANSITION_INTERACTION_KIND } from "../world/worldLocationConfig.js";

const IGNORED = Object.freeze({ status: "ignored", mutated: false });

export function isInteractionBlockedByInventoryMode({ inventoryBlocked = false, candidateKind = null } = {}) {
  return Boolean(inventoryBlocked) && candidateKind !== WORLD_TRANSITION_INTERACTION_KIND;
}

export function createWorldInteractionCoordinator({
  sessionState,
  getGameplayTuning,
  getSelectedItem = () => null,
  getNeedsRuntime = () => null,
  getSleepingWakeInteraction = () => null,
  getWorldTransitionDefinitions = () => [],
  activateWorldTransition = () => IGNORED,
  isSleeping = () => false,
  isExhaustedSleeping = () => false,
  getWakeRandom = () => Math.random,
  tryWakeFromExhaustion = () => IGNORED,
  suppressNextInteract = () => {},
  showTransientMessage = () => {},
  refreshInteractions = () => {},
  triggerCooldownFeedback = () => {},
  renderHud = () => {},
  notifyInventoryGain = () => {},
  syncPlayerEnergyTarget = () => {},
  triggerEnergyShake = () => {},
  playEffect = () => {},
  saveSession = () => {},
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  let destroyed = false;
  let locationOwners = emptyLocationOwners();
  let lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY;
  let lastWakeAttemptAtMs = Number.NEGATIVE_INFINITY;
  let activeResourceProfileId = null;

  function rebindLocationOwners(next = {}) {
    locationOwners = {
      merchantRuntime: next.merchantRuntime ?? null,
      farmingRuntime: next.farmingRuntime ?? null,
      tavernSignRuntime: next.tavernSignRuntime ?? null,
      venueMenuRuntime: next.venueMenuRuntime ?? null,
      tavernServiceRuntime: next.tavernServiceRuntime ?? null,
      facilityRuntime: next.facilityRuntime ?? null,
      kitchenInteractionRuntime: next.kitchenInteractionRuntime ?? null,
      needsInteractionCoordinator: next.needsInteractionCoordinator ?? null,
      cookingRuntime: next.cookingRuntime ?? null,
      debrisRuntime: next.debrisRuntime ?? null,
    };
  }

  function unbindLocationOwners() {
    locationOwners = emptyLocationOwners();
  }

  function getStaticInteractionDefinitions() {
    if (destroyed) return [];
    const sleeping = isSleeping();
    const exhausted = sleeping && isExhaustedSleeping();
    if (!exhausted) lastWakeAttemptAtMs = Number.NEGATIVE_INFINITY;
    const wake = sleeping && !exhausted ? getSleepingWakeInteraction() : null;
    const exhaustedWake = exhausted && sessionState.currentWorldId !== WORLD_IDS.atoll
      ? createExhaustedWakeInteraction(getSleepingWakeInteraction(), sessionState.currentWorldId)
      : null;
    return [
      ...getWorldTransitionDefinitions(),
      ...(locationOwners.debrisRuntime?.getInteractionDefinitions?.() ?? []),
      ...(locationOwners.facilityRuntime?.getInteractionDefinitions?.() ?? []),
      ...(locationOwners.tavernSignRuntime?.getInteractionDefinitions?.() ?? []),
      ...(locationOwners.tavernServiceRuntime?.getGuestInteractionDefinitions?.()
        ?? locationOwners.tavernServiceRuntime?.getOrderInteractionDefinitions?.() ?? []),
      ...(locationOwners.farmingRuntime?.getInteractionDefinitions?.() ?? []),
      ...(wake ? [wake] : []),
      ...(exhaustedWake ? [exhaustedWake] : []),
    ];
  }

  function isInteractionAllowed(definition) {
    if (destroyed || locationOwners.cookingRuntime?.isActive?.() || locationOwners.venueMenuRuntime?.isActive?.()) return false;
    if (!(locationOwners.needsInteractionCoordinator?.allowsInteraction?.(definition) ?? true)) return false;
    return !locationOwners.facilityRuntime?.isUsing?.()
      || definition.kind === FACILITY_INTERACTION_KIND
        && definition.id === locationOwners.facilityRuntime.getActiveId();
  }

  function handle(candidate) {
    if (destroyed) return IGNORED;
    let result = handleWorldTransition(candidate);
    if (isHandled(result)) return result;
    result = handleMerchant(candidate);
    if (isHandled(result)) return result;
    result = handleFarming(candidate);
    if (isHandled(result)) return result;
    result = handleTavernSign(candidate);
    if (isHandled(result)) return result;
    result = handleGuestInteraction(candidate);
    if (isHandled(result)) return result;
    result = handleFacility(candidate);
    if (isHandled(result)) return result;
    result = handleBed(candidate);
    if (isHandled(result)) return result;
    result = handleBusyGate();
    if (isHandled(result)) return result;
    result = handleExhaustedWake(candidate);
    if (isHandled(result)) return result;
    return handleResource(candidate);
  }

  function handleWorldTransition(candidate) {
    if (candidate.kind !== WORLD_TRANSITION_INTERACTION_KIND) return IGNORED;
    const result = activateWorldTransition(candidate) ?? IGNORED;
    if (isHandled(result)) suppressNextInteract();
    return result;
  }

  function handleMerchant(candidate) {
    const result = locationOwners.merchantRuntime?.handleInteraction?.(candidate) ?? IGNORED;
    if (isHandled(result)) suppressNextInteract();
    return result;
  }

  function handleFarming(candidate) {
    const result = locationOwners.farmingRuntime?.handleInteraction?.(candidate) ?? IGNORED;
    if (!isHandled(result)) return result;
    if (result.messageKey) {
      showTransientMessage(result.messageKey);
      suppressNextInteract();
      return { ...result, transientMessageShown: true };
    }
    suppressNextInteract();
    return result;
  }

  function handleTavernSign(candidate) {
    if (candidate.kind !== TAVERN_SIGN_KIND) return IGNORED;
    const result = locationOwners.venueMenuRuntime?.handleSignInteraction?.() ?? IGNORED;
    if (!isHandled(result)) return result;
    suppressNextInteract();
    return result;
  }

  function handleGuestInteraction(candidate) {
    if (![GUEST_ORDER_INTERACTION_KIND, GUEST_TALK_INTERACTION_KIND].includes(candidate.kind)) return IGNORED;
    const result = locationOwners.tavernServiceRuntime?.handleGuestInteraction?.(candidate)
      ?? (candidate.kind === GUEST_ORDER_INTERACTION_KIND
        ? locationOwners.tavernServiceRuntime?.acceptGuestOrder?.(candidate.payload.guestId)
        : IGNORED);
    if (!isHandled(result)) return result;
    suppressNextInteract();
    refreshInteractions();
    return result;
  }

  function handleFacility(candidate) {
    if (candidate.kind !== FACILITY_INTERACTION_KIND) return IGNORED;
    const facility = locationOwners.facilityRuntime?.getDefinition?.(candidate.payload.facilityId);
    if (["cutting-table", "gas-stove"].includes(facility?.facilityType)
      && !getNeedsRuntime()?.canStartLongAction?.()) {
      return { status: "urgent-toilet", mutated: false, messageKey: "hud:needs.urgentLongAction" };
    }
    const kitchenResult = locationOwners.kitchenInteractionRuntime?.handleFacility?.(facility) ?? IGNORED;
    if (isHandled(kitchenResult)) {
      suppressNextInteract();
      refreshInteractions();
      return kitchenResult;
    }
    const result = locationOwners.needsInteractionCoordinator?.useFacility?.(
      candidate.payload.facilityId,
      candidate.payload,
    ) ?? IGNORED;
    suppressNextInteract();
    refreshInteractions();
    return result;
  }

  function handleBed(candidate) {
    if (candidate.kind !== BED_INTERACTION_KIND) return IGNORED;
    const result = locationOwners.needsInteractionCoordinator?.useBed?.(
      candidate.payload.bedId,
      candidate.payload,
    ) ?? IGNORED;
    suppressNextInteract();
    return result;
  }

  function handleBusyGate() {
    return locationOwners.facilityRuntime?.isUsing?.()
      || locationOwners.needsInteractionCoordinator?.isLocked?.()
      ? { status: "busy", mutated: false }
      : IGNORED;
  }

  function handleExhaustedWake(candidate) {
    if (candidate.kind !== "wake-exhausted" || sessionState.currentWorldId === WORLD_IDS.atoll) return IGNORED;
    const cooldownMs = Math.max(0, Number(getGameplayTuning()?.exhaustionWakeCooldownSeconds) || 0) * 1000;
    const attemptAtMs = now();
    if (attemptAtMs - lastWakeAttemptAtMs < cooldownMs) return { status: "cooldown", mutated: false };
    lastWakeAttemptAtMs = attemptAtMs;
    const random = getWakeRandom();
    const roll = typeof random === "function" ? Number(random()) : Number.NaN;
    if (Number.isFinite(roll) && roll < wakeProbability(sessionState.gameplay)) {
      const result = getNeedsRuntime()?.wakeFromCollapse?.() ?? IGNORED;
      if (isHandled(result)) {
        lastWakeAttemptAtMs = Number.NEGATIVE_INFINITY;
        return result;
      }
    }
    return tryWakeFromExhaustion(random);
  }

  function handleResource(candidate) {
    if (candidate.kind !== RESOURCE_INTERACTION_KIND) return IGNORED;
    const hitAtMs = now();
    const tuning = getGameplayTuning();
    if (hitAtMs - lastSuccessfulHitAtMs < tuning.universalHitCooldownSeconds * 1000) {
      return { status: "cooldown", mutated: false };
    }
    const definition = locationOwners.debrisRuntime?.getResourceDefinition?.(candidate.payload.resourceId);
    if (!definition) return { status: "unknown-resource", mutated: false };
    const profile = getResourceProfile(definition.profileId);
    const action = resourceActionForTool(profile, getSelectedItem()?.id);
    if (!action) return { status: "wrong-tool", mutated: false };
    const energyBefore = sessionState.gameplay.currentEnergy;
    const needsRuntime = getNeedsRuntime();
    const physicalAction = profile.requiredTool == null
      ? { allowed: true, cost: 0 }
      : needsRuntime?.canPerformPhysicalAction?.(profile.requiredTool) ?? { allowed: true, cost: 0 };
    if (!physicalAction.allowed) return { status: "insufficient-energy", mutated: false };
    const result = hitResourceDefinition(sessionState, definition, {
      action,
      damage: tuning.axeDamage,
      energyPerHit: physicalAction.cost,
      tuning,
    });
    if (!result.mutated) return result;

    if (profile.requiredTool != null) {
      needsRuntime?.recordPhysicalAction?.(profile.requiredTool, { energyAlreadySpent: true });
    }
    lastSuccessfulHitAtMs = hitAtMs;
    activeResourceProfileId = profile.id;
    triggerCooldownFeedback();
    renderHud();
    if (result.inventory?.mutated) notifyInventoryGain(result.inventory);
    applySuccessfulHitFeedback(resourceEffectType(profile, result.status), energyBefore);
    locationOwners.debrisRuntime?.hitWithFeedback?.(definition.id, result, refreshInteractions);
    saveSession();
    return result;
  }

  function applySuccessfulHitFeedback(effectType, energyBefore) {
    syncPlayerEnergyTarget();
    playEffect(effectType);
    const gameplay = sessionState.gameplay;
    if (shouldShakeEnergyAfterInteraction({
      mutated: true,
      energyBefore,
      currentEnergy: gameplay.currentEnergy,
      maximumEnergy: gameplay.maximumEnergy,
    })) triggerEnergyShake();
  }

  function getResourceCooldownProgress(atMs = now()) {
    const durationMs = getGameplayTuning()?.universalHitCooldownSeconds * 1000;
    if (!(durationMs > 0) || !Number.isFinite(lastSuccessfulHitAtMs)) return 0;
    return Math.max(0, Math.min(1, 1 - (atMs - lastSuccessfulHitAtMs) / durationMs));
  }

  function getResourceActivitySnapshot(atMs = now()) {
    const durationMs = getGameplayTuning()?.universalHitCooldownSeconds * 1000;
    const active = Boolean(activeResourceProfileId) && atMs - lastSuccessfulHitAtMs <= durationMs;
    return Object.freeze({
      active,
      profileId: active ? activeResourceProfileId : null,
      kind: active ? getResourceProfile(activeResourceProfileId).kind : null,
    });
  }

  return Object.freeze({
    getStaticInteractionDefinitions,
    isInteractionAllowed,
    handle,
    rebindLocationOwners,
    unbindLocationOwners,
    getResourceCooldownProgress,
    getResourceActivitySnapshot,
    expireResourceCooldown() { lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY; },
    resetResourceActivity() {
      lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY;
      activeResourceProfileId = null;
    },
    destroy() {
      destroyed = true;
      unbindLocationOwners();
      lastSuccessfulHitAtMs = Number.NEGATIVE_INFINITY;
      lastWakeAttemptAtMs = Number.NEGATIVE_INFINITY;
      activeResourceProfileId = null;
    },
  });
}

function wakeProbability(gameplay) {
  const maximumEnergy = Number(gameplay?.maximumEnergy) || 0;
  const fraction = maximumEnergy > 0 ? Number(gameplay?.currentEnergy) / maximumEnergy : 0;
  if (fraction < 0.05) return 0.1;
  if (fraction < 0.1) return 0.66;
  return fraction > 0.25 ? 1 : 0.66;
}

function createExhaustedWakeInteraction(base, worldId) {
  if (!base) return null;
  return {
    ...base,
    id: "wake-exhausted-player",
    entityId: "wake-exhausted-player",
    roomId: worldId ?? "world",
    kind: "wake-exhausted",
    prompt: "hud:interaction.tryWake",
    payload: {},
  };
}

function isHandled(result) {
  return Boolean(result) && result.status !== "ignored";
}

function emptyLocationOwners() {
  return {
    merchantRuntime: null,
    farmingRuntime: null,
    tavernSignRuntime: null,
    venueMenuRuntime: null,
    tavernServiceRuntime: null,
    facilityRuntime: null,
    kitchenInteractionRuntime: null,
    needsInteractionCoordinator: null,
    cookingRuntime: null,
    debrisRuntime: null,
  };
}
