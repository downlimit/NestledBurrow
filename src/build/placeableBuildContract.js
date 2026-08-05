import { BuildModeRuntime } from "./buildModeRuntime.js";
import { assertPlaceableOwnerAdapter, placeableOwnerIdForItem } from "./placeableBuildProtocol.js";
import { createDefaultPlaceableBuildOwners } from "./placeableBuildOwners.js";
import { precisePoint } from "./placeableBuildGeometry.js";

const BUILD_MODE_PATCH = Symbol("nestledBurrowPlaceableBuildModePatch");
const COORDINATOR_PATCH = Symbol("nestledBurrowPlaceableBuildCoordinatorPatch");
const REGISTRY = Symbol("nestledBurrowPlaceableBuildRegistry");

export function installPlaceableBuildContract(scene, owners = {}) {
  const coordinator = owners.worldBuildCoordinator;
  if (!scene || !coordinator || coordinator[COORDINATOR_PATCH]) return coordinator ?? null;
  patchBuildModeRuntime();

  const adapters = createDefaultPlaceableBuildOwners(scene, owners, coordinator)
    .map(assertPlaceableOwnerAdapter);
  const registry = createRegistry(adapters);
  Object.defineProperty(coordinator, REGISTRY, { value: registry });
  patchCoordinator(coordinator, owners, registry);
  Object.defineProperty(coordinator, COORDINATOR_PATCH, { value: true });
  return coordinator;
}

export function getPlaceableBuildOwnerIds(coordinator) {
  return [...(coordinator?.[REGISTRY]?.byId?.keys?.() ?? [])];
}

function patchBuildModeRuntime() {
  if (BuildModeRuntime.prototype[BUILD_MODE_PATCH]) return;
  const originalGetActionPoint = BuildModeRuntime.prototype.getActionPoint;
  const originalContinuePanelDrag = BuildModeRuntime.prototype.continuePanelDrag;

  BuildModeRuntime.prototype.getActionPoint = function getPlaceableActionPoint(pointer, item, ...rest) {
    const normalized = item?.objectLike && !["bed", "facility", "tree"].includes(item.placement)
      ? { ...item, placement: "tree" }
      : item;
    return originalGetActionPoint.call(this, pointer, normalized, ...rest);
  };

  BuildModeRuntime.prototype.continuePanelDrag = function continuePlaceablePanelDrag(pointer) {
    const entry = this.panelDrag?.item;
    if (!entry?.item?.objectLike || ["bed", "facility", "tree"].includes(entry.item.placement)) {
      return originalContinuePanelDrag.call(this, pointer);
    }
    const originalItem = entry.item;
    entry.item = { ...originalItem, placement: "tree" };
    try {
      return originalContinuePanelDrag.call(this, pointer);
    } finally {
      entry.item = originalItem;
    }
  };

  Object.defineProperty(BuildModeRuntime.prototype, BUILD_MODE_PATCH, { value: true });
}

function createRegistry(adapters) {
  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  return {
    adapters,
    byId,
    ownerForItem(item) {
      const explicit = placeableOwnerIdForItem(item);
      if (explicit) return byId.get(explicit) ?? null;
      return adapters.find((adapter) => adapter.matchesItem?.(item)) ?? null;
    },
    ownerForTarget(target) {
      return target?.placeableOwnerId ? byId.get(target.placeableOwnerId) ?? null : null;
    },
    getTargetAt(point) {
      for (const adapter of adapters) {
        const target = adapter.getTargetAt(point);
        if (target) return normalizeTarget(adapter, target);
      }
      return null;
    },
  };
}

function normalizeTarget(adapter, target) {
  return {
    ...target,
    placeableOwnerId: adapter.id,
    demolitionType: target.demolitionType ?? adapter.id,
  };
}

function patchCoordinator(coordinator, owners, registry) {
  const original = {
    placeBuildAsset: coordinator.placeBuildAsset.bind(coordinator),
    isBuildObjectPlacementBlocked: coordinator.isBuildObjectPlacementBlocked.bind(coordinator),
    getBuildPlacementAnchorOffset: coordinator.getBuildPlacementAnchorOffset.bind(coordinator),
    getBuildMoveTarget: coordinator.getBuildMoveTarget.bind(coordinator),
    getBuildDemolitionPreviewTarget: coordinator.getBuildDemolitionPreviewTarget.bind(coordinator),
    applyBuildMove: coordinator.applyBuildMove.bind(coordinator),
    demolishBuildObject: coordinator.demolishBuildObject.bind(coordinator),
    renderBuildPreview: coordinator.renderBuildPreview.bind(coordinator),
    renderBuildMovePreview: coordinator.renderBuildMovePreview.bind(coordinator),
  };

  coordinator.registerPlaceableBuildOwner = (adapter) => {
    const normalized = assertPlaceableOwnerAdapter(adapter);
    registry.byId.set(normalized.id, normalized);
    const previousIndex = registry.adapters.findIndex(({ id }) => id === normalized.id);
    if (previousIndex >= 0) registry.adapters.splice(previousIndex, 1, normalized);
    else registry.adapters.push(normalized);
    return normalized;
  };
  coordinator.getPlaceableBuildOwnerIds = () => [...registry.byId.keys()];

  coordinator.getBuildPlacementAnchorOffset = (item) => {
    const adapter = registry.ownerForItem(item);
    return adapter?.getPlacementAnchorOffset?.(item) ?? original.getBuildPlacementAnchorOffset(item);
  };

  coordinator.isBuildObjectPlacementBlocked = (item, point) => {
    const adapter = registry.ownerForItem(item);
    return adapter ? adapter.isPlacementBlocked(item, point, null) : original.isBuildObjectPlacementBlocked(item, point);
  };

  coordinator.placeBuildAsset = (item, point, context = {}) => {
    const adapter = registry.ownerForItem(item);
    if (!adapter) return original.placeBuildAsset(item, point, context);
    const placed = adapter.place(item, point, context);
    if (!placed) return { status: "blocked" };
    adapter.afterMutation?.();
    return {
      status: "placed",
      id: placed.id ?? placed.definition?.id,
      definition: placed.definition ?? placed,
      undo: () => {
        adapter.remove({
          id: placed.id ?? placed.definition?.id,
          definition: placed.definition ?? placed,
        });
        adapter.afterMutation?.();
      },
    };
  };

  coordinator.getBuildMoveTarget = (point) => {
    const hit = precisePoint(point);
    const external = owners.tavernSignRuntime?.getBuildMoveTargetAt?.(hit)
      ?? owners.meleeRuntime?.getBuildMoveTargetAt?.(hit);
    return external ?? registry.getTargetAt(hit) ?? original.getBuildMoveTarget(point);
  };

  coordinator.getBuildDemolitionPreviewTarget = (point) => (
    registry.getTargetAt(precisePoint(point)) ?? original.getBuildDemolitionPreviewTarget(point)
  );

  coordinator.applyBuildMove = (target, point) => {
    const adapter = registry.ownerForTarget(target);
    if (!adapter) return original.applyBuildMove(target, point);
    const result = adapter.move(target, point);
    if (!result) return { status: "blocked" };
    coordinator.recordBuildUndo?.(() => {
      adapter.restore(result.previous);
      adapter.afterMutation?.();
    });
    adapter.afterMutation?.();
    return { status: "moved" };
  };

  coordinator.demolishBuildObject = (point, onlyType = null) => {
    const target = registry.getTargetAt(precisePoint(point));
    if (target && (!onlyType || onlyType === target.demolitionType)) {
      const adapter = registry.ownerForTarget(target);
      const removed = adapter?.remove(target);
      if (removed) {
        adapter.afterMutation?.();
        return {
          status: "removed",
          type: target.demolitionType,
          undo: () => {
            adapter.restore(removed);
            adapter.afterMutation?.();
          },
        };
      }
    }
    return original.demolishBuildObject(point, onlyType);
  };

  coordinator.renderBuildPreview = (item, points) => {
    const adapter = registry.ownerForItem(item);
    if (!adapter?.renderPreview) return original.renderBuildPreview(item, points);
    coordinator.clearBuildPreview();
    const unique = [...new Map((points ?? []).map((point) => [coordinator.buildCellKey(point), point])).values()];
    for (const point of unique) {
      const preview = adapter.renderPreview(item, point, {
        blocked: adapter.isPlacementBlocked(item, point, null),
        moving: false,
      });
      if (preview) coordinator.buildPreviewObjects.push(preview);
    }
  };

  coordinator.renderBuildMovePreview = (target, point) => {
    const adapter = registry.ownerForTarget(target);
    if (!adapter?.renderPreview) return original.renderBuildMovePreview(target, point);
    coordinator.clearBuildPreview();
    const preview = adapter.renderPreview(target, point, {
      blocked: adapter.isPlacementBlocked(target, point, target.id ?? target.definition?.id),
      moving: true,
    });
    if (preview) coordinator.buildPreviewObjects.push(preview);
  };

  coordinator.renderBuildMoveHover = (point) => {
    coordinator.clearBuildPreview();
    const target = coordinator.getBuildMoveTarget(point);
    if (!target?.targets?.length) return false;
    const targets = target.targets.map((object) => ({ target: object, alpha: object.alpha ?? 1 }));
    for (const { target: object } of targets) {
      object.setTint?.(0x68ff8c);
      object.setAlpha?.(0.82);
    }
    coordinator.buildDemolitionHighlight = { targets, overlay: null };
    return true;
  };

  coordinator.renderBuildDemolitionHighlight = (point) => {
    coordinator.clearBuildPreview();
    const target = coordinator.getBuildDemolitionPreviewTarget(point);
    if (!target?.targets?.length) return;
    const targets = target.targets.map((object) => ({ target: object, alpha: object.alpha ?? 1 }));
    let tintable = false;
    for (const { target: object } of targets) {
      if (object.setTint) {
        object.setTint(0xff6b72);
        tintable = true;
      }
      object.setAlpha?.(0.78);
    }
    const adapter = registry.ownerForTarget(target);
    const overlay = !tintable && adapter?.renderPreview
      ? adapter.renderPreview(target, target.placementPosition, { blocked: true, demolition: true })
      : null;
    coordinator.buildDemolitionHighlight = { targets, overlay };
  };
}
