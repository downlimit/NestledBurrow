import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { FARMING_WELL_TEXTURE_KEY } from "../resources/farmingConfig.js";
import { TAVERN_SIGN, TAVERN_SIGN_ASSET } from "../tavern/guestConfig.js";
import { assetDepthFromPivot, pixelAlignedWorldPoint } from "./buildWorldGeometry.js";
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

function previewTint(blocked) {
  return blocked ? 0xff5364 : 0x7dff9a;
}

function decorateTarget(scene, adapter, target) {
  if (!target) return null;
  const profileKey = profileKeyFor(adapter.id, target);
  if (!profileKey) return target;
  const pose = resolvePlaceablePlacementPose(scene, profileKey, target.placementPosition ?? { x: 0, y: 0 });
  return {
    ...target,
    profileKey,
    snapAnchorOffset: { ...pose.pivotOffset },
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
        const profileKey = profileKeyFor(adapter.id, value);
        return profileKey
          ? { ...resolvePlaceablePlacementPose(scene, profileKey, { x: 0, y: 0 }).pivotOffset }
          : adapter.getPlacementAnchorOffset?.(value) ?? { x: 0, y: 0 };
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
