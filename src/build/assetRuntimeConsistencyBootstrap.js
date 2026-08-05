import { MovementDebugPanel } from "../devtools/movementDebugPanel.js";
import { WorldLocationRuntime } from "../world/worldLocationRuntime.js";
import { BuildModeRuntime } from "./buildModeRuntime.js";
import { normalizeBedDefinitionToGrid } from "./assetGridPlacement.js";
import {
  canonicalBedDefinition,
  derivedFacilityUsePosition,
  hydrateFacilityRuntimeDefinition,
  liveBedGeometry,
  liveFacilityGeometry,
  liveFacilityPresentationPose,
  livePlaceableInteraction,
  PLACEABLE_TARGETING_GROUP,
} from "./liveAssetGeometry.js";

const BUILD_GRID_PATCH = Symbol("nestledBurrowBuildGridVisibilityPatch");
const LOCATION_RUNTIME_PATCH = Symbol("nestledBurrowAssetRuntimeConsistencyLocationPatch");
const PANEL_PATCH = Symbol("nestledBurrowAssetRuntimeConsistencyPanelPatch");
const BED_RUNTIME_PATCH = Symbol("nestledBurrowBedRuntimeConsistencyPatch");
const FACILITY_RUNTIME_PATCH = Symbol("nestledBurrowFacilityRuntimeConsistencyPatch");
const FARMING_RUNTIME_PATCH = Symbol("nestledBurrowFarmingRuntimeConsistencyPatch");
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

if (!WorldLocationRuntime.prototype[LOCATION_RUNTIME_PATCH]) {
  const originalMount = WorldLocationRuntime.prototype.mount;
  WorldLocationRuntime.prototype.mount = function mountWithCurrentAssetGeometry(...args) {
    const result = originalMount.apply(this, args);
    installCurrentAssetRuntime(this.renderingHost);
    return result;
  };
  Object.defineProperty(WorldLocationRuntime.prototype, LOCATION_RUNTIME_PATCH, { value: true });
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
  patchFacilityRuntime(owners.facilityRuntime, scene);
  patchBedRuntime(owners.debrisRuntime, scene);
  patchFarmingRuntime(owners.farmingRuntime, scene);
  scene?.interactionRuntime?.refresh?.();
}

function registeredCollider(scene, id, fallback, profileKey) {
  const entry = scene.worldLayout?.getWorldObjectColliders?.().find((candidate) => candidate.id === id);
  return entry?.rect
    ?? scene.worldLayout?.getEffectiveCollider?.(fallback, profileKey)
    ?? fallback;
}

function patchFacilityRuntime(runtime, scene) {
  if (!runtime || !scene || runtime[FACILITY_RUNTIME_PATCH]) return;

  const originalAdd = runtime.add?.bind(runtime);
  const originalMove = runtime.move?.bind(runtime);
  const originalRestore = runtime.restore?.bind(runtime);
  const originalReplace = runtime.replace?.bind(runtime);
  const originalGetDefinition = runtime.getDefinition?.bind(runtime);
  const originalGetDefinitionByType = runtime.getDefinitionByType?.bind(runtime);
  const originalGetDefinitions = runtime.getDefinitions?.bind(runtime);
  const originalGetInteractionDefinitions = runtime.getInteractionDefinitions?.bind(runtime);

  if (!originalGetDefinition || !originalGetDefinitions) return;

  function currentGeometry(definition) {
    if (!definition?.footprint) return null;
    const profileKey = `facility:${definition.facilityType}`;
    const footprint = {
      left: definition.footprint.x,
      right: definition.footprint.x + definition.footprint.width,
      top: definition.footprint.y,
      bottom: definition.footprint.y + definition.footprint.height,
    };
    return liveFacilityGeometry(
      definition,
      scene.assetProfiles?.[profileKey] ?? {},
      registeredCollider(scene, definition.id, footprint, profileKey),
    );
  }

  function currentDefinition(definition) {
    if (!definition) return null;
    const interaction = livePlaceableInteraction(definition, currentGeometry(definition));
    return Object.freeze({
      ...interaction,
      usePosition: definition.usePosition ?? derivedFacilityUsePosition(definition),
    });
  }

  if (originalRestore) {
    runtime.restore = (definition, options) => originalRestore(hydrateFacilityRuntimeDefinition(definition), options);
  }
  if (originalReplace) {
    runtime.replace = (definition, options) => originalReplace(hydrateFacilityRuntimeDefinition(definition), options);
  }
  if (originalAdd) {
    runtime.add = (...args) => currentDefinition(originalAdd(...args));
  }
  if (originalMove) {
    runtime.move = (...args) => {
      const result = originalMove(...args);
      return result ? {
        ...result,
        previous: currentDefinition(result.previous),
        current: currentDefinition(result.current),
      } : null;
    };
  }

  runtime.getFacilityRuntimeGeometry = (id) => currentGeometry(originalGetDefinition(id));
  runtime.getDefinition = (id) => currentDefinition(originalGetDefinition(id));
  runtime.getDefinitions = () => originalGetDefinitions().map(currentDefinition);
  if (originalGetDefinitionByType) {
    runtime.getDefinitionByType = (type) => currentDefinition(originalGetDefinitionByType(type));
  }
  if (originalGetInteractionDefinitions) {
    runtime.getInteractionDefinitions = () => originalGetInteractionDefinitions().map((definition) => {
      const raw = originalGetDefinition(definition.id) ?? originalGetDefinition(definition.entityId);
      const current = livePlaceableInteraction(raw ?? definition, currentGeometry(raw ?? definition));
      return Object.freeze({
        ...definition,
        ...current,
        prompt: definition.prompt,
        stopPrompt: definition.stopPrompt,
        interactionDirections: definition.interactionDirections,
      });
    });
  }
  runtime.getPresentationPose = (id = runtime.getActiveId?.()) => {
    const definition = originalGetDefinition(id);
    return liveFacilityPresentationPose(definition, currentGeometry(definition));
  };

  Object.defineProperty(runtime, FACILITY_RUNTIME_PATCH, { value: true });
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
      return canonicalBedDefinition(canonical);
    };
  }
  if (originalMoveBed) {
    runtime.moveBed = (id, point) => {
      const result = originalMoveBed(id, point);
      if (!result) return null;
      const previous = normalizeBedDefinitionToGrid(result.previous);
      const current = normalizeBedDefinitionToGrid(result.current);
      if (current !== result.current) originalReplaceBed?.(current);
      return {
        ...result,
        previous: canonicalBedDefinition(previous),
        current: canonicalBedDefinition(current),
      };
    };
  }

  function currentGeometry(definition) {
    if (!definition) return null;
    const footprint = originalGetBedBounds(definition.id);
    if (!footprint) return null;
    return liveBedGeometry(
      footprint,
      scene.assetProfiles?.[BED_PROFILE_KEY] ?? {},
      registeredCollider(scene, definition.id, footprint, BED_PROFILE_KEY),
    );
  }

  function currentDefinition(definition) {
    const canonical = normalizeBedDefinitionToGrid(definition);
    return livePlaceableInteraction(canonical, currentGeometry(canonical), { position: "visual" });
  }

  runtime.getBedRuntimeGeometry = (id = null) => currentGeometry(originalGetBedDefinition(id));
  runtime.getBedDefinition = (id = null) => currentDefinition(originalGetBedDefinition(id));
  runtime.getBedDefinitions = () => originalGetBedDefinitions()
    .map(normalizeBedDefinitionToGrid)
    .map(canonicalBedDefinition);

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

function patchFarmingRuntime(runtime, scene) {
  if (!runtime || !scene || runtime[FARMING_RUNTIME_PATCH]) return;
  const originalGetInteractionDefinitions = runtime.getInteractionDefinitions?.bind(runtime);
  if (!originalGetInteractionDefinitions) return;

  runtime.getInteractionDefinitions = () => originalGetInteractionDefinitions().map((definition) => {
    const collider = scene.worldLayout?.getWorldObjectColliders?.().find(({ id }) => (
      id === definition.entityId || id === definition.id
    ))?.rect;
    if (!collider) return definition;
    const centre = Object.freeze({
      x: (collider.left + collider.right) / 2,
      y: (collider.top + collider.bottom) / 2,
    });
    return Object.freeze({
      ...definition,
      position: centre,
      aimPosition: centre,
      requiresFacing: false,
      facingDotThreshold: -1,
      targetingMode: "facing-first",
      targetingGroup: PLACEABLE_TARGETING_GROUP,
    });
  });

  Object.defineProperty(runtime, FARMING_RUNTIME_PATCH, { value: true });
}
