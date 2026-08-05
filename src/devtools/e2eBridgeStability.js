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
  const fallbackPlacePlayerNear = bridge.placePlayerNear?.bind(bridge);
  bridge.placePlayerNear = (entityId) => {
    const scene = getCurrentWorldScene();
    return Boolean(scene && placePlayerAtLiveInteraction(scene, entityId))
      || fallbackPlacePlayerNear?.(entityId)
      || false;
  };
  Object.defineProperty(bridge, INSTALL_MARKER, { value: true });
}

function placePlayerAtLiveInteraction(scene, entityId) {
  const definition = scene.worldInteractionCoordinator
    ?.getStaticInteractionDefinitions?.()
    .find((candidate) => candidate.entityId === entityId || candidate.id === entityId);
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
    scene.interactionRuntime?.update?.({ actions: { interact: false, primary: false, secondary: false } });
    if (scene.interactionRuntime?.getCurrentCandidate?.()?.entityId !== entityId) continue;
    scene.cameraRuntime?.reset?.(player.motor.position);
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
