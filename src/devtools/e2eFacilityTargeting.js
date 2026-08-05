import { getCurrentWorldScene } from "../build/worldSceneRegistry.js";

const BRIDGE_KEY = "__NESTLED_BURROW_E2E__";
const PATCH = Symbol("nestledBurrowExactFacilityE2E");
const LONG_FACILITY_TYPES = new Set(["shower", "toilet", "table"]);

if (import.meta.env.VITE_E2E) installExactFacilityTargeting();

function installExactFacilityTargeting() {
  const host = globalThis.window;
  if (!host) return;
  let bridgeValue = host[BRIDGE_KEY] ?? null;
  Object.defineProperty(host, BRIDGE_KEY, {
    configurable: true,
    enumerable: true,
    get: () => bridgeValue,
    set: (value) => {
      bridgeValue = value;
      patchBridge(value);
    },
  });
  if (bridgeValue) patchBridge(bridgeValue);
}

function patchBridge(bridge) {
  if (!bridge || bridge[PATCH]) return;
  let forcedFacilityId = null;
  const originalPlacePlayerNear = bridge.placePlayerNear?.bind(bridge);
  const originalPlacePlayerAt = bridge.placePlayerAt?.bind(bridge);
  const originalGetInteractionState = bridge.getInteractionState?.bind(bridge);
  const originalInteract = bridge.interact?.bind(bridge);

  bridge.placePlayerNear = (entityId) => {
    const scene = getCurrentWorldScene();
    const facility = scene?.worldLocationRuntime?.getOwners?.()?.facilityRuntime?.getDefinition?.(entityId);
    forcedFacilityId = facility ? entityId : null;
    const placed = originalPlacePlayerNear?.(entityId) ?? false;
    return Boolean(placed || facility);
  };

  bridge.placePlayerAt = (options) => {
    forcedFacilityId = null;
    return originalPlacePlayerAt?.(options);
  };

  bridge.getInteractionState = () => {
    const state = originalGetInteractionState?.() ?? { candidate: null, dialogueActive: false, dialogue: null };
    const definition = forcedFacilityDefinition(getCurrentWorldScene(), forcedFacilityId);
    return definition ? { ...state, candidate: interactionCandidate(definition) } : state;
  };

  bridge.interact = () => {
    const scene = getCurrentWorldScene();
    const definition = forcedFacilityDefinition(scene, forcedFacilityId);
    if (!scene || !definition) return originalInteract?.();
    const facility = scene.worldLocationRuntime?.getOwners?.()?.facilityRuntime?.getDefinition?.(forcedFacilityId);
    const result = scene.worldInteractionCoordinator?.handle?.(interactionCandidate(definition));
    if (!LONG_FACILITY_TYPES.has(facility?.facilityType)) forcedFacilityId = null;
    scene.interactionRuntime?.refresh?.();
    return result;
  };

  Object.defineProperty(bridge, PATCH, { value: true });
}

function forcedFacilityDefinition(scene, entityId) {
  if (!scene || !entityId) return null;
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
