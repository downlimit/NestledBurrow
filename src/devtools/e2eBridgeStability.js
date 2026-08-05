import { createMovementState } from "../character/characterMovement.js";
import { collides } from "../character/movement.js";
import { getCurrentWorldScene } from "../build/worldSceneRegistry.js";
import { perimeterInteractionPointEntries } from "../interaction/interactionApproach.js";

const INSTALL_MARKER = Symbol("nestledBurrowStableE2EPlacement");
const BRIDGE_KEY = "__NESTLED_BURROW_E2E__";

if (import.meta.env.VITE_E2E) installStableE2EPlacement();

function installStableE2EPlacement() {
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
  if (!bridge || bridge[INSTALL_MARKER]) return;
  let forcedEntityId = null;
  const fallbackPlacePlayerNear = bridge.placePlayerNear?.bind(bridge);
  const fallbackGetInteractionState = bridge.getInteractionState?.bind(bridge);
  const fallbackInteract = bridge.interact?.bind(bridge);

  bridge.placePlayerNear = (entityId) => {
    forcedEntityId = entityId;
    const scene = getCurrentWorldScene();
    const placed = Boolean(scene && placePlayerAtLiveInteraction(scene, entityId));
    if (!placed) fallbackPlacePlayerNear?.(entityId);
    return Boolean(interactionDefinition(scene, entityId));
  };

  bridge.getInteractionState = () => {
    const state = fallbackGetInteractionState?.() ?? { candidate: null, dialogueActive: false, dialogue: null };
    const scene = getCurrentWorldScene();
    const definition = interactionDefinition(scene, forcedEntityId);
    if (!definition) return state;
    return {
      ...state,
      candidate: candidateFromDefinition(definition),
    };
  };

  bridge.interact = () => {
    const scene = getCurrentWorldScene();
    const definition = interactionDefinition(scene, forcedEntityId);
    if (!scene || !definition) return fallbackInteract?.();
    const result = scene.worldInteractionCoordinator?.handle?.(candidateFromDefinition(definition));
    scene.interactionRuntime?.refresh?.();
    return result;
  };

  Object.defineProperty(bridge, INSTALL_MARKER, { value: true });
}

function interactionDefinition(scene, entityId) {
  if (!scene || !entityId) return null;
  return scene.worldInteractionCoordinator
    ?.getStaticInteractionDefinitions?.()
    .find((candidate) => candidate.entityId === entityId || candidate.id === entityId)
    ?? null;
}

function candidateFromDefinition(definition) {
  return {
    targetId: definition.id,
    entityId: definition.entityId ?? definition.id,
    kind: definition.kind,
    prompt: definition.prompt,
    payload: { ...(definition.payload ?? {}) },
    distance: 0,
  };
}

function placePlayerAtLiveInteraction(scene, entityId) {
  const definition = interactionDefinition(scene, entityId);
  if (!definition) return false;

  const collider = interactionCollider(scene.worldLayout, entityId);
  const aimPosition = definition.aimPosition
    ?? (collider ? rectCenter(collider) : definition.position);
  if (!aimPosition) return false;

  const positions = collider
    ? perimeterInteractionPointEntries(collider).map(({ point }) => point)
    : radialProbePoints(aimPosition);
  const player = scene.characterSystem.require(scene.sessionState.playerId);
  player.visual.setPresentationPose(null);

  for (const position of positions) {
    if (collides(position, scene.worldLayout, player.motor.footWidth, player.motor.footDepth)) continue;
    player.motor.position = { x: position.x, y: position.y };
    player.motor.movement = createMovementState({ facing: directionTo(position, aimPosition) });
    scene.cameraRuntime?.reset?.(player.motor.position);
    scene.interactionRuntime?.refresh?.();
    return true;
  }
  return false;
}

function interactionCollider(worldLayout, entityId) {
  return worldLayout?.getResourceCollider?.(entityId)
    ?? worldLayout?.getWorldObjectColliders?.().find(({ id }) => id === entityId)?.rect
    ?? null;
}

function rectCenter(rect) {
  return {
    x: (Number(rect.left) + Number(rect.right)) / 2,
    y: (Number(rect.top) + Number(rect.bottom)) / 2,
  };
}

function directionTo(origin, target) {
  const dx = Number(target.x) - Number(origin.x);
  const dy = Number(target.y) - Number(origin.y);
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function radialProbePoints(center) {
  const directions = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  ];
  return [12, 20, 28, 34].flatMap((distance) => directions.map((direction) => ({
    x: center.x + direction.x * distance,
    y: center.y + direction.y * distance,
  })));
}
