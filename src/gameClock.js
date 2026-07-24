export const SECONDS_PER_DAY = 86400;
export const DEFAULT_START_TIME_SECONDS = 21600;
export const DEFAULT_REAL_SECONDS_PER_GAME_DAY = 1440;
export const DEFAULT_GAME_SECONDS_PER_REAL_SECOND = 60;
export const LEGACY_ELAPSED_GAME_SECONDS_MULTIPLIER = 80;
export const DEFAULT_SLEEP_SIMULATION_SCALE = 8;

export const DAY_NIGHT_COLORS = Object.freeze({
  day: 0xffffff,
  orange: 0xffb380,
  pink: 0xff648b,
  night: 0x425cd4,
});

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

export function dayNightMultiplyColor(worldTimeSeconds) {
  const h = secondsOfDay(worldTimeSeconds) / 3600;
  if (h >= 9 && h < 17) return DAY_NIGHT_COLORS.day;
  if (h >= 17 && h < 18) return interpolateColor(DAY_NIGHT_COLORS.day, DAY_NIGHT_COLORS.orange, smoothstep(h - 17));
  if (h >= 18 && h < 20) return interpolateColor(DAY_NIGHT_COLORS.orange, DAY_NIGHT_COLORS.pink, smoothstep((h - 18) / 2));
  if (h >= 20 && h < 22) return interpolateColor(DAY_NIGHT_COLORS.pink, DAY_NIGHT_COLORS.night, smoothstep((h - 20) / 2));
  if (h >= 22 || h < 4) return DAY_NIGHT_COLORS.night;
  if (h >= 4 && h < 6) return interpolateColor(DAY_NIGHT_COLORS.night, DAY_NIGHT_COLORS.pink, smoothstep((h - 4) / 2));
  if (h >= 6 && h < 8) return interpolateColor(DAY_NIGHT_COLORS.pink, DAY_NIGHT_COLORS.orange, smoothstep((h - 6) / 2));
  return interpolateColor(DAY_NIGHT_COLORS.orange, DAY_NIGHT_COLORS.day, smoothstep(h - 8));
}

export function smoothstep(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return x * x * (3 - 2 * x);
}

function interpolateColor(from, to, t) {
  const mix = (shift) => Math.round(((from >> shift) & 0xff) + ((((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * t));
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
