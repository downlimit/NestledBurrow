import {
  COLLIDER_DEBUG_STORAGE_KEY,
  loadColliderDebugOverrides,
  normalizeColliderOverrides,
  saveColliderDebugOverrides,
} from "./colliderDebugOverrides.js";
import {
  STARTING_LAYOUT_STORAGE_KEY,
  normalizeStartingLayout,
} from "./startingLayout.js";
import {
  ASSET_PROFILES_STORAGE_KEY,
  loadAssetProfiles,
  normalizeAssetProfiles,
  saveAssetProfiles,
} from "./assetProfiles.js";
import { migrateDirectionalWallOverrides } from "./buildWorldGeometry.js";

export const AUTHORING_BACKUP_VERSION = 3;
export const AUTHORING_BACKUP_FILENAME = "nestledburrow-authoring-backup.json";

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function readStoredLayout(storage) {
  const source = storage?.getItem?.(STARTING_LAYOUT_STORAGE_KEY);
  return source ? normalizeStartingLayout(JSON.parse(source)) : null;
}

export function normalizeAuthoringBackup(value) {
  assertRecord(value, "Authoring backup");
  if (value.version === 1) {
    return {
      version: AUTHORING_BACKUP_VERSION,
      savedAt: typeof value.savedAt === "string" ? value.savedAt : null,
      startingLayout: value.startingLayout ? normalizeStartingLayout(value.startingLayout) : null,
      colliderOverrides: migrateDirectionalWallOverrides(normalizeColliderOverrides(value.colliderOverrides ?? {})),
      assetProfiles: loadAssetProfiles(null, value.colliderOverrides ?? {}),
    };
  }
  if (value.version === 2) {
    return {
      version: AUTHORING_BACKUP_VERSION,
      savedAt: typeof value.savedAt === "string" ? value.savedAt : null,
      startingLayout: value.startingLayout ? normalizeStartingLayout(value.startingLayout) : null,
      colliderOverrides: migrateDirectionalWallOverrides(normalizeColliderOverrides(value.colliderOverrides ?? {})),
      assetProfiles: normalizeAssetProfiles(value.assetProfiles ?? {}),
    };
  }
  if (value.version !== AUTHORING_BACKUP_VERSION) {
    throw new Error(`Unsupported authoring backup version: ${String(value.version)}`);
  }
  return {
    version: AUTHORING_BACKUP_VERSION,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : null,
    startingLayout: value.startingLayout ? normalizeStartingLayout(value.startingLayout) : null,
    colliderOverrides: migrateDirectionalWallOverrides(normalizeColliderOverrides(value.colliderOverrides ?? {})),
    assetProfiles: normalizeAssetProfiles(value.assetProfiles ?? {}),
  };
}

export function createAuthoringBackup(storage = globalThis.localStorage, now = new Date()) {
  return normalizeAuthoringBackup({
    version: AUTHORING_BACKUP_VERSION,
    savedAt: now.toISOString(),
    startingLayout: readStoredLayout(storage),
    colliderOverrides: loadColliderDebugOverrides(storage),
    assetProfiles: loadAssetProfiles(storage, loadColliderDebugOverrides(storage)),
  });
}

export function createAuthoringBackupSource(value) {
  return `${JSON.stringify(normalizeAuthoringBackup(value), null, 2)}\n`;
}

export function restoreAuthoringBackup(value, storage = globalThis.localStorage) {
  const backup = normalizeAuthoringBackup(value);
  if (backup.startingLayout) {
    storage?.setItem?.(STARTING_LAYOUT_STORAGE_KEY, JSON.stringify(backup.startingLayout));
  } else {
    storage?.removeItem?.(STARTING_LAYOUT_STORAGE_KEY);
  }
  saveColliderDebugOverrides(backup.colliderOverrides, storage);
  saveAssetProfiles(backup.assetProfiles, storage);
  return backup;
}

export function clearAuthoringBackupDraft(storage = globalThis.localStorage) {
  storage?.removeItem?.(STARTING_LAYOUT_STORAGE_KEY);
  storage?.removeItem?.(COLLIDER_DEBUG_STORAGE_KEY);
  storage?.removeItem?.(ASSET_PROFILES_STORAGE_KEY);
}
