export const AUDIO_STORAGE_KEY = "nestledburrow.audio.v1";
export const AUDIO_SCHEMA_VERSION = 1;
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({ master: 1, music: 0.5, effects: 1 });
export const AUDIO_CHANNELS = Object.freeze(["master", "music", "effects"]);

export function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

export function normalizeAudioSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_AUDIO_SETTINGS };
  return {
    master: clampVolume(value.master ?? DEFAULT_AUDIO_SETTINGS.master),
    music: clampVolume(value.music ?? DEFAULT_AUDIO_SETTINGS.music),
    effects: clampVolume(value.effects ?? DEFAULT_AUDIO_SETTINGS.effects),
  };
}

export function getEffectiveMusicVolume(settings) {
  const normalized = normalizeAudioSettings(settings);
  return clampVolume(normalized.master * normalized.music);
}

export function deserializeAudioSettings(raw) {
  try {
    if (typeof raw !== "string" || !raw.trim()) return { status: "defaulted", settings: { ...DEFAULT_AUDIO_SETTINGS } };
    const payload = JSON.parse(raw);
    if (!payload || payload.schemaVersion !== AUDIO_SCHEMA_VERSION || !payload.settings) {
      return { status: "recovered", settings: { ...DEFAULT_AUDIO_SETTINGS } };
    }
    return { status: "loaded", settings: normalizeAudioSettings(payload.settings) };
  } catch (error) {
    return { status: "recovered", settings: { ...DEFAULT_AUDIO_SETTINGS }, diagnostic: error };
  }
}

export function serializeAudioSettings(settings) {
  return JSON.stringify({ schemaVersion: AUDIO_SCHEMA_VERSION, settings: normalizeAudioSettings(settings) });
}

export function createAudioSettingsStore({ storage = globalThis.localStorage } = {}) {
  let settings = { ...DEFAULT_AUDIO_SETTINGS };
  const listeners = new Set();
  const loaded = deserializeAudioSettings(storage?.getItem?.(AUDIO_STORAGE_KEY));
  settings = loaded.settings;
  function persist() { storage?.setItem?.(AUDIO_STORAGE_KEY, serializeAudioSettings(settings)); }
  return {
    loadStatus: loaded.status,
    getSettings: () => ({ ...settings }),
    getEffectiveMusicVolume: () => getEffectiveMusicVolume(settings),
    setChannel(channel, value) {
      if (!AUDIO_CHANNELS.includes(channel)) throw new Error(`Unknown audio channel: ${channel}`);
      settings = { ...settings, [channel]: clampVolume(value) };
      persist();
      for (const listener of [...listeners]) listener({ ...settings });
      return { ...settings };
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
