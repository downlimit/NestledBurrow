import { TILE_SIZE } from "./worldConfig.js";

export const STARTING_LAYOUT_STORAGE_KEY = "nestledBurrow.startingLayout";
export const STARTING_LAYOUT_VERSION = 1;
export const STARTING_LAYOUT_SAVE_ENDPOINT = "__nestledburrow/save-starting-layout";

const BUILD_KINDS = new Set(["wall", "wall-node", "ground", "floor", "carpet", "tree", "plant", "placed"]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function normalizeStringArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return [...new Set(value.map((item) => {
    if (typeof item !== "string" || item.length === 0) throw new Error(`${label} contains an invalid ID`);
    return item;
  }))].sort();
}

function normalizePoint(value, label) {
  assertRecord(value, label);
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} must contain finite coordinates`);
  const result = { x, y };
  if (value.orientation !== undefined) {
    if (value.orientation !== "horizontal" && value.orientation !== "vertical") {
      throw new Error(`${label}.orientation is invalid`);
    }
    result.orientation = value.orientation;
  }
  return result;
}

function normalizeRect(value, label) {
  assertRecord(value, label);
  const rect = {};
  for (const key of ["left", "right", "top", "bottom"]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number)) throw new Error(`${label}.${key} must be finite`);
    rect[key] = number;
  }
  if (rect.right <= rect.left || rect.bottom <= rect.top) throw new Error(`${label} must have positive size`);
  return rect;
}

function normalizeBuildObject(value, index) {
  assertRecord(value, `buildObjects[${index}]`);
  if (typeof value.id !== "string" || value.id.length === 0) throw new Error(`buildObjects[${index}].id is invalid`);
  if (!BUILD_KINDS.has(value.kind)) throw new Error(`buildObjects[${index}].kind is invalid`);
  assertRecord(value.item, `buildObjects[${index}].item`);
  const collider = Boolean(value.collider);
  const normalized = {
    id: value.id,
    kind: value.kind,
    item: cloneJson(value.item),
    point: normalizePoint(value.point, `buildObjects[${index}].point`),
    bounds: normalizeRect(value.bounds, `buildObjects[${index}].bounds`),
    collider,
  };
  if (value.material !== undefined) normalized.material = String(value.material);
  if (value.textureKey !== undefined) normalized.textureKey = String(value.textureKey);
  if (collider) {
    normalized.colliderBounds = normalizeRect(value.colliderBounds, `buildObjects[${index}].colliderBounds`);
    normalized.colliderGroup = typeof value.colliderGroup === "string" && value.colliderGroup
      ? value.colliderGroup
      : value.id;
  }
  return normalized;
}

function normalizeDefinitionArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const ids = new Set();
  const result = value.map((definition, index) => {
    assertRecord(definition, `${label}[${index}]`);
    if (typeof definition.id !== "string" || definition.id.length === 0) {
      throw new Error(`${label}[${index}].id is invalid`);
    }
    if (ids.has(definition.id)) throw new Error(`${label} contains duplicate ID ${definition.id}`);
    ids.add(definition.id);
    return cloneJson(definition);
  });
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeStartingLayout(value) {
  assertRecord(value, "Starting layout");
  if (value.version !== STARTING_LAYOUT_VERSION) {
    throw new Error(`Unsupported starting layout version: ${String(value.version)}`);
  }
  if (!Array.isArray(value.buildObjects)) throw new Error("buildObjects must be an array");
  const buildObjects = value.buildObjects.map(normalizeBuildObject).sort((a, b) => a.id.localeCompare(b.id));
  const buildIds = new Set();
  for (const object of buildObjects) {
    if (buildIds.has(object.id)) throw new Error(`buildObjects contains duplicate ID ${object.id}`);
    buildIds.add(object.id);
  }
  const nextBuildObjectId = Number(value.nextBuildObjectId);
  if (!Number.isInteger(nextBuildObjectId) || nextBuildObjectId < 0) {
    throw new Error("nextBuildObjectId must be a non-negative integer");
  }
  return {
    version: STARTING_LAYOUT_VERSION,
    nextBuildObjectId,
    removedCanonicalFloors: normalizeStringArray(value.removedCanonicalFloors ?? [], "removedCanonicalFloors"),
    removedCanonicalWalls: normalizeStringArray(value.removedCanonicalWalls ?? [], "removedCanonicalWalls"),
    buildObjects,
    facilities: normalizeDefinitionArray(value.facilities ?? [], "facilities"),
    beds: normalizeDefinitionArray(value.beds ?? [], "beds"),
  };
}

export function createStartingLayoutModuleSource(value) {
  const normalized = normalizeStartingLayout(value);
  return `// Generated by the in-game debug authoring action.\nexport default ${JSON.stringify(normalized, null, 2)};\n`;
}

function shouldCaptureBuildObject(scene, object) {
  const isResource = Boolean(object?.item?.resourceProfileId) || object?.kind === "plant";
  if (!isResource) return true;
  return !scene.sessionState?.gameplay?.resourceNodes?.[object.id]?.cleared;
}

export function captureStartingLayout(scene) {
  if (!scene?.buildPlacedObjects || !scene?.worldLayout) throw new Error("Build mode is not ready");
  const canonicalFloorKeys = scene.worldLayout.houseFloorTiles.map((tile) => scene.buildCellKey({
    x: tile.x * TILE_SIZE,
    y: tile.y * TILE_SIZE,
  }));
  const canonicalWallIds = scene.worldLayout.houseWallTiles.map((tile) => tile.id);
  const buildObjects = [...scene.buildPlacedObjects.values()]
    .filter((object) => shouldCaptureBuildObject(scene, object))
    .map((object) => {
      const { sprites: _sprites, resourceDefinition: _resourceDefinition, resourceCleared: _resourceCleared, ...serializable } = object;
      return cloneJson(serializable);
    });
  return normalizeStartingLayout({
    version: STARTING_LAYOUT_VERSION,
    nextBuildObjectId: Number(scene.nextBuildObjectId) || 0,
    removedCanonicalFloors: canonicalFloorKeys.filter((key) => !scene.floorSprites.has(key)),
    removedCanonicalWalls: canonicalWallIds.filter((id) => !scene.wallSprites.has(id)),
    buildObjects,
    facilities: scene.facilityRuntime?.getDefinitions?.() ?? [],
    beds: scene.debrisRuntime?.getBedDefinitions?.() ?? [],
  });
}

export function saveStartingLayout(scene, storage = globalThis.localStorage) {
  const layout = captureStartingLayout(scene);
  storage?.setItem(STARTING_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  return layout;
}

export async function saveStartingLayoutToProject(scene, {
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  baseUrl = import.meta.env?.BASE_URL ?? "/",
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable");
  const previous = storage?.getItem?.(STARTING_LAYOUT_STORAGE_KEY) ?? null;
  const layout = saveStartingLayout(scene, storage);
  try {
    const response = await fetchImpl(`${baseUrl}${STARTING_LAYOUT_SAVE_ENDPOINT}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(layout),
    });
    if (!response?.ok) {
      const detail = await response?.text?.().catch?.(() => "") ?? "";
      throw new Error(detail || `Authoring endpoint returned HTTP ${response?.status ?? "unknown"}`);
    }
    return layout;
  } catch (error) {
    if (previous === null) storage?.removeItem?.(STARTING_LAYOUT_STORAGE_KEY);
    else storage?.setItem?.(STARTING_LAYOUT_STORAGE_KEY, previous);
    throw error;
  }
}

export function loadStartingLayout(storage = globalThis.localStorage, projectDefault = null) {
  const source = storage?.getItem?.(STARTING_LAYOUT_STORAGE_KEY);
  if (source) return normalizeStartingLayout(JSON.parse(source));
  return projectDefault ? normalizeStartingLayout(projectDefault) : null;
}

function removeCanonicalWalls(scene, removedIds) {
  for (const id of removedIds) {
    const entry = scene.wallSprites?.get?.(id);
    if (!entry) continue;
    const rawX = entry.tile.worldX + TILE_SIZE / 2;
    const rawY = entry.tile.worldY + TILE_SIZE / 2;
    scene.demolishBuildObject?.({ x: entry.tile.worldX, y: entry.tile.worldY, rawX, rawY }, "wall");
  }
}

function restoreFacilities(scene, definitions) {
  const runtime = scene.facilityRuntime;
  if (!runtime) return;
  const desiredIds = new Set(definitions.map((definition) => definition.id));
  const currentDefinitions = runtime.getDefinitions();
  for (const current of currentDefinitions) {
    if (current.editable === false && !desiredIds.has(current.id)) {
      throw new Error(`Starting layout is missing fixed facility ${current.id}`);
    }
  }
  currentDefinitions.forEach((current, index) => {
    const staged = runtime.move(current.id, { x: -10000 - index * 256, y: -10000 });
    if (!staged) throw new Error(`Failed to stage facility ${current.id}`);
  });
  for (const current of currentDefinitions) {
    if (!desiredIds.has(current.id) && current.editable !== false && !runtime.remove(current.id)) {
      throw new Error(`Failed to remove facility ${current.id}`);
    }
  }
  for (const definition of definitions) {
    const restored = runtime.getDefinition(definition.id)
      ? runtime.replace(definition)
      : runtime.restore(definition);
    if (!restored) throw new Error(`Failed to restore facility ${definition.id}`);
  }
  runtime.syncKitchenVisuals?.();
}

function restoreBeds(scene, definitions) {
  const runtime = scene.debrisRuntime;
  if (!runtime) return;
  for (const current of runtime.getBedDefinitions()) runtime.removeBed(current.id);
  for (const definition of definitions) {
    if (!runtime.restoreBed(definition)) throw new Error(`Failed to restore bed ${definition.id}`);
  }
}

export function applyStartingLayout(scene, value) {
  const layout = normalizeStartingLayout(value);
  if (!scene?.buildPlacedObjects || !scene?.worldLayout) throw new Error("Build mode is not ready");

  for (const id of [...scene.buildPlacedObjects.keys()]) scene.removeBuildPlacedObjectById(id);

  for (const key of layout.removedCanonicalFloors) {
    const floor = scene.floorSprites?.get?.(key);
    floor?.sprite?.destroy?.();
    scene.floorSprites?.delete?.(key);
  }
  removeCanonicalWalls(scene, layout.removedCanonicalWalls);

  for (const object of layout.buildObjects) {
    if (!scene.restoreBuildPlacedObject(cloneJson(object))) {
      throw new Error(`Failed to restore build object ${object.id}`);
    }
  }
  scene.nextBuildObjectId = Math.max(Number(scene.nextBuildObjectId) || 0, layout.nextBuildObjectId);

  restoreFacilities(scene, layout.facilities);
  restoreBeds(scene, layout.beds);
  scene.facilityRuntime?.syncKitchenVisuals?.();
  scene.interactionRuntime?.refresh?.();
  scene.clearBuildPreview?.();
  return layout;
}
