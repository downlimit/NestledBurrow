import { FACILITY_ASSETS } from "../facilities/facilityConfig.js";
import { RESOURCE_PROFILES } from "../resources/resourceDomain.js";
import { TILE_SIZE } from "../world/worldConfig.js";

export const ASSET_PROFILES_STORAGE_KEY = "nestledBurrow.assetProfiles";
export const ASSET_PROFILES_VERSION = 2;

const RESOURCE_PROFILE_KEYS = ["log-small", "log-large", "stone-small", "stone-large", "ruby-node", "tree-planted"];
const FACILITY_PROFILE_KEYS = ["shower", "toilet", "table", "cutting-table", "gas-stove", "serving-table"];
const point = (x, y) => Object.freeze({ x, y });
const offsets = () => Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 });
const defaultResourcePivot = (id) => id === "tree-planted"
  ? point(TILE_SIZE * 1.5, TILE_SIZE * 4)
  : point(
      RESOURCE_PROFILES[id].footprint.width * TILE_SIZE / 4,
      RESOURCE_PROFILES[id].footprint.height * TILE_SIZE / 4,
    );

export const DEFAULT_ASSET_PROFILES = Object.freeze({
  ...Object.fromEntries(RESOURCE_PROFILE_KEYS.map((id) => [`resource:${id}`, Object.freeze({ family: "resource", colliderOffsets: offsets(), visualOffset: point(0, 0), snapAnchorOffset: defaultResourcePivot(id) })])),
  ...Object.fromEntries(FACILITY_PROFILE_KEYS.map((id) => [`facility:${id}`, Object.freeze({ family: "facility", colliderOffsets: offsets(), visualOffset: point(0, 0), snapAnchorOffset: point(FACILITY_ASSETS[id].width / 2, FACILITY_ASSETS[id].height) })])),
  "furniture:bed": Object.freeze({ family: "furniture", colliderOffsets: offsets(), visualOffset: point(0, 0), snapAnchorOffset: point(TILE_SIZE / 2, TILE_SIZE / 2) }),
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
  if (value?.version !== undefined && ![1, ASSET_PROFILES_VERSION].includes(value.version)) {
    throw new Error(`Unsupported asset profiles version: ${String(value.version)}`);
  }
  const sourceProfiles = value?.version !== undefined ? value.profiles ?? {} : value;
  if (!sourceProfiles || typeof sourceProfiles !== "object" || Array.isArray(sourceProfiles)) throw new Error("Asset profiles must be an object");
  const profiles = {};
  for (const key of Object.keys(DEFAULT_ASSET_PROFILES)) {
    const source = sourceProfiles[key] ?? DEFAULT_ASSET_PROFILES[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error(`Asset profile ${key} is invalid`);
    profiles[key] = Object.freeze({
      family: DEFAULT_ASSET_PROFILES[key].family,
      colliderOffsets: normalizeOffsets(source.colliderOffsets),
      visualOffset: normalizeVisualOffset(source.visualOffset),
      snapAnchorOffset: normalizeVisualOffset(source.snapAnchorOffset ?? DEFAULT_ASSET_PROFILES[key].snapAnchorOffset),
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
  storage?.setItem?.(ASSET_PROFILES_STORAGE_KEY, JSON.stringify({
    version: ASSET_PROFILES_VERSION,
    profiles: normalized,
  }));
  return normalized;
}
