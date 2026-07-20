import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRoomLayout, ROOM_WALL_BANDS } from "../src/roomLayout.js";
import {
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  ROOM_ATLAS_PATH,
  ROOM_IMAGE_PATH,
  ROOM_SCALE,
  ROOM_TEXTURE_KEY,
  TILE_SIZE,
} from "../src/visualConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playerDirectory = path.join(root, "public/assets/third-party/kenney/player");
const roomDirectory = path.join(root, "public/assets/third-party/kenney");
const configPath = path.join(root, "src/kenneyRoomConfig.json");
const roomConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const roomImagePath = path.join(roomDirectory, ROOM_IMAGE_PATH);
const roomAtlasPath = path.join(roomDirectory, ROOM_ATLAS_PATH);
const roomAtlas = JSON.parse(fs.readFileSync(roomAtlasPath, "utf8"));

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

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

assert.equal(TILE_SIZE, 16);
assert.equal(ROOM_SCALE, 2);
assert.equal(ROOM_TEXTURE_KEY, "kenney-room");
assert.deepEqual(PLAYER_FRAMES.left, ["tile_0266", "tile_0293", "tile_0320"]);
assert.deepEqual(PLAYER_FRAMES.right, ["tile_0269", "tile_0296", "tile_0323"]);
assert.equal(PLAYER_IDLE_FRAME_INDEX, 0, "Idle must use the neutral first frame");

const playerFiles = Object.values(PLAYER_FRAMES).flat();
assert.equal(new Set(playerFiles).size, 12, "Player animation frames must be unique");
for (const frame of playerFiles) {
  const filePath = path.join(playerDirectory, `${frame}.png`);
  assert.ok(fs.existsSync(filePath), `Missing player frame: ${filePath}`);
  assert.deepEqual(readPngDimensions(filePath), { width: 16, height: 16 });
}

assert.ok(fs.existsSync(roomImagePath), `Missing room atlas image: ${roomImagePath}`);
assert.ok(fs.existsSync(roomAtlasPath), `Missing room atlas data: ${roomAtlasPath}`);
assert.deepEqual(readPngDimensions(roomImagePath), { width: 176, height: 16 });
assert.equal(sha256(roomImagePath), roomConfig.atlasSha256, "Room atlas image was not audited");
assert.match(roomConfig.approvedPreviewSha256, /^[a-f0-9]{64}$/);

const expectedFrameNames = Object.keys(roomConfig.tiles);
assert.deepEqual(Object.keys(roomAtlas.frames), expectedFrameNames);
assert.equal(roomAtlas.meta.image, path.basename(ROOM_IMAGE_PATH));
assert.deepEqual(roomAtlas.meta.size, { w: 176, h: 16 });
assert.equal(new Set(expectedFrameNames).size, expectedFrameNames.length);
assert.equal(new Set(Object.values(roomConfig.tiles).map((tile) => tile.sourceFrame)).size, expectedFrameNames.length);

expectedFrameNames.forEach((name, index) => {
  const atlasFrame = roomAtlas.frames[name].frame;
  const sourceTile = roomConfig.tiles[name];
  assert.deepEqual(atlasFrame, { x: index * TILE_SIZE, y: 0, w: TILE_SIZE, h: TILE_SIZE });
  assert.ok(Number.isInteger(sourceTile.sourceFrame) && sourceTile.sourceFrame >= 0);
  assert.match(sourceTile.sourceSha256, /^[a-f0-9]{64}$/);
});

assert.equal(roomConfig.source.margin, 0);
assert.equal(roomConfig.source.spacing, 1);
assert.equal(roomConfig.source.columns, 57);
assert.equal(roomConfig.source.rows, 31);
assert.equal(roomConfig.source.sheetWidth, 968);
assert.equal(roomConfig.source.sheetHeight, 526);
assert.deepEqual(ROOM_WALL_BANDS, roomConfig.wallBands);

const layout = buildRoomLayout(30, 16);
assert.equal(layout.length, 16);
assert.ok(layout.every((row) => row.length === 30));
assert.ok(layout.flat().every((frame) => expectedFrameNames.includes(frame)));

const counts = Object.fromEntries(expectedFrameNames.map((name) => [name, 0]));
layout.flat().forEach((frame) => {
  counts[frame] += 1;
});
assert.equal(counts.floor, 280);
assert.equal(counts.wallVertical, 20);
for (const band of roomConfig.wallBands) {
  assert.equal(counts[band.left], 2);
  assert.equal(counts[band.center], 56);
  assert.equal(counts[band.right], 2);
}

console.log(
  `Visual checks passed: ${playerFiles.length} player frames, ${expectedFrameNames.length} audited room frames, 30x16 semantic layout.`,
);
