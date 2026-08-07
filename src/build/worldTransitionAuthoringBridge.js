const WORLD_TRANSITION_AUTHORING_BRIDGE = Symbol("nestledBurrowWorldTransitionAuthoringBridge");

function contains(bounds, point) {
  return Boolean(bounds)
    && point.x >= bounds.left
    && point.x < bounds.right
    && point.y >= bounds.top
    && point.y < bounds.bottom;
}

function pointerPoint(pointer) {
  return {
    x: Number(pointer?.worldX ?? pointer?.x),
    y: Number(pointer?.worldY ?? pointer?.y),
  };
}

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

  const originalBeginColliderEditPointer = scene.beginColliderEditPointer?.bind(scene);
  if (originalBeginColliderEditPointer) {
    scene.beginColliderEditPointer = (pointer) => {
      const point = pointerPoint(pointer);
      const transition = (scene.worldPresentationRuntime?.getTransitionAuthoringInstances?.() ?? [])
        .map((instance) => {
          const visualOffset = scene.assetProfiles?.[instance.profileKey]?.visualOffset ?? { x: 0, y: 0 };
          const bounds = {
            left: instance.bounds.left + Number(visualOffset.x || 0),
            right: instance.bounds.right + Number(visualOffset.x || 0),
            top: instance.bounds.top + Number(visualOffset.y || 0),
            bottom: instance.bounds.bottom + Number(visualOffset.y || 0),
          };
          return { instance, bounds };
        })
        .find(({ bounds }) => contains(bounds, point))?.instance;
      const collider = transition
        ? scene.worldLayout?.getWorldObjectColliders?.().find(({ id }) => id === transition.id)?.rect
        : null;
      if (!collider || contains(collider, point)) return originalBeginColliderEditPointer(pointer);
      return originalBeginColliderEditPointer({
        ...pointer,
        worldX: (collider.left + collider.right) / 2,
        worldY: (collider.top + collider.bottom) / 2,
      });
    };
  }

  Object.defineProperty(scene, WORLD_TRANSITION_AUTHORING_BRIDGE, { value: true });
  return scene;
}
