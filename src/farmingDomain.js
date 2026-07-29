import {
  FARMING_FRAMES,
  CROP_PROFILES,
  HYDRATED_ROT_SECONDS,
  NEVER_WATERED_ROT_SECONDS,
  SOLAR_DAY_END_SECONDS,
  SOLAR_DAY_START_SECONDS,
  STARTER_WELL,
  WATER_BUCKET_CAPACITY,
} from "./farmingConfig.js";
import { SECONDS_PER_DAY } from "./gameClock.js";
import { takeInventoryItem } from "./inventoryDomain.js";
import { TILE_SIZE } from "./worldConfig.js";
import { LEMONADE_TEXTURE_KEY, lemonCropFrame } from "./lemonadeConfig.js";
import { FARMING_TEXTURE_KEY } from "./farmingConfig.js";

const MOISTURE_TIER_SECONDS = Object.freeze([10 * 3600, 17 * 3600, 21 * 3600]);
const EPSILON = 1e-7;

function finiteNonNegative(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
  return value;
}

function integer(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  return value;
}

function nullableTime(value, label) {
  return value === null || value === undefined ? null : finiteNonNegative(value, 0, label);
}

function normalizePoint(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} must contain finite coordinates`);
  return { x, y };
}

export function farmCellKey(point) {
  return `${Number(point.x)},${Number(point.y)}`;
}

export function createFreshFarmState(worldTimeSeconds = 0) {
  return {
    soilCells: [],
    waterBucket: { capacity: WATER_BUCKET_CAPACITY, currentWater: 0 },
    wells: [{ ...STARTER_WELL }],
    lastProcessedWorldTimeSeconds: finiteNonNegative(worldTimeSeconds, 0, "Farm clock"),
  };
}

function normalizeCrop(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (!CROP_PROFILES[value.type]) throw new Error(`${label}.type is unsupported`);
  const profile = CROP_PROFILES[value.type];
  const effectiveGrowthSeconds = finiteNonNegative(value.effectiveGrowthSeconds, 0, `${label}.effectiveGrowthSeconds`);
  const rotten = Boolean(value.rotten);
  return {
    type: value.type,
    plantedAt: finiteNonNegative(value.plantedAt, 0, `${label}.plantedAt`),
    firstHydratedAt: nullableTime(value.firstHydratedAt, `${label}.firstHydratedAt`),
    lastHydratedAt: nullableTime(value.lastHydratedAt, `${label}.lastHydratedAt`),
    effectiveGrowthSeconds,
    growthDayIndex: integer(value.growthDayIndex, Math.floor(Number(value.plantedAt) / SECONDS_PER_DAY), `${label}.growthDayIndex`),
    growthTodaySeconds: finiteNonNegative(value.growthTodaySeconds, 0, `${label}.growthTodaySeconds`),
    mature: !rotten && (Boolean(value.mature) || effectiveGrowthSeconds >= profile.requiredEffectiveGrowthSeconds),
    rotten,
  };
}

function normalizeSoilCell(value, index) {
  const point = normalizePoint(value, `Farm soil cell ${index}`);
  const moisture = value.moistureSolarAgeSeconds === null || value.moistureSolarAgeSeconds === undefined
    ? null
    : finiteNonNegative(value.moistureSolarAgeSeconds, 0, `Farm soil cell ${index}.moistureSolarAgeSeconds`);
  return {
    x: point.x,
    y: point.y,
    moistureSolarAgeSeconds: moisture,
    crop: value.crop ? normalizeCrop(value.crop, `Farm soil cell ${index}.crop`) : null,
  };
}

function normalizeWell(value, index) {
  const point = normalizePoint(value, `Farm well ${index}`);
  const id = String(value.id ?? "");
  if (!/^farm-well-\d+$/.test(id)) throw new Error(`Farm well ${index}.id is invalid`);
  if (id === STARTER_WELL.id) return { ...STARTER_WELL };
  return { id, x: point.x, y: point.y, fixed: Boolean(value.fixed) };
}

export function normalizeFarmState(value = {}, worldTimeSeconds = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Farm state must be an object");
  const soilCells = (value.soilCells ?? []).map(normalizeSoilCell);
  const soilIds = new Set();
  for (const cell of soilCells) {
    const key = farmCellKey(cell);
    if (soilIds.has(key)) throw new Error(`Duplicate farm soil cell: ${key}`);
    soilIds.add(key);
  }
  const wells = (value.wells ?? []).map(normalizeWell);
  if (new Set(wells.map((well) => well.id)).size !== wells.length) throw new Error("Duplicate farm well ID");
  const capacity = integer(value.waterBucket?.capacity, WATER_BUCKET_CAPACITY, "Water bucket capacity");
  const currentWater = integer(value.waterBucket?.currentWater, 0, "Water bucket water");
  if (capacity !== WATER_BUCKET_CAPACITY || currentWater < 0 || currentWater > capacity) {
    throw new Error(`Water bucket must be within 0..${WATER_BUCKET_CAPACITY}`);
  }
  return {
    soilCells,
    waterBucket: { capacity, currentWater },
    wells,
    lastProcessedWorldTimeSeconds: finiteNonNegative(
      value.lastProcessedWorldTimeSeconds,
      worldTimeSeconds,
      "Farm clock",
    ),
  };
}

export function findSoilCell(farm, point) {
  const key = farmCellKey(point);
  return farm.soilCells.find((cell) => farmCellKey(cell) === key) ?? null;
}

export function tillSoil(farm, point, { valid = true } = {}) {
  const existing = findSoilCell(farm, point);
  if (existing?.crop?.rotten) {
    existing.crop = null;
    return { status: "rotten-cleared", mutated: true, cell: existing };
  }
  if (existing) return { status: "already-tilled", mutated: false, cell: existing };
  if (!valid) return { status: "invalid-soil", mutated: false };
  const cell = { ...normalizePoint(point, "Soil point"), moistureSolarAgeSeconds: null, crop: null };
  farm.soilCells.push(cell);
  return { status: "tilled", mutated: true, cell };
}

export function plantCrop(farm, point, inventory, worldTimeSeconds, cropType) {
  const profile = CROP_PROFILES[cropType];
  if (!profile) return { status: "unknown-crop", mutated: false };
  const cell = findSoilCell(farm, point);
  if (!cell || cell.crop) return { status: "invalid-planting-cell", mutated: false };
  const seedId = `${cropType}-seed`;
  const taken = takeInventoryItem(inventory, seedId, 1);
  if (!taken.mutated) return { status: `no-${seedId}`, mutated: false };
  const hydrated = moistureMultiplier(cell.moistureSolarAgeSeconds) > 0;
  const now = finiteNonNegative(worldTimeSeconds, 0, "Planting time");
  cell.crop = {
    type: cropType,
    plantedAt: now,
    firstHydratedAt: hydrated ? now : null,
    lastHydratedAt: hydrated ? now : null,
    effectiveGrowthSeconds: 0,
    growthDayIndex: Math.floor(now / SECONDS_PER_DAY),
    growthTodaySeconds: 0,
    mature: false,
    rotten: false,
  };
  return { status: "planted", mutated: true, cell, inventory: taken };
}

export function plantPotato(farm, point, inventory, worldTimeSeconds) {
  return plantCrop(farm, point, inventory, worldTimeSeconds, "potato");
}

export function waterSoil(farm, point, worldTimeSeconds) {
  const cell = findSoilCell(farm, point);
  if (!cell) return { status: "not-tilled", mutated: false };
  if (farm.waterBucket.currentWater <= 0) return { status: "water-bucket-empty", mutated: false };
  farm.waterBucket.currentWater -= 1;
  hydrateCell(cell, finiteNonNegative(worldTimeSeconds, 0, "Watering time"));
  return { status: "watered", mutated: true, cell, currentWater: farm.waterBucket.currentWater };
}

export function refillWaterBucket(farm) {
  if (farm.waterBucket.currentWater >= farm.waterBucket.capacity) {
    return { status: "water-bucket-full", mutated: false, currentWater: farm.waterBucket.currentWater };
  }
  farm.waterBucket.currentWater = farm.waterBucket.capacity;
  return { status: "water-bucket-refilled", mutated: true, currentWater: farm.waterBucket.currentWater };
}

export function harvestCrop(farm, point, rng = Math.random) {
  const cell = findSoilCell(farm, point);
  if (!cell?.crop?.mature || cell.crop.rotten) return { status: "not-mature", mutated: false };
  const random = Math.min(0.999999999, Math.max(0, Number(rng()) || 0));
  const itemId = cell.crop.type;
  const quantity = itemId === "lemon" ? 2 + Math.floor(random * 2) : 4 + Math.floor(random * 3);
  cell.crop = null;
  return { status: "harvested", mutated: true, itemId, quantity, cell };
}

export function harvestPotato(farm, point, rng = Math.random) {
  return harvestCrop(farm, point, rng);
}

export function axeFarmCell(farm, point) {
  const cell = findSoilCell(farm, point);
  if (!cell) return { status: "no-farm-cell", mutated: false };
  if (cell.crop) {
    cell.crop = null;
    return { status: "crop-destroyed", mutated: true, cell };
  }
  farm.soilCells.splice(farm.soilCells.indexOf(cell), 1);
  return { status: "soil-destroyed", mutated: true, cell };
}

export function destroyCropsByCollider(farm, collider) {
  const box = normalizeCollider(collider);
  const cells = farm.soilCells.filter((cell) => cell.crop && boxesTouch(box, {
    left: cell.x,
    top: cell.y,
    right: cell.x + TILE_SIZE,
    bottom: cell.y + TILE_SIZE,
  }));
  for (const cell of cells) cell.crop = null;
  return cells.length > 0
    ? { status: "crops-crushed", mutated: true, cells }
    : { status: "no-crop-contact", mutated: false, cells: [] };
}

export function moistureMultiplier(moistureSolarAgeSeconds) {
  if (moistureSolarAgeSeconds === null || moistureSolarAgeSeconds === undefined) return 0;
  const age = Math.max(0, Number(moistureSolarAgeSeconds) || 0);
  if (age < MOISTURE_TIER_SECONDS[0]) return 1;
  if (age < MOISTURE_TIER_SECONDS[1]) return 2 / 3;
  if (age < MOISTURE_TIER_SECONDS[2]) return 1 / 3;
  return 0;
}

export function soilFrame(cell) {
  const multiplier = moistureMultiplier(cell?.moistureSolarAgeSeconds);
  if (multiplier === 1) return FARMING_FRAMES.soilWet100;
  if (multiplier === 2 / 3) return FARMING_FRAMES.soilWet66;
  if (multiplier === 1 / 3) return FARMING_FRAMES.soilWet33;
  return FARMING_FRAMES.soilDry;
}

export function cropFrame(crop) {
  if (!crop) return null;
  if (crop.type === "lemon") return lemonCropFrame(crop);
  if (crop.rotten) return crop.firstHydratedAt === null
    ? FARMING_FRAMES.cropPlantedRotten
    : FARMING_FRAMES.cropRotten;
  if (crop.mature) return FARMING_FRAMES.cropMature;
  if (crop.firstHydratedAt === null) return FARMING_FRAMES.cropPlanted;
  if (crop.effectiveGrowthSeconds < 2 * 3600) return FARMING_FRAMES.cropSprout;
  return FARMING_FRAMES.cropYoung;
}

export function cropVisualAsset(crop) {
  const frame = cropFrame(crop);
  if (frame === null) return null;
  return {
    textureKey: crop.type === "lemon" ? LEMONADE_TEXTURE_KEY : FARMING_TEXTURE_KEY,
    frame,
  };
}

export function advanceFarmTime(farm, targetWorldTimeSeconds, environment = {}) {
  const target = finiteNonNegative(targetWorldTimeSeconds, farm.lastProcessedWorldTimeSeconds, "Farm target time");
  const startedAt = Math.min(farm.lastProcessedWorldTimeSeconds, target);
  let cursor = Math.min(farm.lastProcessedWorldTimeSeconds, target);
  if (target <= cursor + EPSILON) {
    farm.lastProcessedWorldTimeSeconds = target;
    return { status: "unchanged", mutated: false, processedSeconds: 0 };
  }
  const segments = normalizeWeatherSegments(environment.weatherSegments ?? []);
  let mutated = false;
  while (cursor < target - EPSILON) {
    const weather = weatherAt(segments, cursor, environment.defaultWeatherId ?? "clear");
    if (weather.precipitation) {
      for (const cell of farm.soilCells) {
        hydrateCell(cell, cursor);
        mutated = true;
      }
    }
    const boundary = nextBoundary(farm, cursor, target, weather, segments);
    const duration = Math.max(0, boundary - cursor);
    const solar = isSolarTime(cursor);
    for (const cell of farm.soilCells) {
      mutated = integrateCell(cell, cursor, boundary, duration, solar, weather) || mutated;
    }
    cursor = boundary;
  }
  farm.lastProcessedWorldTimeSeconds = target;
  return { status: mutated ? "advanced" : "clock-only", mutated, processedSeconds: target - startedAt };
}

function integrateCell(cell, start, end, duration, solar, weather) {
  let mutated = false;
  const crop = cell.crop;
  if (crop) {
    ensureGrowthDay(crop, Math.floor(start / SECONDS_PER_DAY));
    if (!crop.rotten && shouldRot(crop, start, weather)) {
      crop.rotten = true;
      crop.mature = false;
      mutated = true;
    }
    if (!crop.rotten && solar) {
      const moisture = weather.precipitation ? 1 : moistureMultiplier(cell.moistureSolarAgeSeconds);
      const profile = CROP_PROFILES[crop.type];
      const weatherMultiplier = profile.weatherGrowthMultipliers[weather.id] ?? 1;
      const dailyRoom = Math.max(0, profile.maximumEffectiveGrowthPerDay - crop.growthTodaySeconds);
      const growth = Math.min(dailyRoom, duration * moisture * weatherMultiplier);
      if (growth > 0) {
        crop.effectiveGrowthSeconds += growth;
        crop.growthTodaySeconds += growth;
        mutated = true;
      }
      if (crop.effectiveGrowthSeconds >= profile.requiredEffectiveGrowthSeconds) {
        crop.effectiveGrowthSeconds = profile.requiredEffectiveGrowthSeconds;
        crop.mature = true;
      }
    }
  }
  if (weather.precipitation) {
    hydrateCell(cell, end);
    return true;
  }
  if (solar && cell.moistureSolarAgeSeconds !== null) {
    cell.moistureSolarAgeSeconds += duration;
    mutated = duration > 0 || mutated;
  }
  if (cell.crop && !cell.crop.rotten && shouldRot(cell.crop, end, weather)) {
    cell.crop.rotten = true;
    cell.crop.mature = false;
    mutated = true;
  }
  return mutated;
}

function hydrateCell(cell, worldTimeSeconds) {
  cell.moistureSolarAgeSeconds = 0;
  if (!cell.crop || cell.crop.rotten) return;
  cell.crop.firstHydratedAt ??= worldTimeSeconds;
  cell.crop.lastHydratedAt = worldTimeSeconds;
}

function normalizeCollider(value) {
  const box = {
    left: Number(value?.left),
    top: Number(value?.top),
    right: Number(value?.right),
    bottom: Number(value?.bottom),
  };
  if (!Object.values(box).every(Number.isFinite) || box.right < box.left || box.bottom < box.top) {
    throw new Error("Crop collision box must contain ordered finite bounds");
  }
  return box;
}

function boxesTouch(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function shouldRot(crop, worldTimeSeconds, weather) {
  if (crop.rotten || weather.precipitation) return crop.rotten;
  const deadline = crop.firstHydratedAt === null
    ? crop.plantedAt + NEVER_WATERED_ROT_SECONDS
    : crop.lastHydratedAt + HYDRATED_ROT_SECONDS;
  return worldTimeSeconds >= deadline - EPSILON;
}

function ensureGrowthDay(crop, dayIndex) {
  if (crop.growthDayIndex === dayIndex) return;
  crop.growthDayIndex = dayIndex;
  crop.growthTodaySeconds = 0;
}

function secondsOfDayAbsolute(worldTimeSeconds) {
  return ((worldTimeSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
}

function isSolarTime(worldTimeSeconds) {
  const value = secondsOfDayAbsolute(worldTimeSeconds);
  return value >= SOLAR_DAY_START_SECONDS && value < SOLAR_DAY_END_SECONDS;
}

function nextBoundary(farm, cursor, target, weather, segments) {
  let next = target;
  const dayStart = Math.floor(cursor / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  for (const boundary of [
    dayStart + SECONDS_PER_DAY,
    dayStart + SOLAR_DAY_START_SECONDS,
    dayStart + SOLAR_DAY_END_SECONDS,
    nextWeatherBoundary(segments, cursor),
  ]) {
    if (boundary > cursor + EPSILON) next = Math.min(next, boundary);
  }
  for (const cell of farm.soilCells) {
    if (!weather.precipitation && isSolarTime(cursor) && cell.moistureSolarAgeSeconds !== null) {
      const threshold = MOISTURE_TIER_SECONDS.find((value) => value > cell.moistureSolarAgeSeconds + EPSILON);
      if (threshold !== undefined) next = Math.min(next, cursor + threshold - cell.moistureSolarAgeSeconds);
    }
    const crop = cell.crop;
    if (!crop || crop.rotten) continue;
    if (!weather.precipitation) {
      const deadline = crop.firstHydratedAt === null
        ? crop.plantedAt + NEVER_WATERED_ROT_SECONDS
        : crop.lastHydratedAt + HYDRATED_ROT_SECONDS;
      if (deadline > cursor + EPSILON) next = Math.min(next, deadline);
    }
    if (!isSolarTime(cursor)) continue;
    const moisture = weather.precipitation ? 1 : moistureMultiplier(cell.moistureSolarAgeSeconds);
    const profile = CROP_PROFILES[crop.type];
    const weatherMultiplier = profile.weatherGrowthMultipliers[weather.id] ?? 1;
    const rate = moisture * weatherMultiplier;
    if (rate <= 0) continue;
    ensureGrowthDay(crop, Math.floor(cursor / SECONDS_PER_DAY));
    const capRoom = profile.maximumEffectiveGrowthPerDay - crop.growthTodaySeconds;
    const matureRoom = profile.requiredEffectiveGrowthSeconds - crop.effectiveGrowthSeconds;
    for (const room of [capRoom, matureRoom]) {
      if (room > EPSILON) next = Math.min(next, cursor + room / rate);
    }
  }
  return next > cursor + EPSILON ? next : Math.min(target, cursor + 0.001);
}

function normalizeWeatherSegments(value) {
  if (!Array.isArray(value)) throw new Error("Weather segments must be an array");
  return value.map((segment, index) => {
    const start = finiteNonNegative(segment.start, 0, `Weather segment ${index}.start`);
    const end = finiteNonNegative(segment.end, 0, `Weather segment ${index}.end`);
    if (end <= start) throw new Error(`Weather segment ${index} must have positive duration`);
    return {
      id: String(segment.id ?? "clear"),
      start,
      end,
      precipitation: Boolean(segment.precipitation ?? segment.id === "rain"),
    };
  }).sort((a, b) => a.start - b.start);
}

function weatherAt(segments, worldTimeSeconds, fallbackId) {
  const segment = segments.find((entry) => worldTimeSeconds >= entry.start && worldTimeSeconds < entry.end);
  return segment ?? { id: fallbackId, precipitation: fallbackId === "rain" };
}

function nextWeatherBoundary(segments, cursor) {
  let next = Number.POSITIVE_INFINITY;
  for (const segment of segments) {
    if (segment.start > cursor + EPSILON) next = Math.min(next, segment.start);
    if (segment.end > cursor + EPSILON) next = Math.min(next, segment.end);
  }
  return next;
}
