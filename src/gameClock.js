export const SECONDS_PER_DAY = 86400;
export const DEFAULT_START_TIME_SECONDS = 21600;
export const DEFAULT_REAL_SECONDS_PER_GAME_DAY = 1080;
export const DEFAULT_GAME_SECONDS_PER_REAL_SECOND = SECONDS_PER_DAY / DEFAULT_REAL_SECONDS_PER_GAME_DAY;
export const DEFAULT_SLEEP_SIMULATION_SCALE = 8;

export function advanceWorldTimeSeconds(worldTimeSeconds, realDeltaSeconds, simulationScale = 1, gameSecondsPerRealSecond = DEFAULT_GAME_SECONDS_PER_REAL_SECOND) {
  return normalizeWorldTimeSeconds(worldTimeSeconds) + Math.max(0, Number(realDeltaSeconds) || 0) * gameSecondsPerRealSecond * Math.max(0, Number(simulationScale) || 0);
}

export function normalizeWorldTimeSeconds(value, fallback = DEFAULT_START_TIME_SECONDS) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function secondsOfDay(worldTimeSeconds) {
  return ((normalizeWorldTimeSeconds(worldTimeSeconds, 0) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
}

export function formatClock(worldTimeSeconds, language = "ru") {
  const totalMinutes = Math.floor(secondsOfDay(worldTimeSeconds) / 60) % 1440;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === "en") {
    const suffix = hours < 12 ? "AM" : "PM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function nightTintAlpha(worldTimeSeconds, maxStrength = 0.55) {
  const h = secondsOfDay(worldTimeSeconds) / 3600;
  const strength = Math.max(0, Number(maxStrength) || 0);
  if (h >= 8 && h < 18) return 0;
  if (h >= 21 || h < 5) return strength;
  if (h >= 5 && h < 8) return strength * (1 - smoothstep((h - 5) / 3));
  return strength * smoothstep((h - 18) / 3);
}

export function smoothstep(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return x * x * (3 - 2 * x);
}
