export const ASSET_PROFILES_STORAGE_KEY = "nestledBurrow.assetProfiles";

const RESOURCE_PROFILE_KEYS = ["log-small", "log-large", "stone-small", "stone-large", "ruby-node", "tree-planted"];
const FACILITY_PROFILE_KEYS = ["shower", "toilet", "table", "cutting-table", "gas-stove", "serving-table"];

export const DEFAULT_ASSET_PROFILES = Object.freeze({
  ...Object.fromEntries(RESOURCE_PROFILE_KEYS.map((id) => [`resource:${id}`, Object.freeze({ family: "resource", colliderOffsets: Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 }), visualOffset: Object.freeze({ x: 0, y: 0 }) })])),
  ...Object.fromEntries(FACILITY_PROFILE_KEYS.map((id) => [`facility:${id}`, Object.freeze({ family: "facility", colliderOffsets: Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 }), visualOffset: Object.freeze({ x: 0, y: 0 }) })])),
  "furniture:bed": Object.freeze({ family: "furniture", colliderOffsets: Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 }), visualOffset: Object.freeze({ x: 0, y: 0 }) }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function normalizeOffsets(value = {}) {
  return Object.freeze({
    left: finite(value.left), right: finite(value.right), top: finite(value.top), bottom: finite(value.bottom),
  });
}

function normalizeVisualOffset(value = {}) {
  return Object.freeze({ x: finite(value.x), y: finite(value.y) });
}

export function normalizeAssetProfiles(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Asset profiles must be an object");
  const profiles = {};
  for (const key of Object.keys(DEFAULT_ASSET_PROFILES)) {
    const source = value[key] ?? DEFAULT_ASSET_PROFILES[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error(`Asset profile ${key} is invalid`);
    profiles[key] = Object.freeze({
      family: DEFAULT_ASSET_PROFILES[key].family,
      colliderOffsets: normalizeOffsets(source.colliderOffsets),
      visualOffset: normalizeVisualOffset(source.visualOffset),
    });
  }
  return Object.freeze(profiles);
}

export function migrateLegacyColliderOverrides(overrides = {}) {
  return normalizeAssetProfiles(Object.fromEntries(
    Object.keys(DEFAULT_ASSET_PROFILES).map((key) => [key, { colliderOffsets: overrides[key] ?? {} }]),
  ));
}

export function loadAssetProfiles(storage = globalThis.localStorage, legacyColliderOverrides = {}) {
  try {
    const raw = storage?.getItem?.(ASSET_PROFILES_STORAGE_KEY);
    return raw ? normalizeAssetProfiles(JSON.parse(raw)) : migrateLegacyColliderOverrides(legacyColliderOverrides);
  } catch {
    return migrateLegacyColliderOverrides(legacyColliderOverrides);
  }
}

export function saveAssetProfiles(profiles, storage = globalThis.localStorage) {
  const normalized = normalizeAssetProfiles(profiles);
  storage?.setItem?.(ASSET_PROFILES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
