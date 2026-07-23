import { getEffectiveMusicVolume } from "./audioSettings.js";

export const MUSIC_KEY = "music.sunlit-save-point";
export const MUSIC_PATH = "assets/audio/music/NestledBurrow_SunlitSavePoint.mp3";

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
