import { TAVERN_SIGN, TAVERN_SIGN_ASSET, TAVERN_SIGN_BUILD_KIND, TAVERN_SIGN_KIND } from "./guestConfig.js";
import { worldDepthFromAnchorY } from "./buildWorldGeometry.js";

export function createTavernSignRuntime(scene, { getTavernOpen, worldLayout }) {
  let position = { ...TAVERN_SIGN.position };
  const sprite = scene.add.sprite(position.x, position.y, TAVERN_SIGN_ASSET.key, 1)
    .setOrigin(0.5, 1)
    .setDepth(worldDepthFromAnchorY(position.y, TAVERN_SIGN.id));

  const offsetPoint = (offset, point = position) => ({ x: point.x + offset.x, y: point.y + offset.y });
  const colliderAt = (point) => ({
    left: point.x + TAVERN_SIGN.collisionRect.left,
    right: point.x + TAVERN_SIGN.collisionRect.right,
    top: point.y + TAVERN_SIGN.collisionRect.top,
    bottom: point.y + TAVERN_SIGN.collisionRect.bottom,
  });
  const boundsAt = (point) => ({
    left: point.x - TAVERN_SIGN.width / 2,
    right: point.x + TAVERN_SIGN.width / 2,
    top: point.y - TAVERN_SIGN.height,
    bottom: point.y,
  });
  const contains = (bounds, point) => point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom;

  function isPlacementBlocked(point) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return true;
    const bounds = boundsAt(point);
    if (worldLayout?.bounds && (bounds.left < worldLayout.bounds.left || bounds.top < worldLayout.bounds.top
      || bounds.right > worldLayout.bounds.right || bounds.bottom > worldLayout.bounds.bottom)) return true;
    return (worldLayout?.getBlockingColliders?.(colliderAt(point)) ?? []).some(({ id }) => id !== TAVERN_SIGN.id);
  }

  function syncPlacement() {
    sprite.setPosition(position.x, position.y).setDepth(worldDepthFromAnchorY(position.y, TAVERN_SIGN.id));
    worldLayout?.setWorldObjectCollider?.(TAVERN_SIGN.id, colliderAt(position), "facility:tavern-sign");
  }

  function draw() {
    sprite.setFrame(getTavernOpen() ? 0 : 1);
  }
  syncPlacement();
  draw();

  return {
    getInteractionDefinitions() {
      return [{
        id: TAVERN_SIGN.id,
        entityId: TAVERN_SIGN.entityId,
        roomId: "world",
        kind: TAVERN_SIGN_KIND,
        position: offsetPoint(TAVERN_SIGN.interactionOffset),
        radius: 34,
        priority: 30,
        requiresFacing: false,
        facingDotThreshold: -1,
        prompt: getTavernOpen() ? "hud:interaction.closeTavern" : "hud:interaction.openTavern",
        payload: {},
      }];
    },
    sync: draw,
    getState: () => ({
      open: Boolean(getTavernOpen()),
      ...TAVERN_SIGN,
      position: { ...position },
      interactionPosition: offsetPoint(TAVERN_SIGN.interactionOffset),
      guestCheckPoint: offsetPoint(TAVERN_SIGN.guestCheckOffset),
    }),
    getGuestCheckPoint: () => offsetPoint(TAVERN_SIGN.guestCheckOffset),
    getBuildMoveTargetAt(point) {
      return contains(boundsAt(position), point) ? {
        kind: TAVERN_SIGN_BUILD_KIND,
        definition: { id: TAVERN_SIGN.id, kind: TAVERN_SIGN_BUILD_KIND, position: { ...position } },
        profileKey: "facility:tavern-sign",
        placementPosition: { ...position },
        snapAnchorOffset: { ...TAVERN_SIGN.snapAnchorOffset },
        targets: [sprite],
      } : null;
    },
    moveBuildTarget(point) {
      const next = { x: Number(point.x), y: Number(point.y) };
      if (isPlacementBlocked(next)) return null;
      const previous = { ...position };
      position = next;
      syncPlacement();
      return { previous, current: { ...position } };
    },
    restoreBuildTarget(point) {
      const restored = { x: Number(point.x), y: Number(point.y) };
      if (!Number.isFinite(restored.x) || !Number.isFinite(restored.y)) return false;
      position = restored;
      syncPlacement();
      return true;
    },
    renderBuildPreview(point) {
      const preview = scene.add.sprite(point.x, point.y, TAVERN_SIGN_ASSET.key, getTavernOpen() ? 0 : 1)
        .setOrigin(0.5, 1)
        .setDepth(8988)
        .setTint(isPlacementBlocked(point) ? 0xff5364 : 0x7dff9a)
        .setAlpha(0.58);
      return preview;
    },
    getStartingLayoutFurniture: () => [{ id: TAVERN_SIGN.id, kind: TAVERN_SIGN_BUILD_KIND, position: { ...position } }],
    restoreStartingLayoutFurniture(definitions) {
      const definition = definitions?.find?.(({ id }) => id === TAVERN_SIGN.id);
      const restored = { x: Number(definition?.position?.x), y: Number(definition?.position?.y) };
      if (definition?.kind !== TAVERN_SIGN_BUILD_KIND || !Number.isFinite(restored.x) || !Number.isFinite(restored.y)) return false;
      position = restored;
      syncPlacement();
      return true;
    },
    destroy: () => {
      sprite.destroy();
      worldLayout?.clearWorldObjectCollider?.(TAVERN_SIGN.id);
    },
  };
}
