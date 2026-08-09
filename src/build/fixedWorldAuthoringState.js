export const FIXED_WORLD_AUTHORING_VERSION = 1;
export const FIXED_WORLD_AUTHORING_STORAGE_KEY = "nestledBurrow.fixedWorldAuthoring";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeInstance(value = {}) {
  return Object.freeze({
    x: Math.round(finite(value.x)),
    y: Math.round(finite(value.y)),
    collisionEnabled: value.collisionEnabled !== false,
  });
}

export function normalizeFixedWorldAuthoring(value = {}) {
  const source = value?.version === FIXED_WORLD_AUTHORING_VERSION && value.instances
    ? value.instances
    : value?.instances ?? {};
  const instances = Object.fromEntries(
    Object.entries(source)
      .filter(([id, instance]) => typeof id === "string" && id.length > 0 && instance && typeof instance === "object")
      .map(([id, instance]) => [id, normalizeInstance(instance)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return Object.freeze({
    version: FIXED_WORLD_AUTHORING_VERSION,
    instances: Object.freeze(instances),
  });
}

export function loadFixedWorldAuthoring(storage = globalThis.localStorage) {
  const source = storage?.getItem?.(FIXED_WORLD_AUTHORING_STORAGE_KEY);
  if (!source) return normalizeFixedWorldAuthoring();
  try {
    return normalizeFixedWorldAuthoring(JSON.parse(source));
  } catch {
    return normalizeFixedWorldAuthoring();
  }
}

export function saveFixedWorldAuthoring(value, storage = globalThis.localStorage) {
  const normalized = normalizeFixedWorldAuthoring(value);
  storage?.setItem?.(FIXED_WORLD_AUTHORING_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resolveFixedWorldInstance(id, fallback, storage = globalThis.localStorage) {
  const stored = loadFixedWorldAuthoring(storage).instances[id];
  return Object.freeze({
    x: stored?.x ?? Math.round(finite(fallback?.x)),
    y: stored?.y ?? Math.round(finite(fallback?.y)),
    collisionEnabled: stored?.collisionEnabled !== false,
  });
}

export function updateFixedWorldInstance(id, patch, fallback, storage = globalThis.localStorage) {
  if (typeof id !== "string" || !id) throw new Error("Fixed-world instance requires a stable ID");
  const currentState = loadFixedWorldAuthoring(storage);
  const current = resolveFixedWorldInstance(id, fallback, storage);
  const next = normalizeInstance({ ...current, ...patch });
  saveFixedWorldAuthoring({
    version: FIXED_WORLD_AUTHORING_VERSION,
    instances: { ...currentState.instances, [id]: next },
  }, storage);
  return next;
}

export function clearFixedWorldAuthoring(storage = globalThis.localStorage) {
  storage?.removeItem?.(FIXED_WORLD_AUTHORING_STORAGE_KEY);
}
