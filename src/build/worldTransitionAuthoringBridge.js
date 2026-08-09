const WORLD_TRANSITION_AUTHORING_BRIDGE = Symbol("nestledBurrowWorldTransitionAuthoringBridge");

export function installWorldTransitionAuthoringBridge(scene) {
  if (!scene || scene[WORLD_TRANSITION_AUTHORING_BRIDGE]) return scene ?? null;

  if (scene.worldLocationCoordinator) {
    scene.worldLocationCoordinator.getAssetProfiles = () => scene.assetProfiles ?? {};
  }

  const originalGetControllerMoveDirection = scene.getControllerMoveDirection?.bind(scene);
  if (originalGetControllerMoveDirection) {
    scene.getControllerMoveDirection = (...args) => scene.interactionPointEditEnabled
      ? { x: 0, y: 0 }
      : originalGetControllerMoveDirection(...args);
  }

  Object.defineProperty(scene, WORLD_TRANSITION_AUTHORING_BRIDGE, { value: true });
  return scene;
}
