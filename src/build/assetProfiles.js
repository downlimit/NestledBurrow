import { FACILITY_ASSETS } from "../facilities/facilityConfig.js";
import { RESOURCE_PROFILES } from "../resources/resourceDomain.js";
import { INTERACTION_APPROACH_DIRECTIONS, normalizeInteractionDirections } from "../interaction/interactionDirections.js";
import { TILE_SIZE } from "../world/worldConfig.js";
import { COLLIDER_DEBUG_STORAGE_KEY } from "./colliderDebugOverrides.js";
import PROJECT_ASSET_PROFILES from "./assetProfilesDefault.js";

export const ASSET_PROFILES_STORAGE_KEY = "nestledBurrow.assetProfiles";
export const ASSET_PROFILES_SAVE_ENDPOINT = "__nestledburrow/save-asset-profiles";
export const ASSET_PROFILES_VERSION = 3;

const RESOURCE_PROFILE_KEYS = Object.keys(RESOURCE_PROFILES);
const FACILITY_PROFILE_KEYS = Object.keys(FACILITY_ASSETS);
const point = (x, y) => Object.freeze({ x, y });
const offsets = () => Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 });
const cropInsets = () => Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 });
const defaultResourcePivot = (id) => id === "tree-planted"
  ? point(TILE_SIZE * 1.5, TILE_SIZE * 4)
  : point(
      RESOURCE_PROFILES[id].footprint.width * TILE_SIZE / 4,
      RESOURCE_PROFILES[id].footprint.height * TILE_SIZE / 4,
    );

const BASE_ASSET_PROFILES = Object.freeze({
  ...Object.fromEntries(RESOURCE_PROFILE_KEYS.map((id) => [`resource:${id}`, Object.freeze({
    family: "resource",
    colliderOffsets: offsets(),
    visualOffset: point(0, 0),
    snapAnchorOffset: defaultResourcePivot(id),
    visualCropInsets: cropInsets(),
    interactionDirections: INTERACTION_APPROACH_DIRECTIONS,
  })])),
  ...Object.fromEntries(FACILITY_PROFILE_KEYS.map((id) => [`facility:${id}`, Object.freeze({
    family: "facility",
    colliderOffsets: offsets(),
    visualOffset: point(0, 0),
    snapAnchorOffset: point(FACILITY_ASSETS[id].width / 2, FACILITY_ASSETS[id].height),
    visualCropInsets: cropInsets(),
    interactionDirections: INTERACTION_APPROACH_DIRECTIONS,
  })])),
  "furniture:bed": Object.freeze({
    family: "furniture",
    colliderOffsets: offsets(),
    visualOffset: point(0, 0),
    snapAnchorOffset: point(TILE_SIZE / 2, TILE_SIZE / 2),
    visualCropInsets: cropInsets(),
    interactionDirections: INTERACTION_APPROACH_DIRECTIONS,
  }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finite(value, fallback));
}

function normalizeOffsets(value = {}, fallback = offsets()) {
  return Object.freeze({
    left: finite(value.left, fallback.left),
    right: finite(value.right, fallback.right),
    top: finite(value.top, fallback.top),
    bottom: finite(value.bottom, fallback.bottom),
  });
}

function normalizeVisualOffset(value = {}, fallback = point(0, 0)) {
  return Object.freeze({
    x: finite(value.x, fallback.x),
    y: finite(value.y, fallback.y),
  });
}

export function normalizeVisualCropInsets(value = {}, fallback = cropInsets()) {
  return Object.freeze({
    left: nonNegative(value.left, fallback.left),
    right: nonNegative(value.right, fallback.right),
    top: nonNegative(value.top, fallback.top),
    bottom: nonNegative(value.bottom, fallback.bottom),
  });
}

function projectDefaultSource() {
  if (!PROJECT_ASSET_PROFILES || typeof PROJECT_ASSET_PROFILES !== "object") return {};
  return PROJECT_ASSET_PROFILES.profiles ?? PROJECT_ASSET_PROFILES;
}

function normalizeProfile(source, fallback) {
  return Object.freeze({
    family: fallback.family,
    colliderOffsets: normalizeOffsets(source?.colliderOffsets, fallback.colliderOffsets),
    visualOffset: normalizeVisualOffset(source?.visualOffset, fallback.visualOffset),
    snapAnchorOffset: normalizeVisualOffset(source?.snapAnchorOffset, fallback.snapAnchorOffset),
    visualCropInsets: normalizeVisualCropInsets(source?.visualCropInsets, fallback.visualCropInsets),
    interactionDirections: normalizeInteractionDirections(source?.interactionDirections, fallback.interactionDirections),
  });
}

export const DEFAULT_ASSET_PROFILES = Object.freeze(Object.fromEntries(
  Object.entries(BASE_ASSET_PROFILES).map(([key, fallback]) => [
    key,
    normalizeProfile(projectDefaultSource()[key], fallback),
  ]),
));

export function normalizeAssetProfiles(value = {}) {
  if (value?.version !== undefined && ![1, 2, ASSET_PROFILES_VERSION].includes(value.version)) {
    throw new Error(`Unsupported asset profiles version: ${String(value.version)}`);
  }
  const sourceProfiles = value?.version !== undefined ? value.profiles ?? {} : value;
  if (!sourceProfiles || typeof sourceProfiles !== "object" || Array.isArray(sourceProfiles)) {
    throw new Error("Asset profiles must be an object");
  }
  const profiles = {};
  for (const key of Object.keys(DEFAULT_ASSET_PROFILES)) {
    const source = sourceProfiles[key] ?? DEFAULT_ASSET_PROFILES[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error(`Asset profile ${key} is invalid`);
    }
    profiles[key] = normalizeProfile(source, DEFAULT_ASSET_PROFILES[key]);
  }
  return Object.freeze(profiles);
}

export function migrateLegacyColliderOverrides(overrides = {}) {
  return normalizeAssetProfiles({
    version: ASSET_PROFILES_VERSION,
    profiles: Object.fromEntries(Object.keys(DEFAULT_ASSET_PROFILES).map((key) => [key, {
      ...DEFAULT_ASSET_PROFILES[key],
      colliderOffsets: overrides[key] ?? DEFAULT_ASSET_PROFILES[key].colliderOffsets,
    }])),
  });
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

export function createAssetProfilesDefaultModuleSource(value) {
  const normalized = normalizeAssetProfiles(value);
  return `// Generated by the in-game asset profile editor.\nexport default ${JSON.stringify({
    version: ASSET_PROFILES_VERSION,
    profiles: normalized,
  }, null, 2)};\n`;
}

function markLocalAssetProfileSave(error, normalized) {
  const failure = error instanceof Error ? error : new Error(String(error));
  failure.localSaved = true;
  failure.savedValue = normalized;
  return failure;
}

export async function saveAssetProfilesToProject(profiles, {
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  baseUrl = import.meta.env?.BASE_URL ?? "/",
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable");
  const normalized = saveAssetProfiles(profiles, storage);
  try {
    const response = await fetchImpl(`${baseUrl}${ASSET_PROFILES_SAVE_ENDPOINT}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: ASSET_PROFILES_VERSION, profiles: normalized }),
    });
    if (!response?.ok) {
      const detail = await response?.text?.().catch?.(() => "") ?? "";
      throw new Error(detail || `Authoring endpoint returned HTTP ${response?.status ?? "unknown"}`);
    }
  } catch (error) {
    throw markLocalAssetProfileSave(error, normalized);
  }
  storage?.removeItem?.(ASSET_PROFILES_STORAGE_KEY);
  storage?.removeItem?.(COLLIDER_DEBUG_STORAGE_KEY);
  return normalized;
}
