import { TAVERN_SIGN, TAVERN_SIGN_ASSET, TAVERN_SIGN_BUILD_KIND, TAVERN_SIGN_KIND } from "./guestConfig.js";
import { assetDepthFromRenderMode, pixelAlignedWorldPoint } from "../build/buildWorldGeometry.js";
import {
  WORLD_OBJECT_ATTENTION_DOT_THRESHOLD,
  WORLD_OBJECT_ATTENTION_GROUP,
  WORLD_PLACEABLE_TARGETING_GROUP,
} from "../interaction/interactionConfig.js";

const PROFILE_KEY = "facility:tavern-sign";

export function createTavernSignRuntime(scene, { getTavernOpen, worldLayout }) {
  let position = { ...TAVERN_SIGN.position };
  let present = true;
  const sprite = scene.add.sprite(position.x, position.y, TAVERN_SIGN_ASSET.key, 1)
    .setOrigin(0.5, 1);

  const profilePoint = (field) => {
    const value = scene.assetProfiles?.[PROFILE_KEY]?.[field];
    return { x: Math.round(Number(value?.x) || 0), y: Math.round(Number(value?.y) || 0) };
  };
  const authoredDepthAt = (point, baseDepth = 500, stableId = TAVERN_SIGN.id) => assetDepthFromRenderMode({
    placementPosition: point,
    pivotOffset: profilePoint("snapAnchorOffset"),
    renderMode: scene.assetProfiles?.[PROFILE_KEY]?.renderMode,
    baseDepth,
    stableId,
  });
  const visualPositionAt = (point) => {
    const offset = profilePoint("visualOffset");
    return pixelAlignedWorldPoint({ x: point.x + offset.x, y: point.y + offset.y });
  };
  const offsetPoint = (offset, point = position) => ({ x: point.x + offset.x, y: point.y + offset.y });
  const colliderAt = (point) => ({
    left: point.x + TAVERN_SIGN.collisionRect.left,
    right: point.x + TAVERN_SIGN.collisionRect.right,
    top: point.y + TAVERN_SIGN.collisionRect.top,
    bottom: point.y + TAVERN_SIGN.collisionRect.bottom,
  });
  const effectiveColliderAt = (point) => worldLayout?.getEffectiveCollider?.(colliderAt(point), PROFILE_KEY)
    ?? colliderAt(point);
  const authoringBoundsAt = (point) => ({
    left: point.x - TAVERN_SIGN.width / 2,
    right: point.x + TAVERN_SIGN.width / 2,
    top: point.y - TAVERN_SIGN.height,
    bottom: point.y,
  });
  const visualBoundsAt = (point) => authoringBoundsAt(visualPositionAt(point));
  const unionBounds = (first, second) => ({
    left: Math.min(first.left, second.left),
    right: Math.max(first.right, second.right),
    top: Math.min(first.top, second.top),
    bottom: Math.max(first.bottom, second.bottom),
  });
  const contains = (bounds, point) => point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom;

  function isPlacementBlocked(point) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return true;
    const bounds = visualBoundsAt(point);
    if (worldLayout?.bounds && (bounds.left < worldLayout.bounds.left || bounds.top < worldLayout.bounds.top
      || bounds.right > worldLayout.bounds.right || bounds.bottom > worldLayout.bounds.bottom)) return true;
    return (worldLayout?.getBlockingColliders?.(effectiveColliderAt(point)) ?? [])
      .some(({ id }) => id !== TAVERN_SIGN.id);
  }

  function definition() {
    return {
      id: TAVERN_SIGN.id,
      kind: TAVERN_SIGN_BUILD_KIND,
      position: { ...position },
    };
  }

  function syncPlacement() {
    sprite.setVisible?.(present);
    if (!present) {
      worldLayout?.clearWorldObjectCollider?.(TAVERN_SIGN.id);
      return;
    }
    const visual = visualPositionAt(position);
    sprite
      .setPosition(visual.x, visual.y)
      .setDepth(authoredDepthAt(position));
    worldLayout?.setWorldObjectCollider?.(TAVERN_SIGN.id, colliderAt(position), PROFILE_KEY, {
      collisionEnabled: scene.assetProfiles?.[PROFILE_KEY]?.collisionEnabled !== false,
    });
  }

  function draw() {
    sprite.setFrame(getTavernOpen() ? 0 : 1);
    sprite.setVisible?.(present);
  }

  function restoreBuildTarget(value) {
    const source = value?.position ?? value;
    const restored = { x: Number(source?.x), y: Number(source?.y) };
    if (!Number.isFinite(restored.x) || !Number.isFinite(restored.y)) return false;
    position = restored;
    present = true;
    syncPlacement();
    draw();
    return true;
  }

  syncPlacement();
  draw();

  return {
    getInteractionDefinitions() {
      if (!present) return [];
      return [{
        id: TAVERN_SIGN.id,
        entityId: TAVERN_SIGN.entityId,
        roomId: "world",
        kind: TAVERN_SIGN_KIND,
        profileKey: PROFILE_KEY,
        position: offsetPoint(TAVERN_SIGN.interactionOffset),
        radius: 34,
        priority: 30,
        requiresFacing: true,
        facingDotThreshold: WORLD_OBJECT_ATTENTION_DOT_THRESHOLD,
        targetingMode: "facing-first",
        targetingGroup: WORLD_PLACEABLE_TARGETING_GROUP,
        attentionGroup: WORLD_OBJECT_ATTENTION_GROUP,
        prompt: getTavernOpen() ? "hud:interaction.closeTavern" : "hud:interaction.openTavern",
        payload: {},
      }];
    },
    sync() {
      syncPlacement();
      draw();
    },
    getState: () => ({
      open: Boolean(getTavernOpen()),
      present,
      ...TAVERN_SIGN,
      position: { ...position },
      interactionPosition: offsetPoint(TAVERN_SIGN.interactionOffset),
      guestCheckPoint: offsetPoint(TAVERN_SIGN.guestCheckOffset),
    }),
    getGuestCheckPoint: () => offsetPoint(TAVERN_SIGN.guestCheckOffset),
    getBuildMoveTargetAt(point) {
      if (!present) return null;
      const authoringBounds = authoringBoundsAt(position);
      const bounds = unionBounds(visualBoundsAt(position), effectiveColliderAt(position));
      return contains(bounds, point) ? {
        kind: TAVERN_SIGN_BUILD_KIND,
        definition: definition(),
        profileKey: PROFILE_KEY,
        authoringBounds,
        bounds,
        placementPosition: { ...position },
        snapAnchorOffset: profilePoint("snapAnchorOffset"),
        targets: [sprite],
      } : null;
    },
    isBuildPlacementBlocked: isPlacementBlocked,
    placeBuildTarget(point) {
      if (present || isPlacementBlocked(point)) return null;
      position = { x: Number(point.x), y: Number(point.y) };
      present = true;
      syncPlacement();
      draw();
      return definition();
    },
    moveBuildTarget(point) {
      if (!present) return null;
      const next = { x: Number(point.x), y: Number(point.y) };
      if (isPlacementBlocked(next)) return null;
      const previous = { ...position };
      position = next;
      syncPlacement();
      return { previous, current: { ...position } };
    },
    removeBuildTarget() {
      if (!present) return null;
      const removed = definition();
      present = false;
      syncPlacement();
      draw();
      return removed;
    },
    restoreBuildTarget,
    renderBuildPreview(point) {
      const visual = visualPositionAt(point);
      return scene.add.sprite(visual.x, visual.y, TAVERN_SIGN_ASSET.key, getTavernOpen() ? 0 : 1)
        .setOrigin(0.5, 1)
        .setDepth(authoredDepthAt(point, 8988, `${TAVERN_SIGN.id}:preview`))
        .setTint(isPlacementBlocked(point) ? 0xff5364 : 0x7dff9a)
        .setAlpha(0.58);
    },
    getStartingLayoutFurniture: () => present ? [definition()] : [],
    restoreStartingLayoutFurniture(definitions) {
      const entry = definitions?.find?.(({ id }) => id === TAVERN_SIGN.id);
      if (!entry) {
        present = false;
        syncPlacement();
        draw();
        return true;
      }
      return entry.kind === TAVERN_SIGN_BUILD_KIND && restoreBuildTarget(entry);
    },
    destroy: () => {
      sprite.destroy();
      worldLayout?.clearWorldObjectCollider?.(TAVERN_SIGN.id);
    },
  };
}
