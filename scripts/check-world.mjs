import assert from "node:assert/strict";
import { moveWithCollision } from "../src/movement.js";
import { createWorldLayout, isBlockedCell } from "../src/worldLayout.js";
import { DOOR_LEFT, DOOR_WIDTH, DOOR_Y, GAME_HEIGHT, GAME_WIDTH, ROOM_COLUMNS, ROOM_ROWS, ROOM_TILE_X, ROOM_TILE_Y, WORLD_HEIGHT, WORLD_WIDTH } from "../src/worldConfig.js";
import roomConfig from "../src/kenneyRoomConfig.json" with { type: "json" };

const layout = createWorldLayout();
assert(WORLD_WIDTH > GAME_WIDTH && WORLD_HEIGHT > GAME_HEIGHT, "world is larger than camera");
for (let x = DOOR_LEFT; x < DOOR_LEFT + DOOR_WIDTH; x += 1) assert.equal(isBlockedCell(layout, x, DOOR_Y), false, "doorway is open");
for (const tile of layout.roomTiles) {
  const inDoor = tile.y === DOOR_Y && tile.x >= DOOR_LEFT && tile.x < DOOR_LEFT + DOOR_WIDTH;
  if (tile.frame !== roomConfig.floorFrame && !inDoor) assert.equal(isBlockedCell(layout, tile.x, tile.y), true, `wall ${tile.x},${tile.y} blocks`);
}
const step = 8, footW = 8, footD = 5;
let p = { ...layout.spawn };
while (p.y < layout.outdoorTarget.y) p = moveWithCollision(p, { x: 0, y: step }, layout, footW, footD);
assert(p.y >= layout.outdoorTarget.y - step, "walkable route reaches outdoor path");
const wallTry = moveWithCollision({ x: (ROOM_TILE_X + 1) * 16 + 8, y: (ROOM_TILE_Y + 3) * 16 + 14 }, { x: -24, y: 0 }, layout, footW, footD);
assert(wallTry.x > ROOM_TILE_X * 16 + 8, "movement cannot cross solid wall");
const slide = moveWithCollision({ x: (ROOM_TILE_X + 1) * 16 + 8, y: (ROOM_TILE_Y + 4) * 16 + 14 }, { x: -24, y: 8 }, layout, footW, footD);
assert(slide.y > (ROOM_TILE_Y + 4) * 16 + 14, "axis-separated movement slides along wall");
assert.deepEqual(moveWithCollision({ x: 4, y: 4 }, { x: -99, y: -99 }, layout, footW, footD), { x: 4, y: footD }, "world bounds clamp correctly");
console.log(`world checks passed: ${WORLD_WIDTH}x${WORLD_HEIGHT}, room ${ROOM_COLUMNS}x${ROOM_ROWS}`);
