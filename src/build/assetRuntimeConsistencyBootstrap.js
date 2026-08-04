import { MovementDebugPanel } from "../devtools/movementDebugPanel.js";
import { BuildModeRuntime } from "./buildModeRuntime.js";
import { normalizeBedDefinitionToGrid } from "./assetGridPlacement.js";

const BUILD_GRID_PATCH = Symbol("nestledBurrowBuildGridVisibilityPatch");
const PANEL_PATCH = Symbol("nestledBurrowAssetRuntimeConsistencyPanelPatch");
const BED_RUNTIME_PATCH = Symbol("nestledBurrowBedRuntimeConsistencyPatch");
const BED_PROFILE_KEY = "furniture:bed";

if (!BuildModeRuntime.prototype[BUILD_GRID_PATCH]) {
  const originalSetActive = BuildModeRuntime.prototype.setActive;
  const originalSetGridEnabled = BuildModeRuntime.prototype.setGridEnabled;

  BuildModeRuntime.prototype.setActive = function setActiveWithMandatoryBuildGrid(value) {
    const result = originalSetActive.call(this, value);
    this.grid?.setVisible?.(Boolean(this.active || this.gridEnabled));
    return result;
  };

  BuildModeRuntime.prototype.setGridEnabled = function setGridEnabledOutsideBuild(value) {
    const result = originalSetGridEnabled.call(this, value);
    this.grid?.setVisible?.(Boolean(this.active || this.gridEnabled));
    return result;
  };

  Object.defineProperty(BuildModeRuntime.prototype, BUILD_GRID_PATCH, { value: true });
}

if (!MovementDebugPanel.prototype[PANEL_PATCH]) {
  const originalAttachSceneRuntime = MovementDebugPanel.prototype.attachSceneRuntime;

  MovementDebugPanel.prototype.attachSceneRuntime = async function attachCurrentAssetRuntime() {
    const result = await originalAttachSceneRuntime.call(this);
    installCurrentAssetRuntime(this.scene);
    return result;
  };

  Object.defineProperty(MovementDebugPanel.prototype, PANEL_PATCH, { value: true });
}

function installCurrentAssetRuntime(scene) {
  const owners = scene?.worldLocationRuntime?.getOwners?.() ?? {};
  patchBedRuntime(owners.debrisRuntime, scene);
}

function patchBedRuntime(runtime, scene) {
  if (!runtime || !scene || runtime[BED_RUNTIME_PATCH]) return;

  const originalAddBed = runtime.addBed?.bind(runtime);
  const originalMoveBed = runtime.moveBed?.bind(runtime);
  const originalRestoreBed = runtime.restoreBed?.bind(runtime);
  const originalReplaceBed = runtime.replaceBed?.bind(runtime);
  const originalGetBedDefinition = runtime.getBedDefinition?.bind(runtime);
  const originalGetBedDefinitions = runtime.getBedDefinitions?.bind(runtime);
  const originalGetBedBounds = runtime.getBedBounds?.bind(runtime);
  const originalGetInteractionDefinitions = runtime.getInteractionDefinitions?.bind(runtime);

  if (!originalGetBedDefinition || !originalGetBedDefinitions || !originalGetBedBounds) return;

  for (const definition of originalGetBedDefinitions()) {
    const canonical = normalizeBedDefinitionToGrid(definition);
    if (canonical !== definition) originalReplaceBed?.(canonical);
  }

  if (originalRestoreBed) {
    runtime.restoreBed = (definition) => originalRestoreBed(normalizeBedDefinitionToGrid(definition));
  }
  if (originalReplaceBed) {
    runtime.replaceBed = (definition) => originalReplaceBed(normalizeBedDefinitionToGrid(definition));
  }
  if (originalAddBed) {
    runtime.addBed = (point) => {
      const created = originalAddBed(point);
      if (!created) return null;
      const canonical = normalizeBedDefinitionToGrid(created);
      if (canonical !== created) originalReplaceBed?.(canonical);
      return canonical;
    };
  }
  if (originalMoveBed) {
    runtime.moveBed = (id, point) => {
      const result = originalMoveBed(id, point);
      if (!result) return null;
      const previous = normalizeBedDefinitionToGrid(result.previous);
      const current = normalizeBedDefinitionToGrid(result.current);
      if (current !== result.current) originalReplaceBed?.(current);
      return { ...result, previous, current };
    };
  }

  function currentGeometry(definition) {
    if (!definition) return null;
    const footprint = originalGetBedBounds(definition.id);
    if (!footprint) return null;
    const worldEntry = scene.worldLayout?.getWorldObjectColliders?.().find(({ id }) => id === definition.id);
    const collider = worldEntry?.rect
      ?? scene.worldLayout?.getEffectiveCollider?.(footprint, BED_PROFILE_KEY)
      ?? footprint;
    const visualOffset = scene.assetProfiles?.[BED_PROFILE_KEY]?.visualOffset ?? { x: 0, y: 0 };
    return Object.freeze({
      footprint: Object.freeze({ ...footprint }),
      collider: Object.freeze({ ...collider }),
      visualCenter: Object.freeze({
        x: (footprint.left + footprint.right) / 2 + Number(visualOffset.x || 0),
        y: (footprint.top + footprint.bottom) / 2 + Number(visualOffset.y || 0),
      }),
      interactionCenter: Object.freeze({
        x: (collider.left + collider.right) / 2,
        y: (collider.top + collider.bottom) / 2,
      }),
    });
  }

  function currentDefinition(definition) {
    const canonical = normalizeBedDefinitionToGrid(definition);
    const geometry = currentGeometry(canonical);
    if (!canonical || !geometry) return canonical;
    return Object.freeze({
      ...canonical,
      position: geometry.visualCenter,
      aimPosition: geometry.interactionCenter,
      requiresFacing: false,
      facingDotThreshold: -1,
    });
  }

  runtime.getBedRuntimeGeometry = (id = null) => {
    const definition = originalGetBedDefinition(id);
    return currentGeometry(definition);
  };
  runtime.getBedDefinition = (id = null) => currentDefinition(originalGetBedDefinition(id));
  runtime.getBedDefinitions = () => originalGetBedDefinitions().map(normalizeBedDefinitionToGrid);

  if (originalGetInteractionDefinitions) {
    runtime.getInteractionDefinitions = () => {
      const rawBeds = new Map(originalGetBedDefinitions().map((definition) => [definition.id, definition]));
      return originalGetInteractionDefinitions().map((definition) => {
        const rawBed = rawBeds.get(definition.id) ?? rawBeds.get(definition.entityId);
        if (!rawBed) return definition;
        const current = currentDefinition(rawBed);
        return Object.freeze({
          ...definition,
          ...current,
          prompt: definition.prompt,
          interactionDirections: definition.interactionDirections,
        });
      });
    };
  }

  Object.defineProperty(runtime, BED_RUNTIME_PATCH, { value: true });
}
