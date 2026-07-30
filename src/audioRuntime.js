import { getEffectiveEffectsVolume, getEffectiveMusicVolume } from "./audioSettings.js";

export const MUSIC_PLAYLIST = Object.freeze([
  Object.freeze({ id: "sunlit-save-point", key: "music.sunlit-save-point", path: "assets/audio/music/NestledBurrow_SunlitSavePoint.mp3" }),
  Object.freeze({ id: "ambient-01", key: "music.ambient-01", path: "assets/audio/music/NestledBurrow_Ambient01.mp3" }),
  Object.freeze({ id: "ambient-02", key: "music.ambient-02", path: "assets/audio/music/NestledBurrow_Ambient02.mp3" }),
  Object.freeze({ id: "ambient-03", key: "music.ambient-03", path: "assets/audio/music/NestledBurrow_Ambient03.mp3" }),
  Object.freeze({ id: "ambient-04", key: "music.ambient-04", path: "assets/audio/music/NestledBurrow_Ambient04.mp3" }),
  Object.freeze({ id: "ambient-05", key: "music.ambient-05", path: "assets/audio/music/NestledBurrow_Ambient05.mp3" }),
  Object.freeze({ id: "ambient-06", key: "music.ambient-06", path: "assets/audio/music/NestledBurrow_Ambient06.mp3" }),
]);
export const MUSIC_FADE_OUT_SECONDS = 9;
export const MUSIC_CROSSFADE_SECONDS = 4;

function effect(voices, noise = null) {
  return Object.freeze({
    voices: Object.freeze(voices.map((voice) => Object.freeze(voice))),
    noise: noise ? Object.freeze(noise) : null,
  });
}

export const PROCEDURAL_SFX = Object.freeze({
  chop: effect([{ oscillator: "square", startFrequency: 132, endFrequency: 82, durationSeconds: 0.09, gain: 0.075 }]),
  mine: effect([{ oscillator: "triangle", startFrequency: 520, endFrequency: 760, durationSeconds: 0.11, gain: 0.065 }]),
  "wood-hit": effect([{ oscillator: "square", startFrequency: 146, endFrequency: 82, durationSeconds: 0.1, gain: 0.08 }], { durationSeconds: 0.055, gain: 0.025, filterFrequency: 760, seed: 11 }),
  "stone-hit": effect([{ oscillator: "triangle", startFrequency: 430, endFrequency: 690, durationSeconds: 0.085, gain: 0.06 }], { durationSeconds: 0.045, gain: 0.022, filterFrequency: 2400, seed: 17 }),
  "sword-hit": effect([
    { oscillator: "sawtooth", startFrequency: 980, endFrequency: 260, durationSeconds: 0.085, gain: 0.042 },
    { oscillator: "sine", startFrequency: 1420, endFrequency: 720, durationSeconds: 0.07, gain: 0.024, delaySeconds: 0.01 },
  ], { durationSeconds: 0.055, gain: 0.02, filterFrequency: 3200, seed: 79 }),
  "melee-metal-ring": effect([
    { oscillator: "triangle", startFrequency: 1280, endFrequency: 980, durationSeconds: 0.34, gain: 0.046 },
    { oscillator: "sine", startFrequency: 1840, endFrequency: 1460, durationSeconds: 0.46, gain: 0.028, delaySeconds: 0.012 },
    { oscillator: "sine", startFrequency: 2460, endFrequency: 1980, durationSeconds: 0.28, gain: 0.014, delaySeconds: 0.024 },
  ], { durationSeconds: 0.045, gain: 0.012, filterFrequency: 5200, seed: 89 }),
  "melee-log-thud": effect([
    { oscillator: "triangle", startFrequency: 118, endFrequency: 54, durationSeconds: 0.14, gain: 0.064 },
    { oscillator: "square", startFrequency: 76, endFrequency: 42, durationSeconds: 0.1, gain: 0.024, delaySeconds: 0.012 },
  ], { durationSeconds: 0.09, gain: 0.034, filterFrequency: 460, seed: 97 }),
  "training-dummy-hit": effect([
    { oscillator: "triangle", startFrequency: 176, endFrequency: 86, durationSeconds: 0.11, gain: 0.052 },
    { oscillator: "square", startFrequency: 104, endFrequency: 66, durationSeconds: 0.075, gain: 0.018, delaySeconds: 0.01 },
  ], { durationSeconds: 0.075, gain: 0.028, filterFrequency: 680, seed: 101 }),
  "battle-axe-hit": effect([
    { oscillator: "triangle", startFrequency: 210, endFrequency: 48, durationSeconds: 0.17, gain: 0.075 },
    { oscillator: "square", startFrequency: 96, endFrequency: 38, durationSeconds: 0.14, gain: 0.032, delaySeconds: 0.018 },
  ], { durationSeconds: 0.13, gain: 0.042, filterFrequency: 780, seed: 83 }),
  "ruby-hit": effect([
    { oscillator: "sine", startFrequency: 920, endFrequency: 1280, durationSeconds: 0.13, gain: 0.045 },
    { oscillator: "triangle", startFrequency: 1380, endFrequency: 1180, durationSeconds: 0.16, gain: 0.025, delaySeconds: 0.025 },
  ]),
  "wood-break": effect([
    { oscillator: "square", startFrequency: 118, endFrequency: 52, durationSeconds: 0.22, gain: 0.085 },
    { oscillator: "triangle", startFrequency: 74, endFrequency: 38, durationSeconds: 0.28, gain: 0.055, delaySeconds: 0.035 },
  ], { durationSeconds: 0.19, gain: 0.04, filterFrequency: 620, seed: 23 }),
  "stone-break": effect([
    { oscillator: "triangle", startFrequency: 560, endFrequency: 150, durationSeconds: 0.24, gain: 0.075 },
    { oscillator: "square", startFrequency: 190, endFrequency: 82, durationSeconds: 0.2, gain: 0.035, delaySeconds: 0.035 },
  ], { durationSeconds: 0.22, gain: 0.055, filterFrequency: 1900, seed: 29 }),
  "ruby-break": effect([
    { oscillator: "sine", startFrequency: 1320, endFrequency: 620, durationSeconds: 0.32, gain: 0.06 },
    { oscillator: "triangle", startFrequency: 1760, endFrequency: 880, durationSeconds: 0.38, gain: 0.035, delaySeconds: 0.045 },
  ], { durationSeconds: 0.12, gain: 0.018, filterFrequency: 4200, seed: 31 }),
  "plant-destroy": effect([{ oscillator: "triangle", startFrequency: 210, endFrequency: 72, durationSeconds: 0.18, gain: 0.055 }], { durationSeconds: 0.15, gain: 0.03, filterFrequency: 980, seed: 37 }),
  pickup: effect([
    { oscillator: "sine", startFrequency: 520, endFrequency: 860, durationSeconds: 0.09, gain: 0.04 },
    { oscillator: "sine", startFrequency: 740, endFrequency: 1080, durationSeconds: 0.08, gain: 0.025, delaySeconds: 0.055 },
  ]),
  drop: effect([{ oscillator: "triangle", startFrequency: 310, endFrequency: 120, durationSeconds: 0.13, gain: 0.055 }], { durationSeconds: 0.065, gain: 0.02, filterFrequency: 1100, seed: 41 }),
  "hoe-use": effect([
    { oscillator: "triangle", startFrequency: 205, endFrequency: 92, durationSeconds: 0.12, gain: 0.045 },
    { oscillator: "square", startFrequency: 96, endFrequency: 58, durationSeconds: 0.085, gain: 0.022, delaySeconds: 0.018 },
  ], { durationSeconds: 0.095, gain: 0.028, filterFrequency: 820, seed: 67 }),
  "plant-seed": effect([
    { oscillator: "sine", startFrequency: 350, endFrequency: 510, durationSeconds: 0.11, gain: 0.026 },
    { oscillator: "triangle", startFrequency: 165, endFrequency: 105, durationSeconds: 0.12, gain: 0.023, delaySeconds: 0.025 },
  ], { durationSeconds: 0.07, gain: 0.014, filterFrequency: 690, seed: 71 }),
  "crop-impact": effect([
    { oscillator: "triangle", startFrequency: 158, endFrequency: 54, durationSeconds: 0.2, gain: 0.064 },
    { oscillator: "square", startFrequency: 92, endFrequency: 42, durationSeconds: 0.16, gain: 0.03, delaySeconds: 0.02 },
  ], { durationSeconds: 0.18, gain: 0.044, filterFrequency: 930, seed: 73 }),
  "crop-stage": effect([{ oscillator: "sine", startFrequency: 620, endFrequency: 790, durationSeconds: 0.18, gain: 0.016 }]),
  "inventory-activate": effect([{ oscillator: "square", startFrequency: 360, endFrequency: 520, durationSeconds: 0.065, gain: 0.025 }]),
  "inventory-change": effect([{ oscillator: "square", startFrequency: 440, endFrequency: 570, durationSeconds: 0.055, gain: 0.022 }]),
  "inventory-deactivate": effect([{ oscillator: "square", startFrequency: 390, endFrequency: 250, durationSeconds: 0.07, gain: 0.024 }]),
  "time-speed-up": effect([
    { oscillator: "square", startFrequency: 330, endFrequency: 540, durationSeconds: 0.08, gain: 0.035 },
    { oscillator: "square", startFrequency: 520, endFrequency: 760, durationSeconds: 0.08, gain: 0.028, delaySeconds: 0.065 },
  ]),
  "time-speed-normal": effect([{ oscillator: "triangle", startFrequency: 650, endFrequency: 330, durationSeconds: 0.13, gain: 0.035 }]),
  harvest: effect([{ oscillator: "triangle", startFrequency: 170, endFrequency: 92, durationSeconds: 0.2, gain: 0.06 }], { durationSeconds: 0.16, gain: 0.035, filterFrequency: 850, seed: 43 }),
  water: effect([
    { oscillator: "sine", startFrequency: 310, endFrequency: 190, durationSeconds: 0.24, gain: 0.025 },
    { oscillator: "sine", startFrequency: 460, endFrequency: 280, durationSeconds: 0.18, gain: 0.018, delaySeconds: 0.045 },
  ], { durationSeconds: 0.22, gain: 0.026, filterFrequency: 1500, seed: 47 }),
  "well-refill": effect([
    { oscillator: "sine", startFrequency: 220, endFrequency: 360, durationSeconds: 0.28, gain: 0.026 },
    { oscillator: "sine", startFrequency: 340, endFrequency: 520, durationSeconds: 0.2, gain: 0.018, delaySeconds: 0.1 },
  ], { durationSeconds: 0.3, gain: 0.024, filterFrequency: 1250, seed: 53 }),
  "build-place": effect([{ oscillator: "square", startFrequency: 260, endFrequency: 390, durationSeconds: 0.1, gain: 0.035 }], { durationSeconds: 0.07, gain: 0.018, filterFrequency: 1200, seed: 59 }),
  "build-remove": effect([{ oscillator: "triangle", startFrequency: 350, endFrequency: 140, durationSeconds: 0.14, gain: 0.036 }], { durationSeconds: 0.1, gain: 0.022, filterFrequency: 900, seed: 61 }),
  "menu-open": effect([
    { oscillator: "square", startFrequency: 360, endFrequency: 520, durationSeconds: 0.06, gain: 0.025 },
    { oscillator: "square", startFrequency: 520, endFrequency: 680, durationSeconds: 0.065, gain: 0.02, delaySeconds: 0.045 },
  ]),
  "menu-close": effect([{ oscillator: "square", startFrequency: 560, endFrequency: 300, durationSeconds: 0.09, gain: 0.026 }]),
  "cooking-success": effect([
    { oscillator: "sine", startFrequency: 660, endFrequency: 820, durationSeconds: 0.09, gain: 0.035 },
    { oscillator: "sine", startFrequency: 880, endFrequency: 1040, durationSeconds: 0.1, gain: 0.025, delaySeconds: 0.06 },
  ]),
  "cooking-miss": effect([{ oscillator: "sawtooth", startFrequency: 190, endFrequency: 105, durationSeconds: 0.16, gain: 0.04 }]),
  "dish-serve": effect([{ oscillator: "sine", startFrequency: 420, endFrequency: 690, durationSeconds: 0.12, gain: 0.035 }]),
  "dish-take": effect([{ oscillator: "sine", startFrequency: 650, endFrequency: 390, durationSeconds: 0.12, gain: 0.035 }]),
  "sprint-on": effect([{ oscillator: "triangle", startFrequency: 180, endFrequency: 310, durationSeconds: 0.08, gain: 0.026 }]),
  "sprint-off": effect([{ oscillator: "triangle", startFrequency: 300, endFrequency: 170, durationSeconds: 0.09, gain: 0.026 }]),
  "tavern-open": effect([{ oscillator: "sine", startFrequency: 440, endFrequency: 660, durationSeconds: 0.13, gain: 0.04 }]),
  "tavern-close": effect([{ oscillator: "sine", startFrequency: 610, endFrequency: 330, durationSeconds: 0.15, gain: 0.04 }]),
  "guest-happy": effect([
    { oscillator: "square", startFrequency: 520, endFrequency: 720, durationSeconds: 0.08, gain: 0.028 },
    { oscillator: "square", startFrequency: 700, endFrequency: 940, durationSeconds: 0.09, gain: 0.024, delaySeconds: 0.07 },
  ]),
  "guest-angry": effect([{ oscillator: "sawtooth", startFrequency: 240, endFrequency: 110, durationSeconds: 0.2, gain: 0.04 }]),
  "coin-toss": effect([
    { oscillator: "sine", startFrequency: 980, endFrequency: 1320, durationSeconds: 0.1, gain: 0.035 },
    { oscillator: "sine", startFrequency: 1260, endFrequency: 1580, durationSeconds: 0.12, gain: 0.025, delaySeconds: 0.05 },
  ]),
  purchase: effect([
    { oscillator: "square", startFrequency: 520, endFrequency: 760, durationSeconds: 0.07, gain: 0.03 },
    { oscillator: "square", startFrequency: 760, endFrequency: 1040, durationSeconds: 0.08, gain: 0.024, delaySeconds: 0.06 },
  ]),
});

export function getMusicUrl(path, baseUrl = import.meta.env.BASE_URL) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${path}`;
}

export function preloadMusicPlaylist(scene, baseUrl = import.meta.env.BASE_URL) {
  for (const track of MUSIC_PLAYLIST) scene.load.audio(track.key, getMusicUrl(track.path, baseUrl));
}

export function choosePlaylistTrack(tracks = MUSIC_PLAYLIST, currentId = null, random = Math.random) {
  const candidates = currentId ? tracks.filter((track) => track.id !== currentId) : tracks;
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

export function getFadeEnvelope({ duration, position, incoming = false }) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position) || position < 0) return null;
  if (incoming) return Math.min(1, position / MUSIC_CROSSFADE_SECONDS);
  const fadeStart = Math.max(0, duration - MUSIC_FADE_OUT_SECONDS);
  if (position <= fadeStart) return 1;
  return Math.max(0, (duration - position) / Math.min(MUSIC_FADE_OUT_SECONDS, duration));
}

export class PhaserAudioRuntime {
  constructor(scene, settingsStore, { random = Math.random } = {}) {
    this.scene = scene;
    this.settingsStore = settingsStore;
    this.random = random;
    this.activeMusic = [];
    this.currentMusic = null;
    this.pendingStart = false;
    this.lastEffectType = null;
    this.effectPlayCount = 0;
    this.destroyed = false;
    this.updateHandler = () => this.updateMusic();
    this.unsubscribe = settingsStore.subscribe((settings) => this.applySettings(settings));
    this.unlockHandler = () => this.startMusic();
    scene.input?.once?.("pointerdown", this.unlockHandler);
    scene.input?.keyboard?.once?.("keydown", this.unlockHandler);
    scene.events?.on?.("update", this.updateHandler);
  }

  startMusic() {
    if (this.destroyed || this.currentMusic?.sound?.isPlaying) return;
    const track = this.currentMusic?.track ?? choosePlaylistTrack(MUSIC_PLAYLIST, null, this.random);
    if (!track) return;
    const instance = this.createMusicInstance(track, 1);
    try {
      instance.sound.play({ loop: false });
      this.pendingStart = false;
    } catch (_error) {
      this.destroyMusicInstance(instance);
      this.pendingStart = true;
    }
  }

  createMusicInstance(track, envelope, incoming = false) {
    const sound = this.scene.sound.add(track.key, { loop: false });
    const instance = { track, sound, envelope, incoming, fadingOut: false, nextStarted: false, nextTrack: choosePlaylistTrack(MUSIC_PLAYLIST, track.id, this.random) };
    this.activeMusic.push(instance);
    this.currentMusic = instance;
    this.applySettings(this.settingsStore.getSettings());
    sound.once?.("complete", () => this.destroyMusicInstance(instance));
    return instance;
  }

  updateMusic() {
    if (this.destroyed || !this.currentMusic) return;
    for (const instance of [...this.activeMusic]) {
      const duration = Number(instance.sound.duration);
      const position = Number(instance.sound.seek);
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) continue;
      if (instance === this.currentMusic && instance.incoming) {
        instance.envelope = getFadeEnvelope({ duration: MUSIC_CROSSFADE_SECONDS, position, incoming: true });
        if (position >= MUSIC_CROSSFADE_SECONDS) instance.incoming = false;
      } else if (instance === this.currentMusic) {
        const remaining = duration - position;
        instance.envelope = getFadeEnvelope({ duration, position });
        instance.fadingOut ||= remaining <= MUSIC_FADE_OUT_SECONDS;
        if (!instance.nextStarted && remaining <= MUSIC_CROSSFADE_SECONDS) this.startNext(instance);
      } else if (!instance.fadingOut) {
        instance.envelope = getFadeEnvelope({ duration: MUSIC_CROSSFADE_SECONDS, position, incoming: true });
      }
      this.applyInstanceVolume(instance);
      if (position >= duration || instance.sound.isPlaying === false) this.destroyMusicInstance(instance);
    }
  }

  startNext(outgoing) {
    if (this.destroyed || outgoing.nextStarted || !outgoing.nextTrack) return;
    outgoing.nextStarted = true;
    const incoming = this.createMusicInstance(outgoing.nextTrack, 0, true);
    try {
      incoming.sound.play({ loop: false });
    } catch (_error) {
      this.destroyMusicInstance(incoming);
      outgoing.nextStarted = false;
    }
  }

  applyInstanceVolume(instance) {
    instance.sound.setVolume?.(getEffectiveMusicVolume(this.settingsStore.getSettings()) * instance.envelope);
  }

  applySettings() {
    for (const instance of this.activeMusic) this.applyInstanceVolume(instance);
  }

  destroyMusicInstance(instance) {
    if (!this.activeMusic.includes(instance)) return;
    instance.sound.stop?.();
    instance.sound.destroy?.();
    this.activeMusic = this.activeMusic.filter((item) => item !== instance);
    if (this.currentMusic === instance) this.currentMusic = this.activeMusic.find((item) => !item.fadingOut) ?? null;
  }

  playEffect(type) {
    const definition = PROCEDURAL_SFX[type];
    const volume = getEffectiveEffectsVolume(this.settingsStore.getSettings());
    if (!definition || volume <= 0 || this.destroyed) return false;
    const context = this.scene.sound?.context;
    if (!context?.createGain) return false;
    const play = () => {
      if (this.destroyed || context.state === "closed") return false;
      try {
        const now = context.currentTime;
        let scheduled = 0;
        for (const voice of definition.voices) {
          if (!context.createOscillator) continue;
          const start = now + (voice.delaySeconds ?? 0);
          const end = start + voice.durationSeconds;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = voice.oscillator;
          oscillator.frequency.setValueAtTime(voice.startFrequency, start);
          oscillator.frequency.linearRampToValueAtTime(voice.endFrequency, end);
          gain.gain.setValueAtTime(voice.gain * volume, start);
          gain.gain.linearRampToValueAtTime(0, end);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(end);
          scheduled += 1;
        }
        if (definition.noise && context.createBuffer && context.createBufferSource) {
          scheduleNoise(context, definition.noise, volume, now);
          scheduled += 1;
        }
        if (!scheduled) return false;
        this.lastEffectType = type;
        this.effectPlayCount += 1;
        return true;
      } catch (_error) { return false; }
    };
    if (context.state === "suspended") {
      try {
        const resumed = context.resume?.();
        if (!resumed?.then) return false;
        void resumed.then(play).catch(() => {});
      } catch (_error) { return false; }
      return true;
    }
    return play();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe?.();
    this.scene.input?.off?.("pointerdown", this.unlockHandler);
    this.scene.input?.keyboard?.off?.("keydown", this.unlockHandler);
    this.scene.events?.off?.("update", this.updateHandler);
    for (const instance of [...this.activeMusic]) this.destroyMusicInstance(instance);
    this.currentMusic = null;
  }
}

function scheduleNoise(context, definition, volume, now) {
  const sampleRate = Math.max(8000, Number(context.sampleRate) || 44100);
  const length = Math.max(1, Math.ceil(sampleRate * definition.durationSeconds));
  const buffer = context.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);
  let seed = Number(definition.seed) || 1;
  for (let index = 0; index < channel.length; index += 1) {
    seed = seed * 16807 % 2147483647;
    channel[index] = seed / 1073741823.5 - 1;
  }
  const source = context.createBufferSource();
  const gain = context.createGain();
  const start = now + (definition.delaySeconds ?? 0);
  const end = start + definition.durationSeconds;
  source.buffer = buffer;
  gain.gain.setValueAtTime(definition.gain * volume, start);
  gain.gain.linearRampToValueAtTime(0, end);
  if (context.createBiquadFilter && definition.filterFrequency) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(definition.filterFrequency, start);
    source.connect(filter);
    filter.connect(gain);
  } else {
    source.connect(gain);
  }
  gain.connect(context.destination);
  source.start(start);
  source.stop(end);
}
