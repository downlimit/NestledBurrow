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
export const PROCEDURAL_SFX = Object.freeze({
  chop: Object.freeze({ oscillator: "square", startFrequency: 132, endFrequency: 82, durationSeconds: 0.09, gain: 0.075 }),
  mine: Object.freeze({ oscillator: "triangle", startFrequency: 520, endFrequency: 760, durationSeconds: 0.11, gain: 0.065 }),
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
    if (!context?.createOscillator || !context?.createGain) return false;
    const play = () => {
      if (this.destroyed || context.state === "closed") return false;
      try {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = definition.oscillator;
        oscillator.frequency.setValueAtTime(definition.startFrequency, now);
        oscillator.frequency.linearRampToValueAtTime(definition.endFrequency, now + definition.durationSeconds);
        gain.gain.setValueAtTime(definition.gain * volume, now);
        gain.gain.linearRampToValueAtTime(0, now + definition.durationSeconds);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + definition.durationSeconds);
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
