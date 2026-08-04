import { createMovementState } from "../character/characterMovement.js";
import { getResourceObjectsForWorld } from "../resources/resourceConfig.js";
import {
  getWorldLocationDefinition,
  resolveWorldLocationId,
  TRANSPORT_PROFILE,
  WORLD_IDS,
  WORLD_LOCATION_DEFINITIONS,
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

  update() {
    if (this.destroyed || this.switching || !this.activeLayout) return { status: "idle", transitioned: false };
    const player = this.getPlayerCharacter();
    const position = player?.motor?.position;
    if (!position) return { status: "idle", transitioned: false };

    if (this.lockedTransportId) {
      const destinationTransport = this.activeLayout.transitions.find(({ id }) => id === this.lockedTransportId);
      if (!destinationTransport || !contains(destinationTransport.triggerBounds, position)) this.lockedTransportId = null;
      return { status: this.lockedTransportId ? "locked" : "armed", transitioned: false };
    }

    if (!this.canTransition()) return { status: "suppressed", transitioned: false };
    const transition = this.activeLayout.transitions.find(({ triggerBounds }) => contains(triggerBounds, position));
    if (!transition) return { status: "armed", transitioned: false };
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
      right: left + TRANSPORT_PROFILE.footprint.width,
      bottom: top + TRANSPORT_PROFILE.footprint.height,
    });
    for (const shell of TRANSPORT_PROFILE.shell) {
      layout.setWorldObjectCollider(
        `${placement.id}:shell:${shell.id}`,
        {
          left: left + shell.left,
          top: top + shell.top,
          right: left + shell.right,
          bottom: top + shell.bottom,
        },
        `transport:${TRANSPORT_PROFILE.id}`,
        { fixed: true, transportId: placement.id },
      );
    }
    for (const part of TRANSPORT_PROFILE.visuals) {
      transportTiles.push(Object.freeze({
        id: `${placement.id}:visual:${transportTiles.length}`,
        worldX: left + part.x * TILE_SIZE,
        worldY: top + part.y * TILE_SIZE,
        textureKey: part.textureKey ?? TRANSPORT_PROFILE.textureKey,
        frame: part.frame,
        crop: part.crop ? { ...part.crop } : null,
        depth: 560 + top + TRANSPORT_PROFILE.footprint.height,
      }));
    }
    transitions.push(Object.freeze({
      ...placement,
      footprintBounds,
      triggerBounds: Object.freeze({
        left: left + TRANSPORT_PROFILE.trigger.left,
        top: top + TRANSPORT_PROFILE.trigger.top,
        right: left + TRANSPORT_PROFILE.trigger.right,
        bottom: top + TRANSPORT_PROFILE.trigger.bottom,
      }),
      safeSpawn: Object.freeze(clonePoint(placement.safeSpawn)),
    }));
  }
  layout.transportTiles = Object.freeze(transportTiles);
  layout.transitions = Object.freeze(transitions);
  return layout;
}

export { WORLD_LOCATION_DEFINITIONS };

function contains(bounds, point) {
  return point.x >= bounds.left && point.x < bounds.right
    && point.y >= bounds.top && point.y < bounds.bottom;
}

function clonePoint(point) {
  return {
    x: Number(point.x),
    y: Number(point.y),
    ...(point.facing ? { facing: { x: Number(point.facing.x), y: Number(point.facing.y) } } : {}),
  };
}
