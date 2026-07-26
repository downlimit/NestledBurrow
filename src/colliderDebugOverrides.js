export const COLLIDER_DEBUG_STORAGE_KEY = "nestledBurrow.colliderDebug";

export function normalizeColliderOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [id, candidate] of Object.entries(value)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const offsets = {};
    let valid = true;
    for (const key of ["left", "right", "top", "bottom"]) {
      const number = Number(candidate[key]);
      if (!Number.isFinite(number)) { valid = false; break; }
      offsets[key] = Math.max(-64, Math.min(64, Math.round(number)));
    }
    if (valid) result[id] = offsets;
  }
  return result;
}

export function loadColliderDebugOverrides(storage = globalThis.localStorage) {
  try {
    return normalizeColliderOverrides(JSON.parse(storage?.getItem(COLLIDER_DEBUG_STORAGE_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export function saveColliderDebugOverrides(overrides, storage = globalThis.localStorage) {
  try {
    storage?.setItem(COLLIDER_DEBUG_STORAGE_KEY, JSON.stringify(normalizeColliderOverrides(overrides)));
    return true;
  } catch {
    return false;
  }
}
