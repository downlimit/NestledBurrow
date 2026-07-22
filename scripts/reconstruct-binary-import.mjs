import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp3",
  ".wav",
  ".ogg",
  ".ttf",
  ".otf",
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRepositoryPath(repositoryPath) {
  invariant(typeof repositoryPath === "string" && repositoryPath.length > 0, "targetPath must be a non-empty string");
  invariant(!repositoryPath.includes("\\"), "targetPath must use forward slashes");
  invariant(!repositoryPath.includes("\0"), "targetPath contains a null byte");

  const normalized = path.posix.normalize(repositoryPath);
  invariant(normalized === repositoryPath, `targetPath is not normalized: ${repositoryPath}`);
  invariant(!normalized.startsWith("/"), "targetPath must be repository-relative");
  invariant(!normalized.startsWith("../") && normalized !== "..", "targetPath escapes the repository");
  invariant(normalized.startsWith("public/assets/"), "targetPath must stay under public/assets/");

  const extension = path.posix.extname(normalized).toLowerCase();
  invariant(ALLOWED_EXTENSIONS.has(extension), `unsupported binary extension: ${extension || "<none>"}`);
  return normalized;
}

function decodeStrictBase64(encodedText) {
  const encoded = encodedText.replace(/\s+/g, "");
  invariant(encoded.length > 0, "binary staging data is empty");
  invariant(encoded.length % 4 === 0, "base64 length must be divisible by four");
  invariant(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded), "binary staging data is not valid base64 text");

  const bytes = Buffer.from(encoded, "base64");
  const canonicalInput = encoded.replace(/=+$/u, "");
  const canonicalOutput = bytes.toString("base64").replace(/=+$/u, "");
  invariant(canonicalInput === canonicalOutput, "binary staging data failed strict base64 round-trip validation");
  return bytes;
}

export function reconstructBinaryImport(stagingDirectory, { repositoryRoot = process.cwd() } = {}) {
  const absoluteRoot = path.resolve(repositoryRoot);
  const absoluteStaging = path.resolve(absoluteRoot, stagingDirectory);
  const relativeStaging = path.relative(absoluteRoot, absoluteStaging).split(path.sep).join("/");

  invariant(
    relativeStaging.startsWith(".binary-import/") && relativeStaging !== ".binary-import",
    "staging directory must be a child of .binary-import/",
  );

  const manifestPath = path.join(absoluteStaging, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  invariant(manifest && typeof manifest === "object" && !Array.isArray(manifest), "manifest must be an object");
  invariant(manifest.version === 1, `unsupported manifest version: ${String(manifest.version)}`);
  invariant(Number.isSafeInteger(manifest.byteLength) && manifest.byteLength >= 0, "byteLength must be a safe non-negative integer");
  invariant(typeof manifest.sha256 === "string" && /^[a-f0-9]{64}$/.test(manifest.sha256), "sha256 must be lowercase hex");
  invariant(Array.isArray(manifest.chunks) && manifest.chunks.length > 0, "chunks must be a non-empty array");

  const targetPath = normalizeRepositoryPath(manifest.targetPath);
  const seenChunks = new Set();
  const chunkTexts = manifest.chunks.map((chunkName) => {
    invariant(typeof chunkName === "string" && /^\d{4}\.b64$/.test(chunkName), `invalid chunk name: ${String(chunkName)}`);
    invariant(!seenChunks.has(chunkName), `duplicate chunk name: ${chunkName}`);
    seenChunks.add(chunkName);
    return readFileSync(path.join(absoluteStaging, chunkName), "utf8");
  });

  const bytes = decodeStrictBase64(chunkTexts.join(""));
  invariant(bytes.length === manifest.byteLength, `byte length mismatch: expected ${manifest.byteLength}, got ${bytes.length}`);

  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  invariant(actualSha256 === manifest.sha256, `sha256 mismatch: expected ${manifest.sha256}, got ${actualSha256}`);

  const absoluteTarget = path.resolve(absoluteRoot, ...targetPath.split("/"));
  const relativeTarget = path.relative(absoluteRoot, absoluteTarget);
  invariant(!relativeTarget.startsWith("..") && !path.isAbsolute(relativeTarget), "resolved target escapes repository root");

  mkdirSync(path.dirname(absoluteTarget), { recursive: true });
  writeFileSync(absoluteTarget, bytes);
  rmSync(absoluteStaging, { recursive: true, force: false });

  return Object.freeze({
    targetPath,
    byteLength: bytes.length,
    sha256: actualSha256,
  });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const stagingDirectory = process.argv[2];
  if (!stagingDirectory) {
    console.error("Usage: node scripts/reconstruct-binary-import.mjs .binary-import/<import-id>");
    process.exitCode = 2;
  } else {
    try {
      const result = reconstructBinaryImport(stagingDirectory);
      console.log(`Reconstructed ${result.targetPath} (${result.byteLength} bytes, sha256 ${result.sha256})`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
