import roomConfig from "./kenneyRoomConfig.json" with { type: "json" };

export const ROOM_WALL_BANDS = Object.freeze(
  roomConfig.wallBands.map((band) => Object.freeze({ ...band })),
);

export function buildRoomLayout(columns, rows, options = {}) {
  const bandCount = ROOM_WALL_BANDS.length;

  if (!Number.isInteger(columns) || !Number.isInteger(rows)) throw new TypeError("Room dimensions must be integers");
  if (columns < 3 || rows < bandCount * 2 + 1) throw new RangeError("Room is too small for the configured wall bands");

  const doorway = options.doorway ?? null;
  const layout = Array.from({ length: rows }, () => Array(columns).fill(null));

  for (let y = bandCount; y < rows - bandCount; y += 1) {
    layout[y][0] = roomConfig.sideFrame;
    layout[y][columns - 1] = roomConfig.sideFrame;
    for (let x = 1; x < columns - 1; x += 1) layout[y][x] = roomConfig.floorFrame;
  }

  const addWallBand = (y, band, edge) => {
    layout[y][0] = band[`${edge}Left`] ?? band.left;
    layout[y][columns - 1] = band[`${edge}Right`] ?? band.right;
    for (let x = 1; x < columns - 1; x += 1) layout[y][x] = band.center;
  };

  ROOM_WALL_BANDS.forEach((band, index) => {
    addWallBand(index, band, "upper");
    addWallBand(rows - bandCount + index, band, "lower");
  });

  if (doorway) {
    const doorY = rows - bandCount;
    for (let x = doorway.left; x < doorway.left + doorway.width; x += 1) {
      layout[doorY][x] = roomConfig.floorFrame;
      for (let y = doorY + 1; y < rows; y += 1) layout[y][x] = null;
    }
  }

  return layout;
}
