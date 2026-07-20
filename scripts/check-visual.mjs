import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYER_FRAMES, PLAYER_IDLE_FRAME_INDEX } from "../src/visualConfig.js";
import {
  BASIC_VILLAGE_ASSET_PATH,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOUSE_IMAGE_PATH,
  OUTDOOR_IMAGE_PATH,
  TILE_SIZE,
  TREES_IMAGE_PATH,
} from "../src/worldConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
const assetRoot = path.join(root, "public", BASIC_VILLAGE_ASSET_PATH);
const playerDirectory = path.join(root, "public/assets/third-party/kenney/player");

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const officialAssets = [
  {
    path: path.join(assetRoot, OUTDOOR_IMAGE_PATH),
    dimensions: { width: 192, height: 128 },
    sha256: "967806f572267b87787d05414e98350c9cb19f5eab426db6d4889d99b123f89c",
  },
  {
    path: path.join(assetRoot, HOUSE_IMAGE_PATH),
    dimensions: { width: 192, height: 160 },
    sha256: "89b48d140121ddec253b50d7e36c7bcae0c5b8e1168ae47b7cfeb5439b584085",
  },
  {
    path: path.join(assetRoot, TREES_IMAGE_PATH),
    dimensions: { width: 144, height: 96 },
    sha256: "55be641f0a0f8461c9bdd5f1a1fc2fef607428194df152197335eabc96dd9b5a",
  },
];

assert.equal(TILE_SIZE, 16);
assert.equal(GAME_WIDTH, 320);
assert.equal(GAME_HEIGHT, 180);
assert.equal(
  BASIC_VILLAGE_ASSET_PATH,
  "assets/third-party/basic-village",
  "Basic Village is the canonical environment asset root",
);
assert(/BASIC_VILLAGE_ASSET_PATH/.test(mainSource), "scene uses the canonical asset root");
assert(/load\.spritesheet/.test(mainSource), "verified 16x16 sheets are loaded as spritesheets");
assert(!/kenney-room|kenney-world-extension/.test(mainSource), "legacy Kenney environment atlases are unused");
assert(!/ROOM_SCALE|PLAYER_SCALE|Phaser\.Scale\.FIT/.test(mainSource));
assert(/Phaser\.Scale\.MAX_ZOOM/.test(mainSource), "display zoom remains integer");
assert(/Phaser\.Scale\.Events\.RESIZE/.test(mainSource), "zoom is recalculated after resize");
assert(/getMaxZoom\(\)/.test(mainSource), "integer zoom comes from Phaser max zoom");
assert(/startFollow\(this\.player, true, 1, 1\)/.test(mainSource), "camera follow uses rounded pixels");
assert(!/scroll[XY]\s*=\s*Math\.round/.test(mainSource), "camera follow is not overwritten manually");
assert(/pixelArt:\s*true/.test(mainSource));
assert(/antialias:\s*false/.test(mainSource));
assert(/roundPixels:\s*true/.test(mainSource));

for (const asset of officialAssets) {
  assert.deepEqual(readPngDimensions(asset.path), asset.dimensions);
  assert.equal(sha256(asset.path), asset.sha256, `official asset hash changed: ${asset.path}`);
}

assert.deepEqual(PLAYER_FRAMES.left, ["tile_0266", "tile_0293", "tile_0320"]);
assert.deepEqual(PLAYER_FRAMES.right, ["tile_0269", "tile_0296", "tile_0323"]);
assert.equal(PLAYER_IDLE_FRAME_INDEX, 0);
const playerFrames = Object.values(PLAYER_FRAMES).flat();
assert.equal(new Set(playerFrames).size, playerFrames.length, "player frame keys are unique");
for (const frame of playerFrames) {
  assert.deepEqual(readPngDimensions(path.join(playerDirectory, `${frame}.png`)), {
    width: 16,
    height: 16,
  });
}

console.log(
  "Visual checks passed: official Basic Village hashes, native 16px grid, integer zoom, rounded camera follow and player frames.",
);
