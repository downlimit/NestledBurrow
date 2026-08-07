import { PLACEABLE_TARGETING_GROUP } from "../build/liveAssetGeometry.js";
import { createMovementState } from "../character/characterMovement.js";
import { getResourceObjectsForWorld } from "../resources/resourceConfig.js";
import {
  getWorldLocationDefinition,
  resolveWorldLocationId,
  TRANSPORT_PROFILE,
  WORLD_IDS,
  WORLD_LOCATION_DEFINITIONS,
  WORLD_TRANSITION_INTERACTION_KIND,
} from "./worldLocationConfig.js";
import { TILE_SIZE } from "./worldConfig.js";

export function createWorldLocationCoordinator(options) {
  return new WorldLocationCoordinator(options);
}

export class WorldLocationCoordinator {
  constructor({
    sessionState,
    createLayout,
    applyColliderOverrides = () => {},
    getAssetProfiles = () => ({}),
    getPlayerCharacter = () => null,
    canTransition = () => true,
    beforeLocationChange = () => {},
    applyLocationLayout = () => {},
    afterLocationChange = () => {},
    setCameraBounds = () => {},
    resetCamera = () => {},
    refreshInteractions = () => {},
    saveSession = () => {},
  } = {}) {
    if (!sessionState || typeof createLayout !== "function") {
      throw new Error("WorldLocationCoordinator requires session state and a layout factory");
    }
    this.sessionState = sessionState;
    this.createLayout = createLayout;
    this.applyColliderOverrides = applyColliderOverrides;
    this.getAssetProfiles = getAssetProfiles;
    this.getPlayerCharacter = getPlayerCharacter;
    this.canTransition = canTransition;
    this.beforeLocationChange = beforeLocationChange;
    this.applyLocationLayout = applyLocationLayout;
    this.afterLocationChange = afterLocationChange;
    this.setCameraBounds = setCameraBounds;
    this.resetCamera = resetCamera;
    this.refreshInteractions = refreshInteractions;
    this.saveSession = saveSession;
    this.switching = false;
    this.lockedTransportId = null;
    this.destroyed = false;
    this.activeDefinition = null;
    this.activeLayout = null;
  }

  createInitialLayout() {
    const resolvedWorldId = resolveWorldLocationId(this.sessionState.currentWorldId);
    this.sessionState.currentWorldId = resolvedWorldId;
    this.activeDefinition = getWorldLocationDefinition(resolvedWorldId);
    this.activeLayout = this.prepareLayout(this.activeDefinition);
    return this.activeLayout;
  }

  prepareLayout(definition) {
    const layout = this.createLayout(definition.id);
    applyTransportProfile(layout, definition);
    this.applyColliderOverrides(layout);
    layout.locationId = definition.id;
    layout.locationDefinition = definition;
    layout.resourceDefinitions = getResourceObjectsForWorld(definition.id);
    if (definition.loadSpawn) layout.spawn = clonePoint(definition.loadSpawn);
    return layout;
  }

  getCurrentDefinition() {
    return this.activeDefinition;
  }

  getCurrentLayout() {
    return this.activeLayout;
  }

  hasCapability(capability) {
    return Boolean(this.activeDefinition?.capabilities?.[capability]);
  }

  transitionInteraction(transition) {
    if (!transition || !this.activeLayout) return null;
    const collider = this.activeLayout.getWorldObjectColliders?.()
      .find(({ id }) => id === transition.id)?.rect ?? transition.footprintBounds;
    const profile = this.getAssetProfiles?.()?.[transition.profileKey] ?? {};
    const interactionOffset = profile.interactionOffset ?? { x: 0, y: 0 };
    const center = {
      x: (collider.left + collider.right) / 2,
      y: (collider.top + collider.bottom) / 2,
    };
    return Object.freeze({
      point: Object.freeze({
        x: center.x + Number(interactionOffset.x || 0),
        y: center.y + Number(interactionOffset.y || 0),
      }),
      collider: Object.freeze({ ...collider }),
      interactionDirections: profile.interactionDirections,
    });
  }

  update() {
    if (this.destroyed || this.switching || !this.activeLayout) return { status: "idle", transitioned: false };
    if (this.lockedTransportId) {
      const playerPosition = this.getPlayerCharacter()?.motor?.position;
      const destinationTransport = this.activeLayout.transitions.find(({ id }) => id === this.lockedTransportId);
      if (!destinationTransport || playerPosition && !this.isWithinInteractionRange(destinationTransport, playerPosition)) {
        this.lockedTransportId = null;
      }
      return { status: this.lockedTransportId ? "locked" : "armed", transitioned: false };
    }
    return { status: this.canTransition() ? "armed" : "suppressed", transitioned: false };
  }

  getInteractionDefinitions() {
    if (this.destroyed || this.switching || !this.activeLayout || !this.canTransition()) return [];
    return this.activeLayout.transitions
      .filter(({ id }) => id !== this.lockedTransportId)
      .flatMap((transition) => {
        const interaction = this.transitionInteraction(transition);
        return interaction ? [Object.freeze({
          id: `${transition.id}:interaction`,
          entityId: transition.id,
          roomId: this.activeDefinition?.id ?? this.sessionState.currentWorldId,
          kind: WORLD_TRANSITION_INTERACTION_KIND,
          profileKey: transition.profileKey,
          interactionWorldLayout: this.activeLayout,
          position: interaction.point,
          aimPosition: interaction.point,
          radius: transition.interactionRadius,
          priority: transition.priority,
          requiresFacing: transition.requiresFacing,
          facingDotThreshold: -1,
          targetingMode: "facing-first",
          targetingGroup: PLACEABLE_TARGETING_GROUP,
          interactionDirections: interaction.interactionDirections,
          prompt: transition.prompt,
          payload: Object.freeze({ transitionId: transition.id }),
        })] : [];
      });
  }

  handleInteraction(candidate) {
    if (candidate?.kind !== WORLD_TRANSITION_INTERACTION_KIND) return { status: "ignored", transitioned: false };
    const transitionId = candidate.payload?.transitionId;
    const transition = this.activeLayout?.transitions?.find(({ id }) => id === transitionId);
    if (!transition || transition.id === this.lockedTransportId) return { status: "invalid", transitioned: false };
    if (!this.canTransition()) return { status: "suppressed", transitioned: false };
    return this.transition(transition);
  }

  transition(transition) {
    const destinationDefinition = getWorldLocationDefinition(transition.destinationWorldId);
    if (!destinationDefinition || this.switching || this.destroyed) return { status: "invalid", transitioned: false };
    const nextLayout = this.prepareLayout(destinationDefinition);
    const destinationTransport = nextLayout.transitions.find(({ id }) => id === transition.destinationTransportId);
    if (!destinationTransport) throw new Error(`Missing destination transport: ${transition.destinationTransportId}`);
    return this.performTransition({
      destinationDefinition,
      nextLayout,
      spawn: destinationTransport.safeSpawn,
      lockedTransportId: destinationTransport.id,
    });
  }

  transitionTo(worldId, spawn = null) {
    if (this.switching || this.destroyed) return { status: "invalid", transitioned: false };
    if (!this.canTransition()) return { status: "suppressed", transitioned: false };
    const destinationDefinition = getWorldLocationDefinition(worldId);
    if (!destinationDefinition) return { status: "invalid", transitioned: false };
    const nextLayout = this.prepareLayout(destinationDefinition);
    const resolvedSpawn = spawn ?? destinationDefinition.loadSpawn ?? nextLayout.spawn;
    if (!resolvedSpawn) throw new Error(`Missing explicit spawn for world: ${destinationDefinition.id}`);
    return this.performTransition({
      destinationDefinition,
      nextLayout,
      spawn: resolvedSpawn,
      lockedTransportId: null,
    });
  }

  performTransition({ destinationDefinition, nextLayout, spawn, lockedTransportId }) {
    this.switching = true;
    const previousDefinition = this.activeDefinition;
    const previousLayout = this.activeLayout;
    const nextSpawn = clonePoint(spawn);
    try {
      this.beforeLocationChange({ definition: previousDefinition, layout: previousLayout });
      this.activeDefinition = destinationDefinition;
      this.activeLayout = nextLayout;
      this.sessionState.currentWorldId = destinationDefinition.id;
      this.applyLocationLayout({ definition: destinationDefinition, layout: nextLayout });
      this.resetPlayer(nextSpawn);
      this.setCameraBounds(nextLayout.bounds);
      this.resetCamera(nextSpawn);
      this.afterLocationChange({ definition: destinationDefinition, layout: nextLayout });
      this.lockedTransportId = lockedTransportId;
      this.refreshInteractions();
      this.saveSession();
      return { status: "transitioned", transitioned: true, worldId: destinationDefinition.id };
    } finally {
      this.switching = false;
    }
  }

  resetPlayer(spawn) {
    const player = this.getPlayerCharacter();
    if (!player?.motor) return;
    player.motor.position = { x: spawn.x, y: spawn.y };
    player.motor.movement = createMovementState({ facing: spawn.facing });
    player.visual?.setPresentationPose?.(null);
  }

  isWithinInteractionRange(transition, point) {
    const interaction = this.transitionInteraction(transition);
    return Boolean(interaction) && Math.hypot(
      interaction.point.x - point.x,
      interaction.point.y - point.y,
    ) <= transition.interactionRadius;
  }

  getState() {
    return {
      worldId: this.activeDefinition?.id ?? WORLD_IDS.village,
      bounds: this.activeLayout ? { ...this.activeLayout.bounds } : null,
      transitionLocked: Boolean(this.lockedTransportId),
      lockedTransportId: this.lockedTransportId,
      transportCount: this.activeLayout?.transitions?.length ?? 0,
      resourceIds: this.activeLayout?.resourceDefinitions?.map(({ id }) => id) ?? [],
    };
  }

  destroy() {
    this.destroyed = true;
    this.activeDefinition = null;
    this.activeLayout = null;
    this.sessionState = null;
  }
}

export function applyTransportProfile(layout, definition) {
  const transportTiles = [];
  const transitions = [];
  for (const placement of definition.transports) {
    const left = placement.tile.x * TILE_SIZE;
    const top = placement.tile.y * TILE_SIZE;
    const footprintBounds = Object.freeze({
      left,
      top,
      right: left + placement.asset.width,
      bottom: top + placement.asset.height,
    });
    const baseCollider = Object.freeze({
      left: left + placement.collider.left,
      right: left + placement.collider.right,
      top: top + placement.collider.top,
      bottom: top + placement.collider.bottom,
    });
    layout.setWorldObjectCollider?.(placement.id, baseCollider, placement.profileKey, {
      kind: WORLD_TRANSITION_INTERACTION_KIND,
      profileKey: placement.profileKey,
    });
    transportTiles.push(Object.freeze({
      id: placement.id,
      entityId: placement.id,
      profileKey: placement.profileKey,
      worldX: left,
      worldY: top,
      width: placement.asset.width,
      height: placement.asset.height,
      textureKey: placement.asset.textureKey,
    }));
    transitions.push(Object.freeze({
      ...placement,
      footprintBounds,
      interactionRadius: TRANSPORT_PROFILE.interactionRadius,
      priority: TRANSPORT_PROFILE.priority,
      requiresFacing: TRANSPORT_PROFILE.requiresFacing,
      safeSpawn: Object.freeze(clonePoint(placement.safeSpawn)),
    }));
  }
  layout.transportTiles = Object.freeze(transportTiles);
  layout.transitions = Object.freeze(transitions);
  return layout;
}

export { WORLD_LOCATION_DEFINITIONS };

function clonePoint(point) {
  return {
    x: Number(point.x),
    y: Number(point.y),
    ...(point.facing ? { facing: { x: Number(point.facing.x), y: Number(point.facing.y) } } : {}),
  };
}
