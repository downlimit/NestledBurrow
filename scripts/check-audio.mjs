import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS, clampVolume, createAudioSettingsStore, deserializeAudioSettings, getEffectiveEffectsVolume, getEffectiveMusicVolume } from "../src/audioSettings.js";
import { MUSIC_CROSSFADE_SECONDS, MUSIC_FADE_OUT_SECONDS, MUSIC_PLAYLIST, PROCEDURAL_SFX, PhaserAudioRuntime, choosePlaylistTrack, getFadeEnvelope, getMusicUrl } from "../src/audioRuntime.js";
import { getResourceProfile, resourceEffectType } from "../src/resourceDomain.js";

function memory() { const data = new Map(); return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }; }
function hash(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

assert.deepEqual(DEFAULT_AUDIO_SETTINGS, { master: 1, music: 0.5, effects: 1 });
assert.deepEqual(deserializeAudioSettings("{").settings, DEFAULT_AUDIO_SETTINGS);
assert.equal(clampVolume(-1), 0); assert.equal(clampVolume(2), 1);
assert.equal(getEffectiveMusicVolume({ master: 0.4, music: 0.25, effects: 1 }), 0.1);
assert.equal(getEffectiveEffectsVolume({ master: 0.4, music: 0.25, effects: 0.5 }), 0.2);
assert.notDeepEqual(PROCEDURAL_SFX.chop, PROCEDURAL_SFX.mine);
const task047Effects = [
  "wood-hit", "stone-hit", "ruby-hit", "wood-break", "stone-break", "ruby-break",
  "plant-destroy", "pickup", "drop", "crop-stage", "inventory-activate",
  "inventory-change", "inventory-deactivate", "time-speed-up", "time-speed-normal",
  "harvest", "water", "well-refill", "build-place", "build-remove", "menu-open",
  "menu-close", "cooking-success", "cooking-miss", "dish-serve", "dish-take",
  "sprint-on", "sprint-off", "tavern-open", "tavern-close", "guest-happy",
  "guest-angry", "coin-toss", "purchase",
  "sword-hit", "melee-metal-ring", "melee-log-thud", "training-dummy-hit", "battle-axe-hit",
];
assert(task047Effects.every((id) => PROCEDURAL_SFX[id]?.voices?.length > 0), "every requested gameplay event has a procedural effect");
assert(PROCEDURAL_SFX["crop-stage"].voices.every((voice) => voice.gain <= 0.016), "crop growth stays deliberately quiet");
assert.notDeepEqual(PROCEDURAL_SFX["sword-hit"], PROCEDURAL_SFX["battle-axe-hit"], "sword and battle axe use distinct synthetic strike profiles");
assert(PROCEDURAL_SFX["melee-metal-ring"].voices.length >= 3, "melee hits on stone and ruby layer synthetic metallic partials");
assert(PROCEDURAL_SFX["melee-log-thud"].noise?.filterFrequency <= 500, "melee hits on logs stay deliberately dull");
assert(PROCEDURAL_SFX["training-dummy-hit"].noise?.filterFrequency <= 700, "training dummy has a distinct stuffed-frame impact");
assert.equal(resourceEffectType(getResourceProfile("log-small"), "hit"), "wood-hit");
assert.equal(resourceEffectType(getResourceProfile("stone-small"), "cleared"), "stone-break");
assert.equal(resourceEffectType(getResourceProfile("ruby-node"), "hit"), "ruby-hit");

const expectedAssets = [
  ["public/assets/audio/music/NestledBurrow_SunlitSavePoint.mp3", "76767a4fc6e5a7386118b044b5a99e02f24b0a07", 3977087, "502dfd51bcfa7908becd39f604a6c73d868d9742fd3d1207c985cb9482627a91"],
  ["public/assets/audio/music/NestledBurrow_Ambient01.mp3", "fe0ca6344d6dec08a0db0cff61e3832baa864265", 1400592, "090f87cf7b5c7c724c6eda76e597ff03b2bba7b1fb38d42ed9eb12857b007a9b"],
  ["public/assets/audio/music/NestledBurrow_Ambient02.mp3", "86f62c53ddef908809a1f9d410cf04c71bc0c6da", 1517112, "6718072ddd8cc1f85a07135c307f8ce67b9038c95da2a66a44fe728b121e04d7"],
  ["public/assets/audio/music/NestledBurrow_Ambient03.mp3", "c54abb765f04f337946c9617ca271a2f0f3c3716", 1418448, "af4c80498e484c1214c497a709046d6da959727381b6bea58878cd4bd4973b11"],
  ["public/assets/audio/music/NestledBurrow_Ambient04.mp3", "1bfeb7c5e3a5ba782395373a1511ee2c04668d9f", 4646886, "b32cd6a77bd783ac167afe75f3243f37129c7613749a281ee28e2d9f97ce584a"],
  ["public/assets/audio/music/NestledBurrow_Ambient05.mp3", "5c09c9bcff72b14f69f78085472d35de7a6c9886", 1550646, "c9e054b9c94149c5cdda6a8be06a80df961a2b9e47b8aed77d9ed15cf3c57b90"],
  ["public/assets/audio/music/NestledBurrow_Ambient06.mp3", "188d62946399f80a9cd936797215eecef4799b63", 1392462, "a6bc44bded04434105c953dab23991187940c87fadea11357d2118a6e294069e"],
];
assert.equal(MUSIC_PLAYLIST.length, 7); assert.equal(new Set(MUSIC_PLAYLIST.map((track) => track.id)).size, 7);
for (const [path, blob, size, sha256] of expectedAssets) {
  assert(existsSync(path)); assert.equal(statSync(path).size, size); assert.equal(hash(path), sha256);
  assert.equal(execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim(), blob);
}
assert.equal(getMusicUrl(MUSIC_PLAYLIST[0].path, "/NestledBurrow"), "/NestledBurrow/assets/audio/music/NestledBurrow_SunlitSavePoint.mp3");
assert.equal(choosePlaylistTrack(MUSIC_PLAYLIST, null, () => 0).id, "sunlit-save-point");
assert.equal(choosePlaylistTrack(MUSIC_PLAYLIST, "sunlit-save-point", () => 0).id, "ambient-01");
assert.notEqual(choosePlaylistTrack(MUSIC_PLAYLIST, "ambient-03", () => 0.99).id, "ambient-03");
assert.equal(getFadeEnvelope({ duration: 20, position: 11 }), 1);
assert.equal(getFadeEnvelope({ duration: 20, position: 16 }), 4 / MUSIC_FADE_OUT_SECONDS);
assert.equal(getFadeEnvelope({ duration: MUSIC_CROSSFADE_SECONDS, position: 2, incoming: true }), 0.5);

const storage = memory(); const store = createAudioSettingsStore({ storage });
store.setChannel("music", 0.75); assert(storage.getItem(AUDIO_STORAGE_KEY).includes('"music":0.75'));
let addCount = 0; const updateHandlers = new Set();
const fakeScene = {
  input: { once() {}, off() {}, keyboard: { once() {}, off() {} } },
  events: { on(_event, handler) { updateHandlers.add(handler); }, off(_event, handler) { updateHandlers.delete(handler); } },
  sound: { add(key, options) { addCount += 1; assert.equal(options.loop, false); return { key, duration: 20, seek: 0, isPlaying: false, play() { this.isPlaying = true; }, setVolume(value) { this.volume = value; }, stop() { this.isPlaying = false; }, destroy() { this.destroyed = true; }, once() {} }; } },
};
const runtime = new PhaserAudioRuntime(fakeScene, store, { random: () => 0 });
runtime.startMusic(); runtime.startMusic();
assert.equal(addCount, 1); assert.equal(runtime.currentMusic.track.id, "sunlit-save-point");
runtime.currentMusic.sound.seek = 11; runtime.updateMusic();
assert.equal(runtime.currentMusic.envelope, 1, "outgoing fade starts at remaining nine seconds");
runtime.currentMusic.sound.seek = 16; runtime.updateMusic();
assert.equal(runtime.activeMusic.length, 2, "incoming track starts at remaining four seconds");
const incoming = runtime.currentMusic; assert.equal(incoming.envelope, 0);
incoming.sound.seek = 2; runtime.updateMusic(); assert.equal(incoming.envelope, 0.5);
store.setChannel("master", 0.4); assert.equal(incoming.sound.volume, 0.4 * 0.75 * 0.5, "settings updates preserve fade envelope");
const outgoing = runtime.activeMusic.find((instance) => instance !== incoming); outgoing.sound.seek = 20; runtime.updateMusic();
assert.equal(runtime.activeMusic.length, 1); assert.equal(outgoing.sound.destroyed, true);
assert.equal(runtime.playEffect("chop"), false, "procedural SFX safely no-ops without a Web Audio context");
runtime.destroy(); runtime.destroy(); assert.equal(updateHandlers.size, 0); assert.equal(runtime.activeMusic.length, 0);

const scheduled = [];
const audioParam = () => ({ setValueAtTime(value, time) { scheduled.push(["set", value, time]); }, linearRampToValueAtTime(value, time) { scheduled.push(["ramp", value, time]); } });
const audioNode = () => ({ connect() {}, start(time) { scheduled.push(["start", time]); }, stop(time) { scheduled.push(["stop", time]); } });
const effectContext = {
  state: "running",
  currentTime: 2,
  sampleRate: 8000,
  destination: {},
  createGain() { return { ...audioNode(), gain: audioParam() }; },
  createOscillator() { return { ...audioNode(), frequency: audioParam(), type: null }; },
  createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; },
  createBufferSource() { return { ...audioNode(), buffer: null }; },
  createBiquadFilter() { return { ...audioNode(), frequency: audioParam(), type: null }; },
};
const effectScene = {
  input: { once() {}, off() {}, keyboard: { once() {}, off() {} } },
  events: { on() {}, off() {} },
  sound: { context: effectContext },
};
const effectRuntime = new PhaserAudioRuntime(effectScene, createAudioSettingsStore({ storage: memory() }));
assert.equal(effectRuntime.playEffect("well-refill"), true, "well refill schedules oscillator and water-noise voices");
assert.equal(effectRuntime.lastEffectType, "well-refill");
assert.equal(effectRuntime.effectPlayCount, 1);
assert(scheduled.filter(([event]) => event === "start").length >= 3, "layered effects schedule all requested voices");
effectRuntime.destroy();
const audioRuntimeSource = readFileSync("src/audioRuntime.js", "utf8");
assert(!audioRuntimeSource.includes("visibilitychange")); assert(!audioRuntimeSource.includes("blur"));
const eventWiringSource = [
  "src/main.js", "src/inventoryRuntime.js", "src/farmingRuntime.js",
  "src/cookingRuntime.js", "src/merchantRuntime.js", "src/kitchenInteractionRuntime.js",
  "src/guestFeedback.js", "src/tavernServiceRuntime.js", "src/meleeRuntime.js",
].map((path) => readFileSync(path, "utf8")).join("\n");
for (const effectId of task047Effects.filter((id) => !id.startsWith("wood-") && !id.startsWith("stone-") && !id.startsWith("ruby-"))) {
  assert(eventWiringSource.includes(`"${effectId}"`), `${effectId} is wired to a gameplay event`);
}
assert(readFileSync("src/main.js", "utf8").includes("disableVisibilityChange: true"));
console.log("audio checks passed: playlist, asset integrity, crossfade and lifecycle");
