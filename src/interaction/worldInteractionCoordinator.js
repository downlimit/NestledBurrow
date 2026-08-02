import { BED_INTERACTION_KIND } from "../resources/debrisConfig.js";
import { FACILITY_INTERACTION_KIND } from "../facilities/facilityConfig.js";
import { shouldShakeEnergyAfterInteraction } from "../ui/gameHud.js";
import { hitResourceDefinition } from "../session/gameSessionState.js";
import { TAVERN_SIGN_KIND } from "../tavern/guestConfig.js";
import { RESOURCE_INTERACTION_KIND } from "../resources/resourceConfig.js";
import { getResourceProfile, resourceActionForTool, resourceEffectType } from "../resources/resourceDomain.js";

const IGNORED = Object.freeze({ status: "ignored", mutated: false });

export function createWorldInteractionCoordinator({
  sessionState,
  getGameplayTuning,
  getSelectedItem = () => null,
  getNeedsRuntime = () => null,
  getSleepingWakeInteraction = () => null,
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
  let activeResourceProfileId = null;

  function rebindLocationOwners(next = {}) {
    locationOwners = {
      merchantRuntime: next.merchantRuntime ?? null,
      farmingRuntime: next.farmingRuntime ?? null,
      tavernSignRuntime: next.tavernSignRuntime ?? null,
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
    const wake = isSleeping() && !isExhaustedSleeping() ? getSleepingWakeInteraction() : null;
    return [
      ...(locationOwners.debrisRuntime?.getInteractionDefinitions?.() ?? []),
      ...(locationOwners.facilityRuntime?.getInteractionDefinitions?.() ?? []),
      ...(locationOwners.tavernSignRuntime?.getInteractionDefinitions?.() ?? []),
      ...(locationOwners.farmingRuntime?.getInteractionDefinitions?.() ?? []),
      ...(wake ? [wake] : []),
    ];
  }

  function isInteractionAllowed(definition) {
    if (destroyed || locationOwners.cookingRuntime?.isActive?.()) return false;
    if (!(locationOwners.needsInteractionCoordinator?.allowsInteraction?.(definition) ?? true)) return false;
    return !locationOwners.facilityRuntime?.isUsing?.()
      || definition.kind === FACILITY_INTERACTION_KIND
        && definition.id === locationOwners.facilityRuntime.getActiveId();
  }

  function handle(candidate) {
    if (destroyed) return IGNORED;
    let result = handleMerchant(candidate);
    if (isHandled(result)) return result;
    result = handleFarming(candidate);
    if (isHandled(result)) return result;
    result = handleTavernSign(candidate);
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
    sessionState.gameplay.tavernOpen = !sessionState.gameplay.tavernOpen;
    playEffect(sessionState.gameplay.tavernOpen ? "tavern-open" : "tavern-close");
    locationOwners.tavernSignRuntime?.sync?.();
    refreshInteractions();
    suppressNextInteract();
    renderHud();
    saveSession();
    return { status: sessionState.gameplay.tavernOpen ? "opened" : "closed", mutated: true };
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
    return candidate.kind === "wake-exhausted" ? tryWakeFromExhaustion(getWakeRandom()) : IGNORED;
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
      activeResourceProfileId = null;
    },
  });
}

function isHandled(result) {
  return Boolean(result) && result.status !== "ignored";
}

function emptyLocationOwners() {
  return {
    merchantRuntime: null,
    farmingRuntime: null,
    tavernSignRuntime: null,
    facilityRuntime: null,
    kitchenInteractionRuntime: null,
    needsInteractionCoordinator: null,
    cookingRuntime: null,
    debrisRuntime: null,
  };
}
