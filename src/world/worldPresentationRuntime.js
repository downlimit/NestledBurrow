import {
  getBuildWallCapDepthOffset,
  getBuildWallEdgeDepthOffset,
  getBuildWallEdgeVisualOffset,
  isBuildWallCapFrame,
} from "../build/buildAssetCatalog.js";
import {
  assetDepthFromRenderMode,
  WALL_COLLIDER_GROUPS,
  worldDepthFromAnchorY,
  WORLD_DEPTH_BASE,
} from "../build/buildWorldGeometry.js";
import { updateFixedWorldInstance } from "../build/fixedWorldAuthoringState.js";
import {
  HOUSE_TEXTURE_KEY,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  TREES_TEXTURE_KEY,
  WORLD_GROUND_OVERLAY_DEPTH,
  WORLD_TRANSITION_PROFILE_KEYS,
} from "./worldConfig.js";

export function createWorldPresentationRuntime(options) {
  return new WorldPresentationRuntime(options);
}

export class WorldPresentationRuntime {
  constructor({ renderingHost, authoringStorage = globalThis.localStorage } = {}) {
    if (!renderingHost?.add) throw new Error("WorldPresentationRuntime requires a Phaser rendering host");
    this.renderingHost = renderingHost;
    this.authoringStorage = authoringStorage;
    this.destroyed = false;
    this.activeLayout = null;
    this.worldRenderSprites = [];
    this.transportSprites = [];
    this.transportEntries = [];
    this.groundSprites = new Map();
    this.floorSprites = new Map();
    this.wallSprites = new Map();
  }

  mount(layout) {
    if (this.destroyed) throw new Error("WorldPresentationRuntime is destroyed");
    this.unmount();
    this.activeLayout = layout;
    for (const tile of layout.groundTiles) {
      const sprite = this.addCanonicalTile(tile, OUTDOOR_TEXTURE_KEY, 0);
      this.groundSprites.set(worldCellKey({ x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE }), { sprite, tile });
    }
    for (const tile of layout.houseFloorTiles) {
      const sprite = this.addCanonicalTile(tile, HOUSE_TEXTURE_KEY, 20);
      this.floorSprites.set(worldCellKey({ x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE }), { sprite, tile });
    }
    for (const tile of layout.houseWallTiles) {
      this.wallSprites.set(tile.id, this.createCanonicalWallEntry(tile));
    }
    for (const tile of layout.decorationTiles) this.addCanonicalTile(tile, TREES_TEXTURE_KEY, tile.depth);
    this.transportEntries = (layout.transportTiles ?? []).map((tile) => this.addTransportImage(tile));
    this.transportSprites = this.transportEntries.map(({ sprite }) => sprite);
    this.worldRenderSprites.push(...this.transportSprites);
    return this.getBuildSurfaceRegistries();
  }

  transitionProfile(profileKey) {
    return this.renderingHost?.assetProfiles?.[profileKey] ?? {};
  }

  syncTransportEntry(entry) {
    const { tile, sprite } = entry;
    const profile = this.transitionProfile(tile.profileKey);
    const visualOffset = profile.visualOffset ?? { x: 0, y: 0 };
    const pivot = profile.snapAnchorOffset ?? { x: tile.width / 2, y: tile.height };
    sprite.setPosition?.(
      Math.round(tile.worldX + Number(visualOffset.x || 0)),
      Math.round(tile.worldY + Number(visualOffset.y || 0)),
    );
    sprite.setDepth?.(assetDepthFromRenderMode({
      placementPosition: { x: tile.worldX, y: tile.worldY },
      pivotOffset: pivot,
      renderMode: profile.renderMode ?? (isGroundOverlayTransition(tile.profileKey) ? "below-character" : "pivot-depth"),
      fixedBelowDepth: WORLD_GROUND_OVERLAY_DEPTH,
      baseDepth: WORLD_DEPTH_BASE,
      stableId: tile.id,
    }));
    const crop = profile.visualCropInsets;
    if (crop) {
      const left = Math.max(0, Number(crop.left) || 0);
      const right = Math.max(0, Number(crop.right) || 0);
      const top = Math.max(0, Number(crop.top) || 0);
      const bottom = Math.max(0, Number(crop.bottom) || 0);
      const width = Math.max(1, tile.width - left - right);
      const height = Math.max(1, tile.height - top - bottom);
      sprite.setCrop?.(left, top, width, height);
    } else {
      sprite.setCrop?.();
    }
  }

  addTransportImage(tile) {
    const sprite = tile.frame == null
      ? this.renderingHost.add.image(tile.worldX, tile.worldY, tile.textureKey)
      : this.renderingHost.add.image(tile.worldX, tile.worldY, tile.textureKey, tile.frame);
    sprite.setOrigin?.(0, 0);
    const entry = { tile, sprite };
    this.syncTransportEntry(entry);
    return entry;
  }

  getTransitionAuthoringInstances() {
    return this.transportEntries.map((entry) => {
      const { tile, sprite } = entry;
      const collisionEnabled = this.transitionCollisionEnabled(tile.id);
      return ({
      id: tile.id,
      profileKey: tile.profileKey,
      anchor: { x: tile.worldX, y: tile.worldY },
      bounds: {
        left: tile.worldX,
        right: tile.worldX + tile.width,
        top: tile.worldY,
        bottom: tile.worldY + tile.height,
      },
      visualBasePosition: { x: tile.worldX, y: tile.worldY },
      targets: [sprite],
      special: true,
      fixedWorld: true,
      placementPosition: { x: tile.worldX, y: tile.worldY },
      snapAnchorOffset: { ...(this.transitionProfile(tile.profileKey).snapAnchorOffset ?? { x: 0, y: 0 }) },
      collisionEnabled,
      getCollisionEnabled: () => this.transitionCollisionEnabled(tile.id),
      setCollisionEnabled: (enabled) => this.setTransitionCollisionEnabled(tile.id, enabled),
      move: (point) => this.moveTransitionAuthoringInstance(tile.id, point),
      ...(isGroundOverlayTransition(tile.profileKey)
        ? { depthMode: "fixed", fixedDepth: WORLD_GROUND_OVERLAY_DEPTH }
        : {}),
      });
    });
  }

  transitionCollisionEnabled(id) {
    const entry = this.activeLayout?.getWorldObjectColliders?.().find((candidate) => candidate.id === id);
    return entry?.collisionEnabled !== false;
  }

  syncTransitionCollider(entry, collisionEnabled = this.transitionCollisionEnabled(entry.tile.id)) {
    const transition = this.activeLayout?.transitions?.find(({ id }) => id === entry.tile.id);
    if (!transition) return null;
    const base = {
      left: entry.tile.worldX + transition.collider.left,
      right: entry.tile.worldX + transition.collider.right,
      top: entry.tile.worldY + transition.collider.top,
      bottom: entry.tile.worldY + transition.collider.bottom,
    };
    this.activeLayout.setWorldObjectCollider?.(entry.tile.id, base, entry.tile.profileKey, {
      kind: transition.kind ?? "world-transition",
      profileKey: entry.tile.profileKey,
      collisionEnabled: Boolean(collisionEnabled),
    });
    return base;
  }

  moveTransitionAuthoringInstance(id, point) {
    const entry = this.transportEntries.find((candidate) => candidate.tile.id === id);
    if (!entry) return null;
    const previous = { x: entry.tile.worldX, y: entry.tile.worldY };
    const current = { x: Math.round(Number(point?.x) || 0), y: Math.round(Number(point?.y) || 0) };
    const collisionEnabled = this.transitionCollisionEnabled(id);
    entry.tile = Object.freeze({ ...entry.tile, worldX: current.x, worldY: current.y });
    this.activeLayout.transportTiles = Object.freeze(this.transportEntries.map((candidate) => candidate.tile));
    this.activeLayout.transitions = Object.freeze(this.activeLayout.transitions.map((transition) => (
      transition.id === id
        ? Object.freeze({
            ...transition,
            footprintBounds: Object.freeze({
              left: current.x,
              top: current.y,
              right: current.x + entry.tile.width,
              bottom: current.y + entry.tile.height,
            }),
          })
        : transition
    )));
    updateFixedWorldInstance(id, { ...current, collisionEnabled }, previous, this.authoringStorage);
    this.syncTransitionCollider(entry, collisionEnabled);
    this.syncTransportEntry(entry);
    this.renderingHost?.interactionRuntime?.refresh?.();
    return { previous, current };
  }

  setTransitionCollisionEnabled(id, enabled) {
    const entry = this.transportEntries.find((candidate) => candidate.tile.id === id);
    if (!entry) return null;
    const collisionEnabled = Boolean(enabled);
    const point = { x: entry.tile.worldX, y: entry.tile.worldY };
    updateFixedWorldInstance(id, { ...point, collisionEnabled }, point, this.authoringStorage);
    this.syncTransitionCollider(entry, collisionEnabled);
    this.renderingHost?.interactionRuntime?.refresh?.();
    return collisionEnabled;
  }

  applyTransitionAuthoringProfile(profileKey = null) {
    for (const entry of this.transportEntries) {
      if (profileKey && entry.tile.profileKey !== profileKey) continue;
      this.syncTransportEntry(entry);
    }
  }

  addCanonicalTile(tile, textureKey, depth) {
    const sprite = this.renderingHost.add
      .image(tile.worldX ?? tile.x * TILE_SIZE, tile.worldY ?? tile.y * TILE_SIZE, textureKey, tile.frame)
      .setOrigin(0, 0)
      .setDepth(depth);
    this.worldRenderSprites.push(sprite);
    return sprite;
  }

  createCanonicalWallEntry(tile) {
    const edgeAnchorY = Number(tile.y);
    const profileKey = tile.orientation === "vertical"
      ? WALL_COLLIDER_GROUPS.vertical
      : WALL_COLLIDER_GROUPS.horizontal;
    const profile = this.renderingHost?.assetProfiles?.[profileKey] ?? {};
    const visualOffset = profile.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = profile.snapAnchorOffset ?? { x: 0, y: 0 };
    const visualOffsetY = getBuildWallEdgeVisualOffset(tile.orientation) + Number(visualOffset.y || 0);
    const baseDepthOffset = getBuildWallEdgeDepthOffset(tile.orientation);
    const spriteDepthOffset = isBuildWallCapFrame(tile.frame)
      ? getBuildWallCapDepthOffset()
      : baseDepthOffset;
    const depth = worldDepthFromAnchorY(edgeAnchorY + spriteDepthOffset + Number(pivotOffset.y || 0), tile.id);
    const supplementDepth = worldDepthFromAnchorY(edgeAnchorY + baseDepthOffset + Number(pivotOffset.y || 0), `${tile.id}:supplement`);
    const extraSprites = (tile.supplements ?? []).map((supplement) => this.renderingHost.add
      .image(supplement.worldX + Number(visualOffset.x || 0), supplement.worldY + visualOffsetY, HOUSE_TEXTURE_KEY, supplement.frame)
      .setOrigin(0, 0)
      .setCrop(supplement.cropX, 0, supplement.cropWidth, TILE_SIZE)
      .setDepth(supplementDepth));
    this.worldRenderSprites.push(...extraSprites);
    const sprite = this.addCanonicalTile(tile, HOUSE_TEXTURE_KEY, depth);
    sprite.setPosition?.(
      (tile.worldX ?? tile.x * TILE_SIZE) + Number(visualOffset.x || 0),
      (tile.worldY ?? tile.y * TILE_SIZE) + visualOffsetY,
    );
    return { sprite, extraSprites, tile };
  }

  getBuildSurfaceRegistries() {
    return Object.freeze({
      groundSprites: this.groundSprites,
      floorSprites: this.floorSprites,
      wallSprites: this.wallSprites,
    });
  }

  unmount() {
    for (const sprite of this.worldRenderSprites) sprite?.destroy?.();
    this.worldRenderSprites = [];
    this.transportSprites = [];
    this.transportEntries = [];
    this.groundSprites.clear();
    this.floorSprites.clear();
    this.wallSprites.clear();
    this.activeLayout = null;
  }

  destroy() {
    if (this.destroyed) return;
    this.unmount();
    this.destroyed = true;
    this.renderingHost = null;
  }
}

function isGroundOverlayTransition(profileKey) {
  return profileKey === WORLD_TRANSITION_PROFILE_KEYS.burrowToNest;
}

function worldCellKey(point) {
  return `${point.x},${point.y}`;
}
