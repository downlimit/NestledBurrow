import { worldDepthFromAnchorY } from "./buildWorldGeometry.js";
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
    this.transportSprites = (layout.transportTiles ?? []).map((tile) => {
      const sprite = this.renderingHost.add.image(tile.worldX, tile.worldY, tile.textureKey, tile.frame)
        .setOrigin(0, 0)
        .setDepth(tile.depth);
      if (tile.crop) sprite.setCrop(tile.crop.x, 0, tile.crop.width, TILE_SIZE);
      this.worldRenderSprites.push(sprite);
      return sprite;
    });
    return this.getBuildSurfaceRegistries();
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
