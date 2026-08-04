import { MovementDebugPanel } from "../devtools/movementDebugPanel.js";
import { TILE_SIZE } from "../world/worldConfig.js";
import { BuildModeRuntime } from "./buildModeRuntime.js";
import { authoringArrowDelta, createAuthoringArrowEvent } from "./assetAuthoringInput.js";
import {
  normalizeBedDefinitionToGrid,
  normalizeBuildObjectToGrid,
  normalizeFacilityDefinitionToGrid,
  roundColliderToAssetFootprint,
  snapAssetPlacementPoint,
} from "./assetGridPlacement.js";

const DIRECT_GRID_PLACEMENTS = new Set(["bed", "facility", "tree"]);
const GRID_BOOTSTRAP_PATCH = Symbol("nestledBurrowGridAuthoringBootstrap");
const GRID_RUNTIME_PATCH = Symbol("nestledBurrowGridRuntimePatch");
const GRID_PANEL_PATCH = Symbol("nestledBurrowGridPanelPatch");
const GRID_OVERLAY_ALPHA = 0.4;

if (!BuildModeRuntime.prototype[GRID_BOOTSTRAP_PATCH]) {
  const originalGetActionPoint = BuildModeRuntime.prototype.getActionPoint;
  BuildModeRuntime.prototype.getActionPoint = function getCanonicalGridActionPoint(pointer, item = null, demolitionType = null, wallAxis = null) {
    if (item && DIRECT_GRID_PLACEMENTS.has(item.placement) && !wallAxis) {
      const raw = {
        x: Number(pointer?.worldX ?? pointer?.x) || 0,
        y: Number(pointer?.worldY ?? pointer?.y) || 0,
      };
      const snapped = snapAssetPlacementPoint(raw, TILE_SIZE);
      return { ...snapped, rawX: raw.x, rawY: raw.y };
    }
    return originalGetActionPoint.call(this, pointer, item, demolitionType, wallAxis);
  };
  Object.defineProperty(BuildModeRuntime.prototype, GRID_BOOTSTRAP_PATCH, { value: true });
}

if (!MovementDebugPanel.prototype[GRID_PANEL_PATCH]) {
  const originalAttachSceneRuntime = MovementDebugPanel.prototype.attachSceneRuntime;
  const originalSetEditorMode = MovementDebugPanel.prototype.setEditorMode;
  const originalDestroy = MovementDebugPanel.prototype.destroy;
  const originalSetColliderEditorState = MovementDebugPanel.prototype.setColliderEditorState;
  const originalSetPivotEditorState = MovementDebugPanel.prototype.setPivotEditorState;
  const originalSetVisualOffsetEditorState = MovementDebugPanel.prototype.setVisualOffsetEditorState;
  const originalSetCropEditorState = MovementDebugPanel.prototype.setCropEditorState;

  MovementDebugPanel.prototype.attachSceneRuntime = async function attachGridAuthoringRuntime() {
    const result = await originalAttachSceneRuntime.call(this);
    installGridAuthoringFeedback(this);
    return result;
  };

  MovementDebugPanel.prototype.setEditorMode = function setGridEditorMode(mode) {
    originalSetEditorMode.call(this, mode);
    const scene = this.scene;
    if (!scene) return;
    scene.__assetAuthoringMode = mode ?? null;
    if (mode) stopPlayerMotion(scene);
  };

  MovementDebugPanel.prototype.setColliderEditorState = function setGridColliderEditorState(state) {
    originalSetColliderEditorState.call(this, state);
    if (state?.id && this.colliderEditorStatus) {
      this.colliderEditorStatus.textContent += "\nстрелки/WASD: сдвиг · Ctrl: расширить · Alt: сузить";
    }
  };

  MovementDebugPanel.prototype.setPivotEditorState = function setGridPivotEditorState(state) {
    originalSetPivotEditorState.call(this, state);
    if (state?.profileKey && this.colliderEditorStatus) {
      this.colliderEditorStatus.textContent = this.colliderEditorStatus.textContent.replace("стрелки: 1 px", "стрелки/WASD: 1 px");
    }
  };

  MovementDebugPanel.prototype.setVisualOffsetEditorState = function setGridVisualOffsetEditorState(state) {
    originalSetVisualOffsetEditorState.call(this, state);
    if (state?.profileKey && this.colliderEditorStatus) {
      this.colliderEditorStatus.textContent = this.colliderEditorStatus.textContent.replace("стрелки: 1 px", "стрелки/WASD: 1 px");
    }
  };

  MovementDebugPanel.prototype.setCropEditorState = function setGridCropEditorState(state) {
    originalSetCropEditorState.call(this, state);
    if (state?.profileKey && this.colliderEditorStatus) {
      this.colliderEditorStatus.textContent = this.colliderEditorStatus.textContent.replace("стрелки:", "стрелки/WASD:");
    }
  };

  MovementDebugPanel.prototype.destroy = function destroyGridAuthoringPanel() {
    teardownGridAuthoringFeedback(this);
    return originalDestroy.call(this);
  };

  Object.defineProperty(MovementDebugPanel.prototype, GRID_PANEL_PATCH, { value: true });
}

function installGridAuthoringFeedback(panel) {
  const scene = panel.scene;
  if (!scene || panel[GRID_BOOTSTRAP_PATCH]?.scene === scene) return;
  teardownGridAuthoringFeedback(panel);
  installRuntimePlacementAdapters(scene);
  installColliderPresentation(scene);
  normalizeLivePlacements(scene);

  const keydown = (event) => handleAuthoringNavigationKey(panel, event);
  globalThis.addEventListener?.("keydown", keydown, true);
  panel[GRID_BOOTSTRAP_PATCH] = { scene, keydown };
}

function teardownGridAuthoringFeedback(panel) {
  const state = panel[GRID_BOOTSTRAP_PATCH];
  if (!state) return;
  globalThis.removeEventListener?.("keydown", state.keydown, true);
  if (state.scene?.__assetAuthoringMode) state.scene.__assetAuthoringMode = null;
  panel[GRID_BOOTSTRAP_PATCH] = null;
}

function handleAuthoringNavigationKey(panel, event) {
  const state = panel.assetAuthoringEnhancement;
  const mode = state?.mode;
  if (!mode || isTextEditingTarget(event?.target)) return;
  const mapped = createAuthoringArrowEvent(event);
  if (!mapped) return;
  mapped.preventDefault();
  mapped.stopPropagation();
  mapped.stopImmediatePropagation();
  stopPlayerMotion(state.scene);

  if (mode === "collider" || mode === "crop") {
    state.listeners?.key?.(mapped);
    return;
  }

  const delta = authoringArrowDelta(mapped.key);
  if (!delta) return;
  if (mode === "pivot") {
    const selection = panel.authoringRuntime?.nudgePivot?.(delta.x, delta.y);
    panel.setPivotEditorState?.(selection);
    state.scene?.renderPivotDebug?.();
    return;
  }
  if (mode === "visual-offset") {
    const selection = panel.authoringRuntime?.nudgeVisualOffset?.(delta.x, delta.y);
    panel.setVisualOffsetEditorState?.(selection);
    state.scene?.renderVisualOffsetDebug?.();
  }
}

function isTextEditingTarget(target) {
  const tagName = String(target?.tagName ?? "").toLowerCase();
  if (target?.isContentEditable || tagName === "textarea" || tagName === "select") return true;
  if (tagName !== "input") return false;
  const type = String(target?.type ?? "text").toLowerCase();
  return !["button", "checkbox", "radio", "range"].includes(type);
}

function stopPlayerMotion(scene) {
  scene?.mobileJoystick?.reset?.();
  const velocity = scene?.playerCharacter?.motor?.movement?.velocity;
  if (!velocity) return;
  velocity.x = 0;
  velocity.y = 0;
}

function installRuntimePlacementAdapters(scene) {
  const owners = scene.worldLocationRuntime?.getOwners?.() ?? {};
  patchCoordinator(owners.worldBuildCoordinator);
  patchFacilityRuntime(owners.facilityRuntime);
  patchBedRuntime(owners.debrisRuntime);
}

function patchCoordinator(coordinator) {
  if (!coordinator || coordinator[GRID_RUNTIME_PATCH]) return;
  const originalAnchor = coordinator.getBuildPlacementAnchorOffset?.bind(coordinator);
  if (originalAnchor) {
    coordinator.getBuildPlacementAnchorOffset = (item) => (
      DIRECT_GRID_PLACEMENTS.has(item?.placement) ? { x: 0, y: 0 } : originalAnchor(item)
    );
  }
  const originalMoveTarget = coordinator.getBuildMoveTarget?.bind(coordinator);
  if (originalMoveTarget) {
    coordinator.getBuildMoveTarget = (point) => {
      const target = originalMoveTarget(point);
      return target && ["bed", "facility"].includes(target.kind)
        ? { ...target, snapAnchorOffset: { x: 0, y: 0 } }
        : target;
    };
  }
  Object.defineProperty(coordinator, GRID_RUNTIME_PATCH, { value: true });
}

function patchFacilityRuntime(runtime) {
  if (!runtime || runtime[GRID_RUNTIME_PATCH]) return;
  const originalAdd = runtime.add?.bind(runtime);
  const originalMove = runtime.move?.bind(runtime);
  const originalRestore = runtime.restore?.bind(runtime);
  const originalReplace = runtime.replace?.bind(runtime);

  if (originalRestore) runtime.restore = (definition, options) => originalRestore(normalizeFacilityDefinitionToGrid(definition), options);
  if (originalReplace) runtime.replace = (definition, options) => originalReplace(normalizeFacilityDefinitionToGrid(definition), options);
  if (originalAdd) {
    runtime.add = (facilityType, point) => {
      const definition = originalAdd(facilityType, snapAssetPlacementPoint(point, TILE_SIZE));
      if (!definition) return null;
      const normalized = normalizeFacilityDefinitionToGrid(definition);
      if (!sameFacilityPlacement(definition, normalized) && originalReplace) {
        originalReplace(normalized, { validateFootprint: false });
        return runtime.getDefinition?.(normalized.id) ?? normalized;
      }
      return definition;
    };
  }
  if (originalMove) {
    runtime.move = (id, point) => {
      const result = originalMove(id, snapAssetPlacementPoint(point, TILE_SIZE));
      if (!result) return null;
      const current = normalizeFacilityDefinitionToGrid(result.current);
      if (!sameFacilityPlacement(result.current, current) && originalReplace) {
        originalReplace(current, { validateFootprint: false });
      }
      return { ...result, current };
    };
  }
  Object.defineProperty(runtime, GRID_RUNTIME_PATCH, { value: true });
}

function patchBedRuntime(runtime) {
  if (!runtime || runtime[GRID_RUNTIME_PATCH]) return;
  const originalAdd = runtime.addBed?.bind(runtime);
  const originalMove = runtime.moveBed?.bind(runtime);
  const originalRestore = runtime.restoreBed?.bind(runtime);
  const originalReplace = runtime.replaceBed?.bind(runtime);
  if (originalRestore) runtime.restoreBed = (definition) => originalRestore(normalizeBedDefinitionToGrid(definition));
  if (originalReplace) runtime.replaceBed = (definition) => originalReplace(normalizeBedDefinitionToGrid(definition));
  if (originalAdd) runtime.addBed = (point) => originalAdd(snapAssetPlacementPoint(point, TILE_SIZE));
  if (originalMove) runtime.moveBed = (id, point) => originalMove(id, snapAssetPlacementPoint(point, TILE_SIZE));
  Object.defineProperty(runtime, GRID_RUNTIME_PATCH, { value: true });
}

function installColliderPresentation(scene) {
  if (scene[GRID_RUNTIME_PATCH]) return;
  const originalVisibility = scene.setColliderDebugVisible?.bind(scene);
  if (originalVisibility) {
    scene.setColliderDebugVisible = (visible) => {
      const result = originalVisibility(visible);
      scene.colliderDebugGraphics?.setAlpha?.(GRID_OVERLAY_ALPHA);
      return result;
    };
  }
  scene.colliderDebugGraphics?.setAlpha?.(GRID_OVERLAY_ALPHA);
  scene.roundSelectedCollider = () => {
    const selection = scene.colliderEditSelection;
    if (!selection) return { status: "empty" };
    if (!scene.assetProfiles?.[selection.groupKey]) return { status: "unsupported" };
    selection.draft = { ...roundColliderToAssetFootprint(selection.base ?? selection.draft, TILE_SIZE, 2) };
    scene.syncColliderEditorPanel?.();
    scene.renderColliderDebug?.();
    return { status: "rounded", id: selection.id, draft: { ...selection.draft } };
  };
  Object.defineProperty(scene, GRID_RUNTIME_PATCH, { value: true });
}

function normalizeLivePlacements(scene) {
  const owners = scene.worldLocationRuntime?.getOwners?.() ?? {};
  const facilityRuntime = owners.facilityRuntime;
  for (const definition of facilityRuntime?.getDefinitions?.() ?? []) {
    const normalized = normalizeFacilityDefinitionToGrid(definition);
    if (!sameFacilityPlacement(definition, normalized)) {
      facilityRuntime.replace?.(normalized, { validateFootprint: false });
    }
  }

  const debrisRuntime = owners.debrisRuntime;
  for (const definition of debrisRuntime?.getBedDefinitions?.() ?? []) {
    const normalized = normalizeBedDefinitionToGrid(definition);
    if (!samePoint(definition.position, normalized.position)) debrisRuntime.replaceBed?.(normalized);
  }

  const coordinator = owners.worldBuildCoordinator;
  for (const object of coordinator?.getPlacedObjects?.() ?? []) {
    if (["wall", "wall-node", "ground", "floor", "carpet"].includes(object.kind)) continue;
    const normalized = normalizeBuildObjectToGrid(object);
    if (samePoint(object.point, normalized.point)) continue;
    coordinator.removeBuildPlacedObjectById?.(object.id);
    if (!coordinator.restoreBuildPlacedObject?.(normalized)) coordinator.restoreBuildPlacedObject?.(object);
  }
}

function sameFacilityPlacement(left, right) {
  return samePoint(left?.footprint, right?.footprint);
}

function samePoint(left, right) {
  return Number(left?.x) === Number(right?.x) && Number(left?.y) === Number(right?.y);
}
