import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  ROOM_TEXTURES,
  TILE_SIZE,
} from "../src/visualConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playerDirectory = path.join(root, "public/assets/third-party/kenney/player");

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  const signature = bytes.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", `${filePath} is not a PNG file`);
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR", `${filePath} has no IHDR`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

assert.equal(TILE_SIZE, 16);
assert.deepEqual(PLAYER_FRAMES.left, ["tile_0266", "tile_0293", "tile_0320"]);
assert.deepEqual(PLAYER_FRAMES.right, ["tile_0269", "tile_0296", "tile_0323"]);
assert.equal(PLAYER_IDLE_FRAME_INDEX, 0, "Idle must use the neutral first frame");
assert.deepEqual(Object.keys(ROOM_TEXTURES), [
  "floor",
  "wallHorizontal",
  "wallVertical",
  "corner",
]);
assert.equal(new Set(Object.values(ROOM_TEXTURES)).size, 4, "Room textures must use unique keys");

const playerFiles = Object.values(PLAYER_FRAMES).flat();
assert.equal(new Set(playerFiles).size, 12, "Player animation frames must be unique");

for (const frame of playerFiles) {
  const filePath = path.join(playerDirectory, `${frame}.png`);
  assert.ok(fs.existsSync(filePath), `Missing player frame: ${filePath}`);
  assert.deepEqual(readPngDimensions(filePath), { width: 16, height: 16 });
}

console.log(`Visual checks passed: ${playerFiles.length} player frames and 4 deterministic room textures.`);
