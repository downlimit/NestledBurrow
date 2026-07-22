import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  PLAYER_WALK_FRAME_SEQUENCE,
} from "../src/visualConfig.js";
import {
  CHARACTER_VISUAL_PROFILE_IDS,
  CHARACTER_VISUAL_PROFILES,
  getCharacterVisualProfile,
} from "../src/characterVisualProfiles.js";
import { ACTOR_PROFILE_IDS } from "../src/actorProfiles.js";
import { NPCS } from "../src/npcConfig.js";
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
const visualConfigSource = fs.readFileSync(path.join(root, "src/visualConfig.js"), "utf8");
const visualProfilesSource = fs.readFileSync(path.join(root, "src/characterVisualProfiles.js"), "utf8");
const characterVisualSource = fs.readFileSync(path.join(root, "src/characterVisual.js"), "utf8");
const npcConfigSource = fs.readFileSync(path.join(root, "src/npcConfig.js"), "utf8");
const roomPreviewSource = fs.readFileSync(path.join(root, "scripts/check-room-preview.py"), "utf8");
const assetRoot = path.join(root, "public", BASIC_VILLAGE_ASSET_PATH);
const playerDirectory = path.join(root, "public/assets/third-party/kenney/player");
const npcManifestPath = path.join(root, "public/assets/third-party/kenney/npc-visual-profiles.manifest.json");
const npcManifest = JSON.parse(fs.readFileSync(npcManifestPath, "utf8"));

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


assert.equal(npcManifest.version, 1, "NPC visual manifest keeps version 1");
assert.equal(npcManifest.frameWidth, 16, "NPC visual manifest frame width is 16");
assert.equal(npcManifest.frameHeight, 16, "NPC visual manifest frame height is 16");
assert.deepEqual(npcManifest.walkFrameSequence, PLAYER_WALK_FRAME_SEQUENCE, "NPC manifest walk cadence matches runtime cadence");
assert.equal(npcManifest.idleFrameIndex, PLAYER_IDLE_FRAME_INDEX, "NPC manifest idle frame matches runtime idle index");

const homeVisual = getCharacterVisualProfile(CHARACTER_VISUAL_PROFILE_IDS.homeNpc);
const streetVisual = getCharacterVisualProfile(CHARACTER_VISUAL_PROFILE_IDS.streetNpc);
const playerVisual = getCharacterVisualProfile(CHARACTER_VISUAL_PROFILE_IDS.player);
assert(CHARACTER_VISUAL_PROFILES[CHARACTER_VISUAL_PROFILE_IDS.player], "player visual profile is registered");
assert(CHARACTER_VISUAL_PROFILES[CHARACTER_VISUAL_PROFILE_IDS.homeNpc], "home NPC visual profile is registered");
assert(CHARACTER_VISUAL_PROFILES[CHARACTER_VISUAL_PROFILE_IDS.streetNpc], "street NPC visual profile is registered");
assert(Object.isFrozen(CHARACTER_VISUAL_PROFILES), "visual profile registry is immutable");
assert(Object.isFrozen(homeVisual.resources[0]), "visual profile resources are immutable");
assert.equal(new Set([playerVisual.animationPrefix, homeVisual.animationPrefix, streetVisual.animationPrefix]).size, 3, "animation prefixes do not conflict");
assert.notEqual(homeVisual.resources[0].textureKey, streetVisual.resources[0].textureKey, "home and street texture keys differ");
assert.notEqual(homeVisual.resources[0].path, streetVisual.resources[0].path, "home and street asset paths differ");
assert.throws(() => getCharacterVisualProfile("missing"), /Unknown character visual profile ID: missing/);
assert.equal(NPCS.find((npc) => npc.id === "home-npc").profileId, ACTOR_PROFILE_IDS.villager, "home NPC keeps villager movement profile");
assert.equal(NPCS.find((npc) => npc.id === "street-npc").profileId, ACTOR_PROFILE_IDS.villager, "street NPC keeps villager movement profile");
assert.equal(NPCS.find((npc) => npc.id === "home-npc").visualProfileId, CHARACTER_VISUAL_PROFILE_IDS.homeNpc, "home NPC config chooses home visual profile");
assert.equal(NPCS.find((npc) => npc.id === "street-npc").visualProfileId, CHARACTER_VISUAL_PROFILE_IDS.streetNpc, "street NPC config chooses street visual profile");
assert(!/entityId\s*===\s*["']home-npc|entityId\s*===\s*["']street-npc/.test(characterVisualSource), "CharacterVisual has no hardcoded NPC entity branching");
assert(/import\.meta\.env\.BASE_URL/.test(mainSource), "character asset paths use Vite BASE_URL");
assert(/load\.spritesheet/.test(mainSource), "character spritesheets are loaded declaratively");
assert(!/PLAYER_ASSET_URL/.test(mainSource), "preload no longer has a player-only asset URL fallback");
assert(!/copy|fallback/i.test(visualProfilesSource), "visual profiles do not define fallback or copied assets");

const removedSourcePaths = ["src/kenneyRoomConfig.json", "src/roomLayout.js"];
const removedPublicAtlasPaths = [
  "public/room/kenney-room-tiles.png",
  "public/room/kenney-room-tiles.json",
  "public/world/kenney-world-extension.png",
  "public/world/kenney-world-extension.json",
  "public/assets/third-party/kenney/room/kenney-room-tiles.png",
  "public/assets/third-party/kenney/room/kenney-room-tiles.json",
  "public/assets/third-party/kenney/world/kenney-world-extension.png",
  "public/assets/third-party/kenney/world/kenney-world-extension.json",
];

assert(!/kenneyRoomConfig\.json/.test(visualConfigSource), "visualConfig must not import legacy room config JSON");
assert(!/\bROOM_(TEXTURE_KEY|IMAGE_PATH|ATLAS_PATH)\b/.test(visualConfigSource), "legacy ROOM_* exports were removed");
for (const relativePath of [...removedSourcePaths, ...removedPublicAtlasPaths]) {
  assert(!fs.existsSync(path.join(root, relativePath)), `legacy path was removed: ${relativePath}`);
}

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
assert(!/kenney-room|kenney-world-extension/.test(mainSource), "runtime does not reference removed legacy atlases");
assert(!/ROOM_SCALE|PLAYER_SCALE|Phaser\.Scale\.FIT/.test(mainSource));
assert(/Phaser\.Scale\.MAX_ZOOM/.test(mainSource), "display zoom remains integer");
assert(/Phaser\.Scale\.Events\.RESIZE/.test(mainSource), "zoom is recalculated after resize");
assert(/getMaxZoom\(\)/.test(mainSource), "integer zoom comes from Phaser max zoom");
assert(/startFollow\(this\.player, true, 1, 1\)/.test(mainSource), "camera follow uses rounded pixels");
assert(!/scroll[XY]\s*=\s*Math\.round/.test(mainSource), "camera follow is not overwritten manually");
assert(/pixelArt:\s*true/.test(mainSource));
assert(/antialias:\s*false/.test(mainSource));
assert(/roundPixels:\s*true/.test(mainSource));
assert(/basic-village/.test(roomPreviewSource), "room preview uses Basic Village environment assets");
assert(/kenney"\s*\/\s*"player/.test(roomPreviewSource), "room preview uses active Kenney player sprites");
assert(!/kenney-room|kenney-world-extension|public\/room|public\/world/.test(roomPreviewSource), "room preview does not use removed legacy atlases");


const npcVisualAssets = [
  { id: CHARACTER_VISUAL_PROFILE_IDS.homeNpc, profile: homeVisual, manifest: npcManifest.profiles["home-npc"] },
  { id: CHARACTER_VISUAL_PROFILE_IDS.streetNpc, profile: streetVisual, manifest: npcManifest.profiles["street-npc"] },
];
for (const { id, profile, manifest } of npcVisualAssets) {
  const resource = profile.resources[0];
  const filePath = path.join(root, "public", resource.path);
  assert.equal(resource.type, "spritesheet", `${id} uses a spritesheet resource`);
  assert.equal(resource.path, manifest.sheetPath, `${id} sheet path matches manifest`);
  assert.equal(resource.textureKey, manifest.textureKey, `${id} texture key matches manifest`);
  assert.equal(resource.frameWidth, npcManifest.frameWidth, `${id} frame width matches manifest`);
  assert.equal(resource.frameHeight, npcManifest.frameHeight, `${id} frame height matches manifest`);
  assert.deepEqual(readPngDimensions(filePath), { width: 48, height: 64 }, `${id} sheet dimensions are 48x64`);
  assert.equal(sha256(filePath), manifest.sha256, `${id} sheet hash matches manifest`);
  assert.equal((48 / resource.frameWidth) * (64 / resource.frameHeight), 12, `${id} sheet contains exactly 12 frames`);
  for (const [facing, manifestFrames] of Object.entries(manifest.frames)) {
    assert.equal(profile.frames[facing].length, 3, `${id} ${facing} has three directional frames`);
    assert.deepEqual(profile.frames[facing].map((frame) => frame.frame), manifestFrames, `${id} ${facing} mapping matches manifest`);
    assert.deepEqual(
      profile.walkFrameSequence.map((frameIndex) => profile.frames[facing][frameIndex].frame),
      [manifestFrames[1], manifestFrames[0], manifestFrames[2], manifestFrames[0]],
      `${id} ${facing} walk cadence is step-a, neutral, step-b, neutral`,
    );
    assert.equal(profile.frames[facing][profile.idleFrameIndex].frame, manifestFrames[0], `${id} ${facing} idle uses neutral`);
  }
}
assert.equal(playerVisual.resources[0].type, "images", "player uses separate image resources");
assert.equal(playerVisual.resources[0].path, "assets/third-party/kenney/player", "player keeps existing player asset directory");

for (const asset of officialAssets) {
  assert.deepEqual(readPngDimensions(asset.path), asset.dimensions);
  assert.equal(sha256(asset.path), asset.sha256, `official asset hash changed: ${asset.path}`);
}

assert.deepEqual(PLAYER_FRAMES.left, ["tile_0266", "tile_0293", "tile_0320"]);
assert.deepEqual(PLAYER_FRAMES.right, ["tile_0269", "tile_0296", "tile_0323"]);
assert.equal(PLAYER_IDLE_FRAME_INDEX, 0, "idle uses the neutral source frame at index 0");
assert.deepEqual(
  PLAYER_WALK_FRAME_SEQUENCE,
  [1, PLAYER_IDLE_FRAME_INDEX, 2, PLAYER_IDLE_FRAME_INDEX],
  "walk cadence is stepA, neutral, stepB, neutral",
);

const preloadTextureKeys = Object.values(PLAYER_FRAMES).flat();
assert.equal(
  new Set(preloadTextureKeys).size,
  preloadTextureKeys.length,
  "preload texture keys do not contain duplicates",
);
assert(/getUsedCharacterVisualProfiles/.test(mainSource), "preload derives character resources from used visual profiles");
assert(/visual\.walkFrameSequence\.map/.test(mainSource), "runtime animations use each visual profile walk sequence");

for (const [facing, sourceFrames] of Object.entries(PLAYER_FRAMES)) {
  assert.equal(sourceFrames.length, 3, `${facing} keeps three source texture frames`);
  const animationFrames = PLAYER_WALK_FRAME_SEQUENCE.map(
    (frameIndex) => sourceFrames[frameIndex],
  );
  assert.equal(animationFrames.length, 4, `${facing} animation has four frames`);
  assert.deepEqual(
    animationFrames,
    [
      sourceFrames[1],
      sourceFrames[PLAYER_IDLE_FRAME_INDEX],
      sourceFrames[2],
      sourceFrames[PLAYER_IDLE_FRAME_INDEX],
    ],
    `${facing} animation follows stepA, neutral, stepB, neutral`,
  );
  assert.equal(
    animationFrames[1],
    animationFrames[3],
    `${facing} neutral repeats in phases 2 and 4`,
  );
  assert.notEqual(animationFrames[0], animationFrames[2], `${facing} step frames differ`);
  assert.equal(
    sourceFrames[PLAYER_IDLE_FRAME_INDEX],
    animationFrames[1],
    `${facing} idle frame is neutral`,
  );
}

for (const frame of preloadTextureKeys) {
  assert.deepEqual(readPngDimensions(path.join(playerDirectory, `${frame}.png`)), {
    width: 16,
    height: 16,
  });
}

console.log(
  "Visual checks passed: legacy room sources/public atlases removed, Basic Village hashes, native 16px grid, integer zoom, rounded camera follow and four-phase player walk cadence.",
);
