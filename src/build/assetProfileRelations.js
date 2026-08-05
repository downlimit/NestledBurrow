function finitePoint(value = {}) {
  return {
    x: Number.isFinite(Number(value.x)) ? Number(value.x) : 0,
    y: Number.isFinite(Number(value.y)) ? Number(value.y) : 0,
  };
}

export function canonicalVisualOffsetAtCurrentPivot(currentProfile = {}, canonicalProfile = {}) {
  const currentPivot = finitePoint(currentProfile.snapAnchorOffset);
  const canonicalPivot = finitePoint(canonicalProfile.snapAnchorOffset);
  const canonicalVisual = finitePoint(canonicalProfile.visualOffset);
  return Object.freeze({
    x: Math.round(currentPivot.x + canonicalVisual.x - canonicalPivot.x),
    y: Math.round(currentPivot.y + canonicalVisual.y - canonicalPivot.y),
  });
}

export function visualToPivotOffset(profile = {}) {
  const pivot = finitePoint(profile.snapAnchorOffset);
  const visual = finitePoint(profile.visualOffset);
  return Object.freeze({
    x: visual.x - pivot.x,
    y: visual.y - pivot.y,
  });
}
