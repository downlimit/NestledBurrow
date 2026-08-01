import { BED_ASSET, BED_OBJECT, BED_WAKE_TILE } from "./debrisConfig.js";
import { PLACEMENT_CELL_SIZE, RESOURCE_OBJECTS } from "./resourceConfig.js";
import { getResourceProfile, resourceActionForTool } from "./resourceDomain.js";
import { hitResourceNode } from "./gameSessionState.js";
import { drawResourceVisual } from "./resourceVisuals.js";
import { bindSpriteVisual } from "./facilityPreviewVisuals.js";
import { TILE_SIZE } from "./worldConfig.js";
import { assetDepthFromPivot, pixelAlignedWorldPoint } from "./buildWorldGeometry.js";

export const BED_SLEEP_DEPTH_OFFSET = 0.25;

export function sleepingCharacterDepth(bedDepth) {
  const depth = Number(bedDepth);
  return Number.isFinite(depth) ? depth + BED_SLEEP_DEPTH_OFFSET : null;
}

export function createDebrisRuntime(scene, {
  sessionState,
  worldLayout,
  resourceDefinitions = RESOURCE_OBJECTS,
  includeBed = true,
  getSelectedItem = () => null,
  getGameplayTuning = () => ({}),
  onPersistentMutation = () => {},
}) {
  const definitions = new Map(resourceDefinitions.map((definition) => [definition.id, definition]));
  const visuals = new Map();
  const visualListeners = new Map();
  const bedDefinitions = new Map();
  const bedVisuals = new Map();
  let targetOutline = [];
  let targetTintedVisual = null;
  let targetOutlineId = null;
  let nextBedId = 0;
  let sleepingBedId = null;
  let sleeping = false;
  let destroyed = false;

  const stateFor = (definition) => sessionState.gameplay.resourceNodes[definition.id];
  const isPresent = (definition) => !destroyed && !stateFor(definition)?.cleared;
  const visualPosition = (definition) => definition.visualPosition ?? {
    x: definition.cell.x * PLACEMENT_CELL_SIZE,
    y: definition.cell.y * PLACEMENT_CELL_SIZE,
  };
  const visualBounds = (definition, profile = getResourceProfile(definition.profileId)) => definition.visualBounds ?? {
    left: visualPosition(definition).x,
    top: visualPosition(definition).y,
    right: visualPosition(definition).x + profile.footprint.width * PLACEMENT_CELL_SIZE,
    bottom: visualPosition(definition).y + profile.footprint.height * PLACEMENT_CELL_SIZE,
  };
  const setBlocked = (definition, active) => {
    if (!active) return worldLayout.clearResourceCollider(definition.id);
    if (definition.colliderBounds) {
      worldLayout.setResourceCollider(definition.id, definition.colliderBounds, `resource:${definition.profileId}`);
      return;
    }
    const profile = getResourceProfile(definition.profileId);
    const collision = profile.collisionRect ?? {
      left: 0,
      top: 0,
      right: profile.footprint.width * PLACEMENT_CELL_SIZE,
      bottom: profile.footprint.height * PLACEMENT_CELL_SIZE,
    };
    const topInset = profile.collisionTopInset ?? 0;
    const leftInset = profile.collisionLeftInset ?? 0;
    const rightInset = profile.collisionRightInset ?? 0;
    worldLayout.setResourceCollider(definition.id, {
      left: definition.cell.x * PLACEMENT_CELL_SIZE + collision.left + leftInset,
      right: definition.cell.x * PLACEMENT_CELL_SIZE + collision.right - rightInset,
      top: definition.cell.y * PLACEMENT_CELL_SIZE + collision.top + topInset,
      bottom: definition.cell.y * PLACEMENT_CELL_SIZE + collision.bottom,
    }, `resource:${definition.profileId}`);
  };

  function createVisual(definition) {
    if (!isPresent(definition) || visuals.has(definition.id)) return;
    setBlocked(definition, true);
    const profile = getResourceProfile(definition.profileId);
    const profileKey = `resource:${definition.profileId}`;
    const offset = scene.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? {
      x: profile.footprint.width * PLACEMENT_CELL_SIZE / 2,
      y: profile.footprint.height * PLACEMENT_CELL_SIZE / 2,
    };
    const placementPosition = visualPosition(definition);
    const renderPosition = pixelAlignedWorldPoint({ x: placementPosition.x + offset.x, y: placementPosition.y + offset.y });
    const graphics = scene.add.graphics().setPosition(renderPosition.x, renderPosition.y).setDepth(assetDepthFromPivot(placementPosition, pivotOffset, 500, definition.id));
    drawResourceVisual(graphics, profile, stateFor(definition)?.progress ?? 0);
    visuals.set(definition.id, graphics);
    visualListeners.get(definition.id)?.(graphics);
  }

  function removeVisual(id) {
    visuals.get(id)?.destroy?.();
    visuals.delete(id);
    visualListeners.get(id)?.(null);
  }

  function redraw(definition) {
    const graphics = visuals.get(definition.id);
    if (!graphics) return;
    const offset = scene.assetProfiles?.[`resource:${definition.profileId}`]?.visualOffset ?? { x: 0, y: 0 };
    const placementPosition = visualPosition(definition);
    const renderPosition = pixelAlignedWorldPoint({ x: placementPosition.x + offset.x, y: placementPosition.y + offset.y });
    graphics.setPosition(renderPosition.x, renderPosition.y);
    graphics.clear();
    drawResourceVisual(graphics, getResourceProfile(definition.profileId), stateFor(definition)?.progress ?? 0);
  }

  function clearTargetOutline() {
    for (const graphics of targetOutline) graphics.destroy();
    targetOutline = [];
    targetTintedVisual?.clearTint?.();
    targetTintedVisual = null;
    targetOutlineId = null;
  }

  function updateCandidate(candidate) {
    const definition = candidate?.kind === "work-resource"
      ? definitions.get(candidate.entityId)
      : null;
    const presentDefinition = definition && isPresent(definition) ? definition : null;
    if (presentDefinition && !resourceActionForTool(getResourceProfile(presentDefinition.profileId), getSelectedItem()?.id)) {
      clearTargetOutline();
      return;
    }
    if (presentDefinition?.id === targetOutlineId) return;
    clearTargetOutline();
    if (!presentDefinition) return;
    const profile = getResourceProfile(presentDefinition.profileId);
    if (profile.visual === "tree") {
      targetTintedVisual = visuals.get(presentDefinition.id) ?? null;
      targetTintedVisual?.setTint?.(0x8ed6ff);
      targetOutlineId = presentDefinition.id;
      return;
    }
    const profileKey = `resource:${presentDefinition.profileId}`;
    const visualOffset = scene.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? {
      x: profile.footprint.width * PLACEMENT_CELL_SIZE / 2,
      y: profile.footprint.height * PLACEMENT_CELL_SIZE / 2,
    };
    const placement = visualPosition(presentDefinition);
    targetOutline = [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([x, y]) => {
      const graphics = scene.add.graphics()
        .setPosition(placement.x + visualOffset.x + x, placement.y + visualOffset.y + y)
        .setDepth(assetDepthFromPivot(placement, pivotOffset, 500, presentDefinition.id) - 0.1)
        .setAlpha(0.22);
      drawResourceVisual(graphics, profile, stateFor(presentDefinition)?.progress ?? 0, { colorOverride: 0x8ed6ff });
      return graphics;
    });
    targetOutlineId = presentDefinition.id;
  }

  function hitWithFeedback(resourceId, result, onComplete = () => {}) {
    const definition = definitions.get(resourceId);
    if (!definition) return onComplete();
    const graphics = visuals.get(resourceId);
    if (!graphics) return onComplete();
    redraw(definition);
    if (result.status === "cleared") return clearWithFeedback(resourceId, onComplete);
    const anchorX = graphics.x;
    const anchorY = graphics.y;
    scene.tweens.add({
      targets: graphics,
      x: { from: anchorX - 1, to: anchorX + 1 },
      duration: 60,
      yoyo: true,
      onComplete: () => { graphics.setPosition(anchorX, anchorY); onComplete(); },
    });
  }

  function damageLog(resourceId, damageMultiplier = 0.5) {
    const definition = definitions.get(resourceId);
    const profile = definition ? getResourceProfile(definition.profileId) : null;
    if (profile?.kind !== "log") return { status: "wrong-resource", mutated: false };
    const tuning = getGameplayTuning();
    const result = hitResourceNode(sessionState, resourceId, {
      action: "chop",
      damage: Math.max(0, Number(tuning.axeDamage) || 0) * Math.max(0, Number(damageMultiplier) || 0),
      energyPerHit: 0,
      tuning,
    });
    if (result.mutated) {
      hitWithFeedback(resourceId, result);
      onPersistentMutation(result);
    }
    return result;
  }

  function clearWithFeedback(resourceId, onComplete = () => {}) {
    const definition = definitions.get(resourceId);
    if (!definition) return onComplete();
    const graphics = visuals.get(resourceId);
    setBlocked(definition, false);
    if (!graphics) return onComplete();
    scene.tweens.add({ targets: graphics, alpha: 0, scaleY: 0.55, duration: 160, ease: "Quad.easeOut", onComplete: () => { removeVisual(resourceId); onComplete(); } });
  }

  function trackBedId(id) {
    const match = /^editor-bed-(\d+)$/.exec(id);
    if (match) nextBedId = Math.max(nextBedId, Number(match[1]));
  }

  function createBed(definition) {
    const bounds = bedBounds(definition);
    worldLayout.setWorldObjectCollider(definition.id, bounds, "furniture:bed");
    const offset = scene.assetProfiles?.["furniture:bed"]?.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = scene.assetProfiles?.["furniture:bed"]?.snapAnchorOffset ?? { x: TILE_SIZE / 2, y: TILE_SIZE / 2 };
    const placementPosition = { x: bounds.left, y: bounds.top };
    const renderPosition = pixelAlignedWorldPoint({ x: bounds.left + offset.x, y: bounds.top + offset.y });
    const graphics = scene.add.graphics().setPosition(renderPosition.x, renderPosition.y).setDepth(assetDepthFromPivot(placementPosition, pivotOffset, 500, definition.id));
    drawBed(graphics);
    bedDefinitions.set(definition.id, definition);
    bedVisuals.set(definition.id, graphics);
    trackBedId(definition.id);
  }

  function getBedDefinitionAt(point) {
    return [...bedDefinitions.values()].reverse().find((bed) => contains(bedBounds(bed), point)) ?? null;
  }

  function removeBed(id) {
    if (sleeping) return false;
    const definition = bedDefinitions.get(id);
    if (!definition) return false;
    bedVisuals.get(id)?.destroy();
    bedVisuals.delete(id);
    bedDefinitions.delete(id);
    worldLayout.clearWorldObjectCollider(id);
    return true;
  }

  function removeBedAt(point) {
    const definition = getBedDefinitionAt(point);
    return definition ? removeBed(definition.id) : false;
  }

  function restoreBed(definition) {
    const baseCollider = definition ? bedBounds(definition) : null;
    const effectiveCollider = baseCollider ? worldLayout.getEffectiveCollider(baseCollider, "furniture:bed") : null;
    if (!definition || bedDefinitions.has(definition.id) || worldLayout.isBlockedBox(effectiveCollider)) return false;
    createBed(definition);
    return true;
  }

  function replaceBed(definition) {
    if (!definition) return false;
    const previous = bedDefinitions.get(definition.id);
    if (previous && !removeBed(previous.id)) return false;
    if (restoreBed(definition)) return true;
    if (previous) restoreBed(previous);
    return false;
  }

  function moveBed(id, point) {
    const previous = bedDefinitions.get(id);
    if (!previous || sleeping) return null;
    const current = Object.freeze({
      ...previous,
      position: Object.freeze({ x: point.x + 8, y: point.y + 8 }),
      wakePosition: Object.freeze({ x: point.x + 8, y: point.y + TILE_SIZE + 8 }),
    });
    return replaceBed(current) ? { previous, current } : null;
  }

  function getBedDemolitionTargetAt(point) {
    const definition = getBedDefinitionAt(point);
    if (!definition) return null;
    const visual = bedVisuals.get(definition.id);
    return visual ? { targets: [visual], bounds: bedBounds(definition), kind: "bed" } : null;
  }

  function addBed(point) {
    const id = `editor-bed-${++nextBedId}`;
    const definition = Object.freeze({
      ...BED_OBJECT,
      id,
      entityId: id,
      position: Object.freeze({ x: point.x + 8, y: point.y + 8 }),
      wakePosition: Object.freeze({ x: point.x + 8, y: point.y + TILE_SIZE + 8 }),
      payload: Object.freeze({ bedId: id }),
    });
    if (worldLayout.isBlockedBox(worldLayout.getEffectiveCollider(bedBounds(definition), "furniture:bed"))) return null;
    createBed(definition);
    return definition;
  }

  function setSleeping(active, bedId = null) {
    sleeping = Boolean(active);
    sleepingBedId = sleeping ? bedId : null;
    if (!sleeping) return;
    const bedVisual = bedVisuals.get(sleepingBedId);
    const characterVisual = scene.playerCharacter?.visual;
    const pose = characterVisual?.presentationPose;
    const depth = sleepingCharacterDepth(bedVisual?.depth);
    if (pose && depth !== null) characterVisual.setPresentationPose({ ...pose, depth });
  }

  for (const definition of definitions.values()) createVisual(definition);
  if (includeBed) {
    if (worldLayout.isBlockedCell(BED_WAKE_TILE.x * 2, BED_WAKE_TILE.y * 2)) throw new Error("BED_WAKE_TILE must remain walkable");
    createBed(BED_OBJECT);
  }

  return {
    getInteractionDefinitions() {
      const beds = [...bedDefinitions.values()].map((definition) => (
        sleeping && definition.id === sleepingBedId
          ? { ...definition, prompt: "hud:interaction.wake" }
          : definition
      ));
      const selectedToolId = getSelectedItem()?.id;
      const resources = [...definitions.values()].filter((definition) => isPresent(definition)
        && resourceActionForTool(getResourceProfile(definition.profileId), selectedToolId));
      return [...resources, ...beds];
    },
    updateCandidate,
    getBedDefinition(id = null) {
      if (id) return bedDefinitions.get(id) ?? null;
      return bedDefinitions.values().next().value ?? null;
    },
    getBedDefinitions() { return [...bedDefinitions.values()]; },
    getBedBounds(id) {
      const definition = bedDefinitions.get(id);
      return definition ? bedBounds(definition) : null;
    },
    getAuthoringInstances() {
      const resources = [...definitions.values()].flatMap((definition) => {
        const visual = visuals.get(definition.id);
        if (!visual) return [];
        const profile = getResourceProfile(definition.profileId);
        const anchor = visualPosition(definition);
        const bounds = visualBounds(definition, profile);
        return [{
          id: definition.id,
          profileKey: `resource:${definition.profileId}`,
          anchor: { ...anchor },
          bounds: { ...bounds },
          targets: [visual],
        }];
      });
      const beds = [...bedDefinitions.values()].flatMap((definition) => {
        const visual = bedVisuals.get(definition.id);
        const bounds = bedBounds(definition);
        return visual ? [{
          id: definition.id,
          profileKey: "furniture:bed",
          anchor: { x: bounds.left, y: bounds.top },
          bounds,
          targets: [visual],
        }] : [];
      });
      return [...resources, ...beds];
    },
    applyAuthoringVisualOffset(profileKey, offset) {
      for (const definition of definitions.values()) {
        if (`resource:${definition.profileId}` !== profileKey) continue;
        visuals.get(definition.id)?.setPosition?.(
          visualPosition(definition).x + offset.x,
          visualPosition(definition).y + offset.y,
        );
      }
      if (profileKey === "furniture:bed") {
        for (const definition of bedDefinitions.values()) {
          const bounds = bedBounds(definition);
          bedVisuals.get(definition.id)?.setPosition?.(bounds.left + offset.x, bounds.top + offset.y);
        }
      }
    },
    addBed,
    removeBed,
    removeBedAt,
    restoreBed,
    replaceBed,
    moveBed,
    getBedDefinitionAt,
    getBedDemolitionTargetAt,
    registerResource(definition, { onVisualChange = null } = {}) {
      if (!definition?.id) return null;
      if (typeof onVisualChange === "function") visualListeners.set(definition.id, onVisualChange);
      if (definitions.has(definition.id)) {
        onVisualChange?.(visuals.get(definition.id) ?? null);
        return definitions.get(definition.id);
      }
      sessionState.gameplay.resourceNodes[definition.id] ??= { cleared: false, progress: 0 };
      definitions.set(definition.id, definition);
      createVisual(definition);
      return definition;
    },
    unregisterResource(id, { removeState = true } = {}) {
      const definition = definitions.get(id);
      if (!definition) return null;
      if (targetOutlineId === id) clearTargetOutline();
      removeVisual(id);
      setBlocked(definition, false);
      definitions.delete(id);
      visualListeners.delete(id);
      if (removeState) delete sessionState.gameplay.resourceNodes[id];
      return definition;
    },
    getResourceVisual(id) { return visuals.get(id) ?? null; },
    getResourceDefinition(id) { return definitions.get(id) ?? null; },
    getResourceDefinitions() { return [...definitions.values()]; },
    isPresent(id) {
      const definition = id ? definitions.get(id) : definitions.values().next().value;
      return definition ? isPresent(definition) : false;
    },
    getVisualState(id) {
      const graphics = visuals.get(id);
      return graphics ? {
        x: graphics.x,
        y: graphics.y,
        highlighted: targetOutlineId === id,
        highlightMode: targetOutlineId !== id ? null : targetTintedVisual === graphics ? "tint" : "outline",
        highlightCopies: targetOutlineId === id ? targetOutline.length : 0,
        spriteCount: graphics.spriteContainer?.list?.length ?? (graphics.spriteImage ? 1 : 0),
      } : null;
    },
    hitWithFeedback, clearWithFeedback, damageLog, setSleeping,
    rebuild() { for (const id of [...visuals.keys()]) removeVisual(id); for (const definition of definitions.values()) createVisual(definition); },
    destroy() {
      destroyed = true;
      clearTargetOutline();
      for (const id of [...visuals.keys()]) removeVisual(id);
      visualListeners.clear();
      for (const graphics of bedVisuals.values()) graphics.destroy();
      for (const definition of bedDefinitions.values()) worldLayout.clearWorldObjectCollider(definition.id);
      bedVisuals.clear();
      bedDefinitions.clear();
      for (const definition of definitions.values()) setBlocked(definition, false);
    },
  };
}

export function drawBed(graphics, tint = null) {
  return bindSpriteVisual(graphics, BED_ASSET, tint);
}

function bedBounds(definition) {
  return {
    left: definition.position.x - 8,
    right: definition.position.x + 8,
    top: definition.position.y - 8,
    bottom: definition.position.y + 8,
  };
}

function contains(bounds, point) {
  return point.x >= bounds.left
    && point.x < bounds.right
    && point.y >= bounds.top
    && point.y < bounds.bottom;
}
