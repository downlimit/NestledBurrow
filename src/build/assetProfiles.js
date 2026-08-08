import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { FACILITY_ASSETS } from "../facilities/facilityConfig.js";
import { INTERACTION_APPROACH_DIRECTIONS, normalizeInteractionDirections } from "../interaction/interactionDirections.js";
import { WELL_PROFILE } from "../resources/farmingConfig.js";
import { RESOURCE_PROFILES } from "../resources/resourceDomain.js";
import { TAVERN_SIGN } from "../tavern/guestConfig.js";
import {
  TILE_SIZE,
  WORLD_TRANSITION_ASSETS,
  WORLD_TRANSITION_PROFILE_KEYS,
} from "../world/worldConfig.js";
import { COLLIDER_DEBUG_STORAGE_KEY } from "./colliderDebugOverrides.js";
import PROJECT_ASSET_PROFILES from "./assetProfilesDefault.js";

export const ASSET_PROFILES_STORAGE_KEY = "nestledBurrow.assetProfiles";
export const ASSET_PROFILES_SAVE_ENDPOINT = "__nestledburrow/save-asset-profiles";
export const ASSET_PROFILES_VERSION = 5;

const TAVERN_SIGN_PROFILE_KEY = "facility:tavern-sign";
const LEGACY_TAVERN_SIGN_PROFILE_ORIGIN_OFFSET = Object.freeze({
  x: Number(TAVERN_SIGN.snapAnchorOffset?.x) || 0,
  y: Number(TAVERN_SIGN.snapAnchorOffset?.y) || 0,
});
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
const profile = (family, snapAnchorOffset, {
  interactionOffset = point(0, 0),
  interactionDirections = INTERACTION_APPROACH_DIRECTIONS,
} = {}) => Object.freeze({
  family,
  colliderOffsets: offsets(),
  visualOffset: point(0, 0),
  snapAnchorOffset,
  visualCropInsets: cropInsets(),
  interactionOffset,
  interactionDirections: Object.freeze([...interactionDirections]),
});

const BASE_ASSET_PROFILES = Object.freeze({
  ...Object.fromEntries(RESOURCE_PROFILE_KEYS.map((id) => [
    `resource:${id}`,
    profile("resource", defaultResourcePivot(id)),
  ])),
  ...Object.fromEntries(FACILITY_PROFILE_KEYS.map((id) => [
    `facility:${id}`,
    profile("facility", point(FACILITY_ASSETS[id].width / 2, FACILITY_ASSETS[id].height)),
  ])),
  "furniture:bed": profile("furniture", point(TILE_SIZE / 2, TILE_SIZE / 2)),
  "farming:well": profile("farming", point(WELL_PROFILE.depthAnchorOffset.x, WELL_PROFILE.depthAnchorOffset.y)),
  [TAVERN_SIGN_PROFILE_KEY]: profile("facility", point(0, 0)),
  "melee:training-dummy": profile(
    "melee",
    point(TRAINING_DUMMY.asset.depthAnchor.x, TRAINING_DUMMY.asset.depthAnchor.y),
  ),
  [WORLD_TRANSITION_PROFILE_KEYS.burrowToNest]: profile(
    "transition",
    point(WORLD_TRANSITION_ASSETS.burrowToNest.width / 2, WORLD_TRANSITION_ASSETS.burrowToNest.height),
    { interactionDirections: ["bottom"] },
  ),
  [WORLD_TRANSITION_PROFILE_KEYS.nestToBurrow]: profile(
    "transition",
    point(WORLD_TRANSITION_ASSETS.nestToBurrow.width / 2, -TILE_SIZE - 1),
    { interactionDirections: ["top"] },
  ),
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

function migrateLegacyProfileOrigins(sourceProfiles, version) {
  if (!sourceProfiles || typeof sourceProfiles !== "object" || Number(version) >= 4) {
    return sourceProfiles ?? {};
  }
  const sign = sourceProfiles[TAVERN_SIGN_PROFILE_KEY];
  if (!sign?.snapAnchorOffset) return sourceProfiles;
  return {
    ...sourceProfiles,
    [TAVERN_SIGN_PROFILE_KEY]: {
      ...sign,
      snapAnchorOffset: {
        x: finite(sign.snapAnchorOffset.x) - LEGACY_TAVERN_SIGN_PROFILE_ORIGIN_OFFSET.x,
        y: finite(sign.snapAnchorOffset.y) - LEGACY_TAVERN_SIGN_PROFILE_ORIGIN_OFFSET.y,
      },
    },
  };
}

function projectDefaultSource() {
  if (!PROJECT_ASSET_PROFILES || typeof PROJECT_ASSET_PROFILES !== "object") return {};
  const source = PROJECT_ASSET_PROFILES.profiles ?? PROJECT_ASSET_PROFILES;
  return migrateLegacyProfileOrigins(source, PROJECT_ASSET_PROFILES.version);
}

function normalizeProfile(source, fallback) {
  return Object.freeze({
    family: fallback.family,
    colliderOffsets: normalizeOffsets(source?.colliderOffsets, fallback.colliderOffsets),
    visualOffset: normalizeVisualOffset(source?.visualOffset, fallback.visualOffset),
    snapAnchorOffset: normalizeVisualOffset(source?.snapAnchorOffset, fallback.snapAnchorOffset),
    visualCropInsets: normalizeVisualCropInsets(source?.visualCropInsets, fallback.visualCropInsets),
    interactionOffset: normalizeVisualOffset(source?.interactionOffset, fallback.interactionOffset),
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
  if (value?.version !== undefined && ![1, 2, 3, 4, ASSET_PROFILES_VERSION].includes(value.version)) {
    throw new Error(`Unsupported asset profiles version: ${String(value.version)}`);
  }
  const rawProfiles = value?.version !== undefined ? value.profiles ?? {} : value;
  const sourceProfiles = migrateLegacyProfileOrigins(rawProfiles, value?.version);
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
