import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  ROOM_FRAMES,
  ROOM_SHEET,
} from "../src/visualConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playerDirectory = path.join(root, "public/assets/third-party/kenney/player");
const roomSheetPath = path.join(
  root,
  "public/assets/third-party/kenney/room/roguelikeSheet_transparent.png",
);

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

function countFrames(sourceSize, frameSize, margin, spacing, axisName) {
  const numerator = sourceSize - margin * 2 + spacing;
  const denominator = frameSize + spacing;
  assert.equal(
    numerator % denominator,
    0,
    `${axisName} does not divide into whole spritesheet frames`,
  );
  return numerator / denominator;
}

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

assert.ok(fs.existsSync(roomSheetPath), `Missing room spritesheet: ${roomSheetPath}`);
assert.deepEqual(readPngDimensions(roomSheetPath), {
  width: ROOM_SHEET.sourceWidth,
  height: ROOM_SHEET.sourceHeight,
});
assert.equal(ROOM_SHEET.margin, 0, "Kenney room sheet has no outer margin");
assert.equal(ROOM_SHEET.spacing, 1, "Kenney room sheet uses one-pixel spacing");

const columns = countFrames(
  ROOM_SHEET.sourceWidth,
  ROOM_SHEET.frameWidth,
  ROOM_SHEET.margin,
  ROOM_SHEET.spacing,
  "Spritesheet width",
);
const rows = countFrames(
  ROOM_SHEET.sourceHeight,
  ROOM_SHEET.frameHeight,
  ROOM_SHEET.margin,
  ROOM_SHEET.spacing,
  "Spritesheet height",
);
assert.equal(columns, 57);
assert.equal(rows, 31);

const frameCount = columns * rows;
for (const [name, frame] of Object.entries(ROOM_FRAMES)) {
  assert.ok(Number.isInteger(frame) && frame >= 0 && frame < frameCount, `${name} frame is invalid`);
}

console.log(`Visual asset checks passed: ${playerFiles.length} player frames, ${columns}x${rows} room sheet.`);
