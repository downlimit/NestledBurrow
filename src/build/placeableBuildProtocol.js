export const PLACEABLE_BUILD_OPERATIONS = Object.freeze([
  "place",
  "move",
  "remove",
  "restore",
]);

export const PLACEABLE_BUILD_OWNER_IDS = Object.freeze({
  bed: "bed",
  facility: "facility",
  resource: "resource",
  well: "well",
});

export function definePlaceableCatalogItem(ownerId, item = {}) {
  if (typeof ownerId !== "string" || ownerId.trim() === "") {
    throw new Error("Placeable catalog item requires an owner ID");
  }
  if (!item?.id || !item?.placement) {
    throw new Error(`Placeable catalog item for ${ownerId} requires id and placement`);
  }
  return Object.freeze({
    ...item,
    objectLike: true,
    placeableOwner: ownerId,
  });
}

export function placeableOwnerIdForItem(item) {
  return item?.objectLike ? item.placeableOwner ?? null : null;
}

export function assertPlaceableOwnerAdapter(adapter) {
  if (!adapter || typeof adapter.id !== "string" || adapter.id.trim() === "") {
    throw new Error("Placeable owner adapter requires a stable ID");
  }
  for (const operation of PLACEABLE_BUILD_OPERATIONS) {
    if (typeof adapter[operation] !== "function") {
      throw new Error(`Placeable owner ${adapter.id} must implement ${operation}`);
    }
  }
  if (typeof adapter.getTargetAt !== "function") {
    throw new Error(`Placeable owner ${adapter.id} must implement getTargetAt`);
  }
  if (typeof adapter.isPlacementBlocked !== "function") {
    throw new Error(`Placeable owner ${adapter.id} must implement isPlacementBlocked`);
  }
  return adapter;
}

export function validatePlaceableCatalog(groups, ownerIds) {
  const available = new Set(ownerIds);
  const missing = [];
  for (const item of groups.flatMap((group) => group.items ?? [])) {
    const ownerId = placeableOwnerIdForItem(item);
    if (!ownerId) continue;
    if (!available.has(ownerId)) missing.push(`${item.id}:${ownerId}`);
  }
  if (missing.length) {
    throw new Error(`Placeable catalog items without full lifecycle owners: ${missing.join(", ")}`);
  }
  return true;
}
