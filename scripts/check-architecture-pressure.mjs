import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const HOTSPOT_PATHS = new Set([
  "src/main.js",
  "src/build/worldBuildCoordinator.js",
  "src/world/worldLocationRuntime.js",
]);

export function parseArchitecturePressure(body = "") {
  const match = String(body).match(/^\s*-?\s*Architecture pressure:\s*`?([^`\r\n]+)`?\s*$/imu);
  if (!match) return { present: false, value: "", valid: false };
  const value = match[1].trim();
  const invalid = !value
    || /^(choose|todo|tbd|<.*>)$/iu.test(value)
    || value.includes("<owner>")
    || value.includes("<сработавший");
  return { present: true, value, valid: !invalid };
}

export function validateArchitecturePressure(paths, body = "") {
  const normalized = paths.map((path) => path.replaceAll("\\", "/"));
  const productionPaths = normalized.filter((path) => /^src\/.+\.(?:js|css)$/u.test(path));
  if (productionPaths.length === 0) {
    return { required: false, valid: true, value: "", hotspots: [] };
  }

  const declaration = parseArchitecturePressure(body);
  const hotspots = productionPaths.filter((path) => HOTSPOT_PATHS.has(path));
  if (!declaration.valid) {
    return {
      required: true,
      valid: false,
      value: declaration.value,
      hotspots,
      error: "production PR must declare `Architecture pressure: none` or a concrete owner/trigger",
    };
  }
  if (hotspots.length > 0 && declaration.value.toLowerCase() === "none") {
    return {
      required: true,
      valid: false,
      value: declaration.value,
      hotspots,
      error: `hotspot changes require a reviewed explanation or addressed trigger: ${hotspots.join(", ")}`,
    };
  }
  return { required: true, valid: true, value: declaration.value, hotspots };
}

function changedPaths(base, head) {
  const output = execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" });
  return output.split(/\r?\n/u).filter(Boolean);
}

function run() {
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  assert(base && head, "BASE_SHA and HEAD_SHA are required");
  const result = validateArchitecturePressure(changedPaths(base, head), process.env.PR_BODY ?? "");
  assert(result.valid, result.error);
  if (!result.required) {
    console.log("architecture pressure declaration not required: no production source changes");
    return;
  }
  console.log(`architecture pressure declaration passed: ${result.value}`);
}

if (import.meta.url === `file://${process.argv[1]}`) run();
