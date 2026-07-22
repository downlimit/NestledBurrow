import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reconstructBinaryImport } from "./reconstruct-binary-import.mjs";

function writeStagedImport(repositoryRoot, importId, bytes, { sha256 = null } = {}) {
  const stagingRelative = `.binary-import/${importId}`;
  const stagingAbsolute = path.join(repositoryRoot, stagingRelative);
  mkdirSync(stagingAbsolute, { recursive: true });

  const encoded = bytes.toString("base64");
  const midpoint = Math.ceil(encoded.length / 8) * 4;
  const chunks = [encoded.slice(0, midpoint), encoded.slice(midpoint)].filter(Boolean);
  const chunkNames = chunks.map((_, index) => `${String(index).padStart(4, "0")}.b64`);

  for (let index = 0; index < chunks.length; index += 1) {
    writeFileSync(path.join(stagingAbsolute, chunkNames[index]), `${chunks[index]}\n`, "utf8");
  }

  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(
    path.join(stagingAbsolute, "manifest.json"),
    `${JSON.stringify(
      {
        version: 1,
        targetPath: `public/assets/audio/${importId}.mp3`,
        byteLength: bytes.length,
        sha256: sha256 ?? actualSha256,
        chunks: chunkNames,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { stagingRelative, actualSha256 };
}

const repositoryRoot = mkdtempSync(path.join(tmpdir(), "nestledburrow-binary-import-"));
try {
  const bytes = Buffer.from(Array.from({ length: 8193 }, (_, index) => (index * 31) % 256));
  const success = writeStagedImport(repositoryRoot, "success", bytes);
  const result = reconstructBinaryImport(success.stagingRelative, { repositoryRoot });

  assert.equal(result.targetPath, "public/assets/audio/success.mp3");
  assert.equal(result.byteLength, bytes.length);
  assert.equal(result.sha256, success.actualSha256);
  assert.deepEqual(readFileSync(path.join(repositoryRoot, result.targetPath)), bytes);
  assert.equal(existsSync(path.join(repositoryRoot, success.stagingRelative)), false, "successful staging directory is removed");

  const failure = writeStagedImport(repositoryRoot, "bad-hash", bytes, { sha256: "0".repeat(64) });
  assert.throws(
    () => reconstructBinaryImport(failure.stagingRelative, { repositoryRoot }),
    /sha256 mismatch/,
    "invalid hashes are rejected",
  );
  assert.equal(
    existsSync(path.join(repositoryRoot, "public/assets/audio/bad-hash.mp3")),
    false,
    "failed import does not write a target binary",
  );
  assert.equal(existsSync(path.join(repositoryRoot, failure.stagingRelative)), true, "failed staging remains available for diagnosis");

  const unsafe = writeStagedImport(repositoryRoot, "unsafe-target", bytes);
  const unsafeManifestPath = path.join(repositoryRoot, unsafe.stagingRelative, "manifest.json");
  const unsafeManifest = JSON.parse(readFileSync(unsafeManifestPath, "utf8"));
  unsafeManifest.targetPath = "../escaped.mp3";
  writeFileSync(unsafeManifestPath, `${JSON.stringify(unsafeManifest, null, 2)}\n`, "utf8");
  assert.throws(
    () => reconstructBinaryImport(unsafe.stagingRelative, { repositoryRoot }),
    /targetPath/,
    "repository path traversal is rejected",
  );

  console.log("Binary import bridge checks passed");
} finally {
  rmSync(repositoryRoot, { recursive: true, force: true });
}
