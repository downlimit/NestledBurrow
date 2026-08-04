import { assetDepthFromPivot } from "./buildWorldGeometry.js";

export const PLACEABLE_TARGETING_GROUP = "world-placeable";

const FACILITY_DERIVED_FIELDS = Object.freeze([
  "position",
  "usePosition",
  "aimPosition",
  "presentationPose",
  "requiresFacing",
  "facingDotThreshold",
  "targetingMode",
  "targetingGroup",
]);

const BED_DERIVED_FIELDS = Object.freeze([
  "wakePosition",
  "usePosition",
  "aimPosition",
  "presentationPose",
  "targetingMode",
  "targetingGroup",
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function withoutFields(definition, fields) {
  const result = { ...definition };
  for (const field of fields) delete result[field];
  return result;
}

export function rectCenter(rect) {
  return Object.freeze({
    x: (finite(rect?.left) + finite(rect?.right)) / 2,
    y: (finite(rect?.top) + finite(rect?.bottom)) / 2,
  });
}

export function facilityFootprintBounds(definition) {
  const footprint = definition?.footprint;
  if (!footprint) return null;
  return Object.freeze({
    left: finite(footprint.x),
    right: finite(footprint.x) + Math.max(1, finite(footprint.width, 1)),
    top: finite(footprint.y),
    bottom: finite(footprint.y) + Math.max(1, finite(footprint.height, 1)),
  });
}

export function canonicalFacilityDefinition(definition) {
  return definition ? Object.freeze(withoutFields(definition, FACILITY_DERIVED_FIELDS)) : null;
}

export function canonicalBedDefinition(definition) {
  return definition ? Object.freeze(withoutFields(definition, BED_DERIVED_FIELDS)) : null;
}

export function hydrateFacilityRuntimeDefinition(definition) {
  if (!definition?.footprint) return definition;
  const canonical = canonicalFacilityDefinition(definition);
  const center = rectCenter(facilityFootprintBounds(canonical));
  return Object.freeze({
    ...canonical,
    position: center,
    usePosition: center,
    presentationPose: null,
    requiresFacing: true,
    facingDotThreshold: 0,
    targetingMode: "facing-first",
    targetingGroup: PLACEABLE_TARGETING_GROUP,
  });
}

export function liveFacilityGeometry(definition, profile = {}, collider = null) {
  const footprint = facilityFootprintBounds(definition);
  if (!footprint) return null;
  const visual = definition.visual ?? {
    x: footprint.left,
    y: footprint.top,
    width: footprint.right - footprint.left,
    height: footprint.bottom - footprint.top,
  };
  const visualOffset = profile.visualOffset ?? { x: 0, y: 0 };
  const visualOrigin = Object.freeze({
    x: finite(visual.x, footprint.left) + finite(visualOffset.x),
    y: finite(visual.y, footprint.top) + finite(visualOffset.y),
  });
  const visualSize = Object.freeze({
    width: Math.max(1, finite(visual.width, footprint.right - footprint.left)),
    height: Math.max(1, finite(visual.height, footprint.bottom - footprint.top)),
  });
  const currentCollider = collider ?? footprint;
  const pivotOffset = profile.snapAnchorOffset ?? {
    x: visualSize.width / 2,
    y: visualSize.height,
  };
  return Object.freeze({
    footprint,
    collider: Object.freeze({ ...currentCollider }),
    visualOrigin,
    visualCenter: Object.freeze({
      x: visualOrigin.x + visualSize.width / 2,
      y: visualOrigin.y + visualSize.height / 2,
    }),
    interactionCenter: rectCenter(currentCollider),
    pivotOffset: Object.freeze({ x: finite(pivotOffset.x), y: finite(pivotOffset.y) }),
    visualSize,
  });
}

export function liveBedGeometry(footprint, profile = {}, collider = null) {
  if (!footprint) return null;
  const visualOffset = profile.visualOffset ?? { x: 0, y: 0 };
  const currentCollider = collider ?? footprint;
  return Object.freeze({
    footprint: Object.freeze({ ...footprint }),
    collider: Object.freeze({ ...currentCollider }),
    visualCenter: Object.freeze({
      x: (finite(footprint.left) + finite(footprint.right)) / 2 + finite(visualOffset.x),
      y: (finite(footprint.top) + finite(footprint.bottom)) / 2 + finite(visualOffset.y),
    }),
    interactionCenter: rectCenter(currentCollider),
  });
}

export function livePlaceableInteraction(definition, geometry, { position = "interaction" } = {}) {
  if (!definition || !geometry) return definition;
  const canonical = withoutFields(definition, [
    "usePosition",
    "aimPosition",
    "presentationPose",
    "wakePosition",
  ]);
  return Object.freeze({
    ...canonical,
    position: position === "visual" ? geometry.visualCenter : geometry.interactionCenter,
    aimPosition: geometry.interactionCenter,
    requiresFacing: true,
    facingDotThreshold: 0,
    targetingMode: "facing-first",
    targetingGroup: PLACEABLE_TARGETING_GROUP,
  });
}

export function liveFacilityPresentationPose(definition, geometry) {
  if (!definition || !geometry || !["shower", "toilet"].includes(definition.facilityType)) return null;
  return Object.freeze({
    x: geometry.visualCenter.x,
    y: geometry.visualCenter.y,
    facing: "down",
    angle: 0,
    depth: assetDepthFromPivot(
      geometry.visualOrigin,
      geometry.pivotOffset,
      501,
      `${definition.id}:pose`,
    ),
  });
}
