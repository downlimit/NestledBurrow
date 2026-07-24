import { getEffectiveEffectsVolume, getEffectiveMusicVolume } from "./audioSettings.js";

export const MUSIC_KEY = "music.sunlit-save-point";
export const MUSIC_PATH = "assets/audio/music/NestledBurrow_SunlitSavePoint.mp3";
export const PROCEDURAL_SFX = Object.freeze({
  log: Object.freeze({ oscillator: "square", startFrequency: 132, endFrequency: 82, durationSeconds: 0.09, gain: 0.075 }),
  ruby: Object.freeze({ oscillator: "triangle", startFrequency: 520, endFrequency: 760, durationSeconds: 0.11, gain: 0.065 }),
});

export function getMusicUrl(baseUrl = import.meta.env.BASE_URL) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${MUSIC_PATH}`;
}

export class PhaserAudioRuntime {
  constructor(scene, settingsStore) {
    this.scene = scene;
    this.settingsStore = settingsStore;
    this.music = null;
    this.pendingStart = false;
    this.lastEffectType = null;
    this.effectPlayCount = 0;
    this.destroyed = false;
    this.unsubscribe = settingsStore.subscribe((settings) => this.applySettings(settings));
    this.unlockHandler = () => this.startMusic();
    scene.input?.once?.("pointerdown", this.unlockHandler);
    scene.input?.keyboard?.once?.("keydown", this.unlockHandler);
  }
  startMusic() {
    if (this.destroyed || this.music?.isPlaying) return;
    if (!this.music) this.music = this.scene.sound.add(MUSIC_KEY, { loop: true });
    this.applySettings(this.settingsStore.getSettings());
    try {
      this.music.play({ loop: true });
      this.pendingStart = false;
    } catch (_error) {
      this.pendingStart = true;
    }
  }
  applySettings(settings) {
    if (this.music) this.music.setVolume(getEffectiveMusicVolume(settings));
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
      } catch (_error) {
        return false;
      }
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
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = null;
    }
  }
}
