import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { WORLD_TRANSITION_ASSETS } from "../src/world/worldConfig.js";

const EXPECTED = Object.freeze({
  burrowToNest: [64, 128],
  atollPathNorth: [48, 48],
  atollPathDiagonal: [48, 48],
  atollTeleportPlatform: [64, 64],
  atollTeleportConstruct: [64, 64],
});

for (const [key, [expectedWidth, expectedHeight]] of Object.entries(EXPECTED)) {
  const asset = WORLD_TRANSITION_ASSETS[key];
  assert(asset, key + " must be registered");
  assert.deepEqual([asset.width, asset.height], [expectedWidth, expectedHeight]);
  assertDecodableRgbaPng("public/" + asset.path, expectedWidth, expectedHeight);
}

console.log("Task #084 PNG integrity checks passed");

function assertDecodableRgbaPng(path, expectedWidth, expectedHeight) {
  const bytes = readFileSync(path);
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], path + " PNG signature");
  let offset = 8;
  let width = 0;
  let height = 0;
  let encoding = null;
  let sawIend = false;
  const idat = [];
  while (offset < bytes.length) {
    assert(offset + 12 <= bytes.length, path + " truncated chunk header");
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    assert(end <= bytes.length, path + " truncated " + type);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      encoding = [data[8], data[9], data[10], data[11], data[12]];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") sawIend = true;
    offset = end;
    if (type === "IEND") break;
  }
  assert.equal(sawIend, true, path + " must contain IEND");
  assert.equal(offset, bytes.length, path + " must end at IEND");
  assert.deepEqual([width, height], [expectedWidth, expectedHeight], path + " dimensions");
  assert.deepEqual(encoding, [8,6,0,0,0], path + " must be non-interlaced 8-bit RGBA");
  assert(idat.length > 0, path + " must contain IDAT");
  const filtered = inflateSync(Buffer.concat(idat));
  assert.equal(filtered.length, expectedHeight * (1 + expectedWidth * 4), path + " complete filtered RGBA scanlines");
  const stride = 1 + expectedWidth * 4;
  for (let row = 0; row < expectedHeight; row += 1) assert(filtered[row * stride] <= 4, path + " valid PNG filter at row " + row);
}
