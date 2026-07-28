import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const ASSETS = Object.freeze([
  Object.freeze({
    path: "public/assets/project/farming/NestledBurrow_Farming.png",
    width: 144,
    height: 16,
    byteLength: 1040,
    sha256: "3f241cfa1c05aa23d71b021a62fa4a25d7b552193b05268c0f762aa7f57ab2db",
  }),
  Object.freeze({
    path: "public/assets/project/farming/NestledBurrow_Well.png",
    width: 16,
    height: 16,
    byteLength: 365,
    sha256: "38663d4ce106c0e7b4ec6dfeaacaeaf7542a60827475a61ae4704afc621e5226",
  }),
]);

function pngSize(bytes) {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "expected PNG signature");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR", "expected PNG IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

for (const expected of ASSETS) {
  const bytes = readFileSync(expected.path);
  assert.equal(bytes.length, expected.byteLength, `${expected.path} byte length changed`);
  assert.deepEqual(pngSize(bytes), { width: expected.width, height: expected.height }, `${expected.path} geometry changed`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, `${expected.path} SHA-256 changed`);
}

const manifest = JSON.parse(readFileSync("public/assets/project/farming/NestledBurrow_Farming.manifest.json", "utf8"));
assert.equal(manifest.version, 1);
assert.equal(manifest.nativePixelGrid, 16);
assert.equal(manifest.filtering, "nearest-neighbor");
assert.equal(manifest.provenance.generativeImageModel, false);
assert.deepEqual(
  manifest.assets[0].frames.map((frame) => frame.id),
  ["potato-seeds", "potato", "soil-dry", "soil-wet", "crop-planted", "crop-sprout", "crop-young", "crop-mature", "crop-rotten"],
);
assert.deepEqual(manifest.assets[1].depthAnchorOffset, { x: 8, y: 14 });
assert.deepEqual(manifest.assets[1].collisionRect, { left: 2, top: 8, right: 14, bottom: 14 });

console.log("Task #047 Lead-owned farming binaries passed PNG geometry, manifest and SHA-256 integrity checks");
