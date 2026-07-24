import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  clampVolume,
  createAudioSettingsStore,
  deserializeAudioSettings,
  getEffectiveEffectsVolume,
  getEffectiveMusicVolume,
} from "../src/audioSettings.js";
import { MUSIC_KEY, MUSIC_PATH, PROCEDURAL_SFX, getMusicUrl, PhaserAudioRuntime } from "../src/audioRuntime.js";

function memory() {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

assert.deepEqual(DEFAULT_AUDIO_SETTINGS, { master: 1, music: 0.5, effects: 1 });
assert.deepEqual(deserializeAudioSettings("{").settings, DEFAULT_AUDIO_SETTINGS);
assert.equal(clampVolume(-1), 0);
assert.equal(clampVolume(2), 1);
assert.equal(getEffectiveMusicVolume({ master: 0.4, music: 0.25, effects: 1 }), 0.1);
assert.equal(getEffectiveEffectsVolume({ master: 0.4, music: 0.25, effects: 0.5 }), 0.2);
assert.notDeepEqual(PROCEDURAL_SFX.log, PROCEDURAL_SFX.ruby, "log and ruby effects have distinct chiptune definitions");
assert(PROCEDURAL_SFX.log.durationSeconds >= 0.06 && PROCEDURAL_SFX.log.durationSeconds <= 0.14);
assert(PROCEDURAL_SFX.ruby.durationSeconds >= 0.06 && PROCEDURAL_SFX.ruby.durationSeconds <= 0.14);

const storage = memory();
const store = createAudioSettingsStore({ storage });
store.setChannel("music", 0.75);
assert(storage.getItem(AUDIO_STORAGE_KEY).includes('"music":0.75'));
storage.setItem("nestledburrow.language", "en");
storage.setItem("nestledburrow.save.v1", "x");
storage.removeItem("nestledburrow.save.v1");
assert.equal(storage.getItem("nestledburrow.language"), "en");
assert(storage.getItem(AUDIO_STORAGE_KEY));

const blockedStorage = {
  getItem() { throw new DOMException("blocked", "SecurityError"); },
  setItem() { throw new DOMException("blocked", "SecurityError"); },
};
const blockedStore = createAudioSettingsStore({ storage: blockedStorage });
assert.equal(blockedStore.loadStatus, "recovered");
assert.deepEqual(blockedStore.getSettings(), DEFAULT_AUDIO_SETTINGS);
assert.deepEqual(blockedStore.setChannel("master", 0.4), { master: 0.4, music: 0.5, effects: 1 });

const blockedGlobal = {};
Object.defineProperty(blockedGlobal, "localStorage", {
  get() { throw new DOMException("blocked", "SecurityError"); },
});
const blockedGlobalStore = createAudioSettingsStore({ globalRef: blockedGlobal });
assert.equal(blockedGlobalStore.loadStatus, "defaulted");
assert.deepEqual(blockedGlobalStore.getSettings(), DEFAULT_AUDIO_SETTINGS);
assert.deepEqual(blockedGlobalStore.setChannel("music", 0.2), { master: 1, music: 0.2, effects: 1 });

assert.equal(MUSIC_PATH, "assets/audio/music/NestledBurrow_SunlitSavePoint.mp3");
assert(existsSync(`public/${MUSIC_PATH}`));
assert.equal(statSync(`public/${MUSIC_PATH}`).size, 3977087);
assert.equal(
  execFileSync("git", ["hash-object", `public/${MUSIC_PATH}`], { encoding: "utf8" }).trim(),
  "76767a4fc6e5a7386118b044b5a99e02f24b0a07",
);
assert.equal(getMusicUrl("/NestledBurrow"), "/NestledBurrow/assets/audio/music/NestledBurrow_SunlitSavePoint.mp3");

let addCount = 0;
const fakeSound = {
  isPlaying: false,
  play() { this.isPlaying = true; },
  setVolume(value) { this.volume = value; },
  stop() {},
  destroy() {},
};
const fakeScene = {
  input: { once() {}, off() {}, keyboard: { once() {}, off() {} } },
  sound: {
    add(key, options) {
      addCount += 1;
      assert.equal(key, MUSIC_KEY);
      assert.equal(options.loop, true);
      return fakeSound;
    },
  },
};
const runtime = new PhaserAudioRuntime(fakeScene, store);
runtime.startMusic();
runtime.startMusic();
assert.equal(addCount, 1);
assert.equal(fakeSound.isPlaying, true);
assert.equal(runtime.playEffect("log"), false, "procedural SFX safely no-ops without a Web Audio context");
const scheduled = [];
fakeScene.sound.context = {
  state: "running",
  currentTime: 2,
  destination: {},
  createOscillator() {
    return {
      frequency: { setValueAtTime(value) { scheduled.push(["startFrequency", value]); }, linearRampToValueAtTime(value) { scheduled.push(["endFrequency", value]); } },
      connect() {}, start() { scheduled.push(["start"]); }, stop() { scheduled.push(["stop"]); },
    };
  },
  createGain() {
    return { gain: { setValueAtTime(value) { scheduled.push(["gain", value]); }, linearRampToValueAtTime() {} }, connect() {} };
  },
};
assert.equal(runtime.playEffect("log"), true);
assert.equal(runtime.lastEffectType, "log");
assert(scheduled.some(([kind, value]) => kind === "gain" && value > 0), "audible gain uses master times effects volume");
store.setChannel("effects", 0);
const scheduledBeforeMute = scheduled.length;
assert.equal(runtime.playEffect("ruby"), false);
assert.equal(scheduled.length, scheduledBeforeMute, "zero effects volume creates no audible output");
runtime.destroy();
const audioRuntimeSource = readFileSync("src/audioRuntime.js", "utf8");
assert(!audioRuntimeSource.includes("visibilitychange"), "audio runtime does not pause or stop on visibility loss");
assert(!audioRuntimeSource.includes("blur"), "audio runtime does not pause or stop on window blur");
const mainSource = readFileSync("src/main.js", "utf8");
assert(mainSource.includes("disableVisibilityChange: true"), "Phaser config disables automatic visibility pause");
console.log("audio checks passed");
