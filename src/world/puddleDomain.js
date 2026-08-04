import { secondsOfDay } from "../session/gameClock.js";

export const PUDDLE_CELL_SIZE = 16;
export const PUDDLE_NIGHT_START_HOUR = 22;
export const PUDDLE_NIGHT_END_HOUR = 4;
export const PUDDLE_NIGHT_DRY_PROGRESS_PER_REAL_SECOND = 1 / 60;
export const PUDDLE_DAY_DRY_PROGRESS_PER_REAL_SECOND = 1 / 30;
export const PUDDLE_MULTIPLY_BLEND_MODE = 2;

export function puddleCell(point = {}) {
  return {
    x: Math.floor((Number(point.x) || 0) / PUDDLE_CELL_SIZE),
    y: Math.floor((Number(point.y) || 0) / PUDDLE_CELL_SIZE),
  };
}

export function puddleCellKey(cell = {}) {
  return `${Number(cell.x) || 0},${Number(cell.y) || 0}`;
}

export function puddleSpriteCenter(cell = {}) {
  return {
    x: (Number(cell.x) || 0) * PUDDLE_CELL_SIZE + PUDDLE_CELL_SIZE / 2,
    y: (Number(cell.y) || 0) * PUDDLE_CELL_SIZE + PUDDLE_CELL_SIZE / 2,
  };
}

export function isCanonicalNight(worldTimeSeconds) {
  const hour = secondsOfDay(worldTimeSeconds) / 3600;
  return hour >= PUDDLE_NIGHT_START_HOUR || hour < PUDDLE_NIGHT_END_HOUR;
}

export function puddleDryProgressPerRealSecond(worldTimeSeconds) {
  return isCanonicalNight(worldTimeSeconds)
    ? PUDDLE_NIGHT_DRY_PROGRESS_PER_REAL_SECOND
    : PUDDLE_DAY_DRY_PROGRESS_PER_REAL_SECOND;
}

export function advancePuddleProgress(progress, realSeconds, worldTimeSeconds) {
  const current = Math.min(1, Math.max(0, Number(progress) || 0));
  const seconds = Math.max(0, Number(realSeconds) || 0);
  return Math.min(1, current + seconds * puddleDryProgressPerRealSecond(worldTimeSeconds));
}

export function puddleAlpha(progress) {
  return 1 - Math.min(1, Math.max(0, Number(progress) || 0));
}
