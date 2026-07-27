import assert from "node:assert/strict";
import {
  AUTHORING_BACKUP_VERSION,
  normalizeAuthoringBackup,
} from "../src/authoringBackup.js";
import {
  DEFAULT_ASSET_PROFILES,
  migrateLegacyColliderOverrides,
  normalizeAssetProfiles,
} from "../src/assetProfiles.js";

const profiles = normalizeAssetProfiles({
  "facility:table": { colliderOffsets: { left: -2, right: 1, top: 0, bottom: 0 }, visualOffset: { x: 3, y: -1 } },
  "facility:gas-stove": { colliderOffsets: { left: 4, right: 0, top: 0, bottom: 0 } },
});
assert.deepEqual(profiles["facility:table"].visualOffset, { x: 3, y: -1 });
assert.deepEqual(profiles["facility:gas-stove"].visualOffset, DEFAULT_ASSET_PROFILES["facility:gas-stove"].visualOffset);

const migrated = migrateLegacyColliderOverrides({ "facility:table": { left: 2, right: 0, top: 0, bottom: 0 } });
assert.equal(migrated["facility:table"].colliderOffsets.left, 2);
const independentlySaved = migrateLegacyColliderOverrides({
  "facility:table": { left: 1, right: 0, top: 0, bottom: 0 },
  "facility:gas-stove": { left: 7, right: 0, top: 0, bottom: 0 },
});
assert.equal(independentlySaved["facility:table"].colliderOffsets.left, 1);
assert.equal(independentlySaved["facility:gas-stove"].colliderOffsets.left, 7);
const legacyBackup = normalizeAuthoringBackup({ version: 1, savedAt: "2026-07-27T00:00:00.000Z", colliderOverrides: { "facility:table": { left: 1, right: 0, top: 0, bottom: 0 } } });
assert.equal(legacyBackup.version, AUTHORING_BACKUP_VERSION);
assert.equal(legacyBackup.assetProfiles["facility:table"].colliderOffsets.left, 1);

console.log("Task #043 contracts passed: independent asset profiles and v1 backup migration");
