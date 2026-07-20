import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRoomLayout, ROOM_WALL_BANDS } from "../src/roomLayout.js";
import { PLAYER_FRAMES, PLAYER_IDLE_FRAME_INDEX } from "../src/visualConfig.js";
import { GAME_HEIGHT, GAME_WIDTH, ROOM_ATLAS_PATH, ROOM_IMAGE_PATH, ROOM_TEXTURE_KEY, TILE_SIZE, WORLD_ATLAS_PATH, WORLD_IMAGE_PATH, WORLD_TEXTURE_KEY } from "../src/worldConfig.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playerDirectory = path.join(root, "public/assets/third-party/kenney/player");
const assetRoot = path.join(root, "public/assets/third-party/kenney");
const configPath = path.join(root, "src/kenneyRoomConfig.json");
const roomConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");

function readPngDimensions(filePath) { const bytes = fs.readFileSync(filePath); assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a"); assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR"); return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }; }
function sha256(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }

assert.equal(TILE_SIZE, 16);
assert.equal(GAME_WIDTH, 320);
assert.equal(GAME_HEIGHT, 180);
assert.equal(ROOM_TEXTURE_KEY, "kenney-room");
assert.equal(WORLD_TEXTURE_KEY, "kenney-world-extension");
assert(!/ROOM_SCALE|PLAYER_SCALE|Phaser\.Scale\.FIT/.test(mainSource), "no independent world-art scales or FIT resampling");
assert(/Phaser\.Scale\.MAX_ZOOM/.test(mainSource), "integer display zoom is required");
assert.deepEqual(PLAYER_FRAMES.left, ["tile_0266", "tile_0293", "tile_0320"]);
assert.deepEqual(PLAYER_FRAMES.right, ["tile_0269", "tile_0296", "tile_0323"]);
assert.equal(PLAYER_IDLE_FRAME_INDEX, 0);
for (const frame of Object.values(PLAYER_FRAMES).flat()) assert.deepEqual(readPngDimensions(path.join(playerDirectory, `${frame}.png`)), { width: 16, height: 16 });

const roomImagePath = path.join(assetRoot, ROOM_IMAGE_PATH), roomAtlasPath = path.join(assetRoot, ROOM_ATLAS_PATH);
const worldImagePath = path.join(assetRoot, WORLD_IMAGE_PATH), worldAtlasPath = path.join(assetRoot, WORLD_ATLAS_PATH);
assert.deepEqual(readPngDimensions(roomImagePath), { width: 176, height: 16 });
assert.deepEqual(readPngDimensions(worldImagePath), { width: 128, height: 16 });
assert.equal(sha256(roomImagePath), roomConfig.atlasSha256);
assert.equal(sha256(worldImagePath), roomConfig.extension.atlasSha256);
const roomAtlas = JSON.parse(fs.readFileSync(roomAtlasPath, "utf8"));
const worldAtlas = JSON.parse(fs.readFileSync(worldAtlasPath, "utf8"));
assert.deepEqual(Object.keys(roomAtlas.frames), Object.keys(roomConfig.tiles).filter((k) => roomAtlas.frames[k]));
for (const name of ["grass", "dirtPath", "wallOuterUpperLeft", "wallOuterUpperRight", "wallMiddleUpperLeft", "wallMiddleUpperRight", "wallInnerUpperLeft", "wallInnerUpperRight"]) assert.ok(worldAtlas.frames[name], `missing extension frame ${name}`);
assert.deepEqual(ROOM_WALL_BANDS, roomConfig.wallBands);
const layout = buildRoomLayout(30, 16, { doorway: { left: 14, width: 2 } });
assert.equal(layout.length, 16); assert.ok(layout.every((row) => row.length === 30));
console.log("Visual checks passed: unified 320x180 grid, native 16px player/world art, room and extension atlases audited.");
