import {
  assetDepthFromPivot,
  worldDepthFromAnchorY,
  WORLD_DEPTH_BASE,
} from "../build/buildWorldGeometry.js";
import {
  HOUSE_TEXTURE_KEY,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  TREES_TEXTURE_KEY,
} from "./worldConfig.js";

export function createWorldPresentationRuntime(options) {
  return new WorldPresentationRuntime(options);
}

export class WorldPresentationRuntime {
  constructor({ renderingHost } = {}) {
    if (!renderingHost?.add) throw new Error("WorldPresentationRuntime requires a Phaser rendering host");
    this.renderingHost = renderingHost;
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
    sprite.setPosition(
      Math.round(tile.worldX + Number(visualOffset.x || 0)),
      Math.round(tile.worldY + Number(visualOffset.y || 0)),
    );
    sprite.setDepth(assetDepthFromPivot(
      { x: tile.worldX, y: tile.worldY },
      pivot,
      WORLD_DEPTH_BASE,
      tile.id,
    ));
    const crop = profile.visualCropInsets;
    if (crop) {
      const left = Math.max(0, Number(crop.left) || 0);
      const right = Math.max(0, Number(crop.right) || 0);
      const top = Math.max(0, Number(crop.top) || 0);
      const bottom = Math.max(0, Number(crop.bottom) || 0);
      const width = Math.max(1, tile.width - left - right);
      const height = Math.max(1, tile.height - top - bottom);
      sprite.setCrop(left, top, width, height);
    } else {
      sprite.setCrop();
    }
  }

  addTransportImage(tile) {
    const sprite = tile.frame == null
      ? this.renderingHost.add.image(tile.worldX, tile.worldY, tile.textureKey)
      : this.renderingHost.add.image(tile.worldX, tile.worldY, tile.textureKey, tile.frame);
    sprite.setOrigin(0, 0);
    const entry = { tile, sprite };
    this.syncTransportEntry(entry);
    return entry;
  }

  getTransitionAuthoringInstances() {
    return this.transportEntries.map(({ tile, sprite }) => ({
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
    }));
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
    const depth = worldDepthFromAnchorY((tile.worldY ?? tile.y * TILE_SIZE) + TILE_SIZE, tile.id);
    const extraSprites = (tile.supplements ?? []).map((supplement) => this.renderingHost.add
      .image(supplement.worldX, supplement.worldY, HOUSE_TEXTURE_KEY, supplement.frame)
      .setOrigin(0, 0)
      .setCrop(supplement.cropX, 0, supplement.cropWidth, TILE_SIZE)
      .setDepth(depth));
    this.worldRenderSprites.push(...extraSprites);
    const sprite = this.addCanonicalTile(tile, HOUSE_TEXTURE_KEY, depth);
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

function worldCellKey(point) {
  return `${point.x},${point.y}`;
}
