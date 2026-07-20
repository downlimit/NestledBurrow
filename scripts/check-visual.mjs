import assert from "node:assert/strict";
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

assert.equal(TILE_SIZE, 16);
assert.equal(GAME_WIDTH, 320);
assert.equal(GAME_HEIGHT, 180);
assert.equal(
  BASIC_VILLAGE_ASSET_PATH,
  "assets/third-party/basic-village",
  "Basic Village is the canonical environment asset root",
);
assert(/load\.spritesheet/.test(mainSource), "raw 16x16 sheets are used directly");
assert(!/kenney-room|kenney-world-extension/.test(mainSource), "old Kenney world atlases are not used");
assert(!/ROOM_SCALE|PLAYER_SCALE|Phaser\.Scale\.FIT/.test(mainSource));
assert(/Phaser\.Scale\.MAX_ZOOM/.test(mainSource));
assert(/startFollow\(this\.player, true, 1, 1\)/.test(mainSource));

assert.deepEqual(readPngDimensions(path.join(assetRoot, OUTDOOR_IMAGE_PATH)), {
  width: 192,
  height: 128,
});
assert.deepEqual(readPngDimensions(path.join(assetRoot, HOUSE_IMAGE_PATH)), {
  width: 192,
  height: 160,
});
assert.deepEqual(readPngDimensions(path.join(assetRoot, TREES_IMAGE_PATH)), {
  width: 144,
  height: 96,
});

assert.deepEqual(PLAYER_FRAMES.left, ["tile_0266", "tile_0293", "tile_0320"]);
assert.deepEqual(PLAYER_FRAMES.right, ["tile_0269", "tile_0296", "tile_0323"]);
assert.equal(PLAYER_IDLE_FRAME_INDEX, 0);
for (const frame of Object.values(PLAYER_FRAMES).flat()) {
  assert.deepEqual(readPngDimensions(path.join(playerDirectory, `${frame}.png`)), {
    width: 16,
    height: 16,
  });
}

console.log("Visual checks passed: Basic Village outdoor, house and tree sheets render on the native 16px grid.");
