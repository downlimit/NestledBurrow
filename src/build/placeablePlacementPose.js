import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { FACILITY_ASSETS } from "../facilities/facilityConfig.js";
import { FARMING_WELL_TEXTURE_KEY, WELL_PROFILE } from "../resources/farmingConfig.js";
import { getResourceProfile } from "../resources/resourceDomain.js";
import { TAVERN_SIGN, TAVERN_SIGN_ASSET } from "../tavern/guestConfig.js";
import { TILE_SIZE } from "../world/worldConfig.js";
import {
  assetDepthFromPivot,
  pixelAlignedWorldPoint,
  placementMidpointOffset,
} from "./buildWorldGeometry.js";
import { effectiveCollider, resourceColliderAt } from "./placeableBuildGeometry.js";
import { PLACEABLE_BUILD_OWNER_IDS } from "./placeableBuildProtocol.js";

function point(value = {}) {
  return Object.freeze({
    x: Math.round(Number(value.x) || 0),
    y: Math.round(Number(value.y) || 0),
  });
}

function profileKeyFor(adapterId, value = {}) {
  if (value.profileKey) return value.profileKey;
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.bed) return "furniture:bed";
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.facility && value.facilityType) return `facility:${value.facilityType}`;
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.resource && value.resourceProfileId) return `resource:${value.resourceProfileId}`;
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.well) return "farming:well";
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.tavernSign) return "facility:tavern-sign";
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.trainingDummy) return "melee:training-dummy";
  return null;
}

function offsetRect(placement, rect) {
  return Object.freeze({
    left: placement.x + Number(rect.left),
    right: placement.x + Number(rect.right),
    top: placement.y + Number(rect.top),
    bottom: placement.y + Number(rect.bottom),
  });
}

function basePlacementCollider(adapterId, value, placement) {
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.bed) {
    return offsetRect(placement, { left: 0, right: TILE_SIZE, top: 0, bottom: TILE_SIZE });
  }
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.facility) {
    const asset = FACILITY_ASSETS[value?.facilityType];
    return asset
      ? offsetRect(placement, { left: 0, right: asset.width, top: 0, bottom: asset.height })
      : null;
  }
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.resource) {
    const profileId = value?.resourceProfileId ?? value?.definition?.profileId;
    return profileId ? resourceColliderAt(placement, getResourceProfile(profileId)) : null;
  }
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.well) {
    return offsetRect(placement, WELL_PROFILE.collisionRect);
  }
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.tavernSign) {
    return offsetRect(placement, TAVERN_SIGN.collisionRect);
  }
  if (adapterId === PLACEABLE_BUILD_OWNER_IDS.trainingDummy) {
    return offsetRect(placement, TRAINING_DUMMY.asset.collision);
  }
  return null;
}

export function resolvePlaceablePlacementPose(scene, profileKey, placementPosition) {
  const placement = point(placementPosition);
  const profile = scene.assetProfiles?.[profileKey] ?? {};
  const pivotOffset = point(profile.snapAnchorOffset);
  const visualOffset = point(profile.visualOffset);
  const visualPosition = pixelAlignedWorldPoint({
    x: placement.x + visualOffset.x,
    y: placement.y + visualOffset.y,
  });
  return Object.freeze({
    profileKey,
    placementPosition: placement,
    pivotOffset,
    visualOffset,
    pivotPosition: Object.freeze({
      x: placement.x + pivotOffset.x,
      y: placement.y + pivotOffset.y,
    }),
    visualPosition,
  });
}

export function resolvePlaceablePlacementAnchor(scene, adapterId, value = {}, placementPosition = { x: 0, y: 0 }) {
  const profileKey = profileKeyFor(adapterId, value);
  if (!profileKey) return null;
  const placement = point(placementPosition);
  const baseCollider = basePlacementCollider(adapterId, value, placement);
  if (!baseCollider) return null;
  const pivotOffset = point(scene.assetProfiles?.[profileKey]?.snapAnchorOffset);
  return placementMidpointOffset({
    placementPosition: placement,
    pivotOffset,
    effectiveCollider: effectiveCollider(scene, baseCollider, profileKey),
  });
}

function previewTint(blocked) {
  return blocked ? 0xff5364 : 0x7dff9a;
}

function decorateTarget(scene, adapter, target) {
  if (!target) return null;
  const profileKey = profileKeyFor(adapter.id, target);
  if (!profileKey) return target;
  const placementPosition = target.placementPosition ?? { x: 0, y: 0 };
  const pose = resolvePlaceablePlacementPose(scene, profileKey, placementPosition);
  const anchorOffset = resolvePlaceablePlacementAnchor(scene, adapter.id, target, placementPosition);
  return {
    ...target,
    profileKey,
    snapAnchorOffset: anchorOffset ? { ...anchorOffset } : { ...pose.pivotOffset },
  };
}

function renderWellPreview(scene, adapter, item, placementPosition, options) {
  const pose = resolvePlaceablePlacementPose(scene, "farming:well", placementPosition);
  return scene.add.image(pose.visualPosition.x, pose.visualPosition.y, FARMING_WELL_TEXTURE_KEY)
    .setOrigin(0)
    .setDepth(assetDepthFromPivot(pose.placementPosition, pose.pivotOffset, 8988, "build-preview:well"))
    .setTint(previewTint(adapter.isPlacementBlocked(item, pose.placementPosition, options.ignoreId ?? null)))
    .setAlpha(options.demolition ? 0.68 : 0.58);
}

function renderTavernSignPreview(scene, owners, adapter, item, placementPosition, options) {
  const pose = resolvePlaceablePlacementPose(scene, "facility:tavern-sign", placementPosition);
  const frame = owners.tavernSignRuntime?.getState?.()?.open ? 0 : 1;
  return scene.add.sprite(pose.visualPosition.x, pose.visualPosition.y, TAVERN_SIGN_ASSET.key, frame)
    .setOrigin(0.5, 1)
    .setDepth(assetDepthFromPivot(pose.placementPosition, pose.pivotOffset, 8988, TAVERN_SIGN.id))
    .setTint(previewTint(adapter.isPlacementBlocked(item, pose.placementPosition, options.ignoreId ?? null)))
    .setAlpha(options.demolition ? 0.68 : 0.58);
}

function renderTrainingDummyPreview(scene, adapter, item, placementPosition, options) {
  const pose = resolvePlaceablePlacementPose(scene, "melee:training-dummy", placementPosition);
  return scene.add.image(pose.visualPosition.x, pose.visualPosition.y, TRAINING_DUMMY.asset.textureKey)
    .setOrigin(0)
    .setDepth(assetDepthFromPivot(pose.placementPosition, pose.pivotOffset, 8988, TRAINING_DUMMY.id))
    .setTint(previewTint(adapter.isPlacementBlocked(item, pose.placementPosition, options.ignoreId ?? null)))
    .setAlpha(options.demolition ? 0.68 : 0.58);
}

export function decoratePlaceablePlacementAdapters(scene, owners, adapters) {
  return adapters.map((adapter) => {
    const originalGetTargetAt = adapter.getTargetAt.bind(adapter);
    const decorated = {
      ...adapter,
      getPlacementAnchorOffset(value) {
        return resolvePlaceablePlacementAnchor(scene, adapter.id, value, { x: 0, y: 0 })
          ?? adapter.getPlacementAnchorOffset?.(value)
          ?? { x: 0, y: 0 };
      },
      getTargetAt(value) {
        return decorateTarget(scene, adapter, originalGetTargetAt(value));
      },
    };

    if (adapter.id === PLACEABLE_BUILD_OWNER_IDS.well) {
      decorated.renderPreview = (item, placementPosition, options = {}) => renderWellPreview(
        scene,
        decorated,
        item,
        placementPosition,
        options,
      );
    }
    if (adapter.id === PLACEABLE_BUILD_OWNER_IDS.tavernSign) {
      decorated.renderPreview = (item, placementPosition, options = {}) => renderTavernSignPreview(
        scene,
        owners,
        decorated,
        item,
        placementPosition,
        options,
      );
    }
    if (adapter.id === PLACEABLE_BUILD_OWNER_IDS.trainingDummy) {
      decorated.renderPreview = (item, placementPosition, options = {}) => renderTrainingDummyPreview(
        scene,
        decorated,
        item,
        placementPosition,
        options,
      );
    }
    return decorated;
  });
}
