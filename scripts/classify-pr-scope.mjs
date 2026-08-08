import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const normalize = (path) => path.replaceAll("\\", "/");

const isStrict = (path) =>
  path.startsWith(".github/workflows/") ||
  path === "package.json" ||
  path === "package-lock.json" ||
  path === "requirements-dev.txt" ||
  path === "vite.config.js" ||
  path === "playwright.config.js";

const isCiMeta = (path) =>
  [
    "AGENTS.md",
    "AGENTS.override.md",
    "PROJECT.md",
    "LEAD.md",
    "REVIEW.md",
    "FAST_LOOP.md",
    "ROADMAP.md",
    ".github/pull_request_template.md",
    "scripts/classify-pr-scope.mjs",
    "scripts/check-pr-scope.mjs",
    "scripts/check-doc-contracts.mjs",
    "scripts/check-task-identity-contract.mjs",
    "scripts/check-pr-preview-contract.mjs",
    "scripts/manage-task-preview.mjs",
  ].includes(path) || path.startsWith("tasks/");

const isMicro = (path) =>
  path.endsWith(".md") ||
  path.startsWith("docs/") ||
  path.endsWith(".bat") ||
  path.endsWith(".cmd");

const isPreviewRelevant = (path) =>
  !isCiMeta(path) &&
  !isMicro(path) &&
  !path.startsWith(".github/workflows/") &&
  path !== "requirements-dev.txt";

const isBrowserRelevant = (path) =>
  path.startsWith("src/") ||
  path.startsWith("tests/e2e/") ||
  path.startsWith("e2e/") ||
  path.startsWith("public/") ||
  path === ".github/workflows/pr-check.yml" ||
  path === "index.html" ||
  path === "vite.config.js" ||
  path === "playwright.config.js" ||
  path.endsWith(".css");

export function classifyPaths(paths) {
  const normalized = paths.filter(Boolean).map(normalize);
  if (normalized.some(isStrict)) return "strict";
  if (normalized.some((path) => !isCiMeta(path) && !isMicro(path))) return "runtime";
  if (normalized.some(isCiMeta)) return "ci-meta";
  return "micro";
}

export function requiresPreview(paths) {
  return paths.filter(Boolean).map(normalize).some(isPreviewRelevant);
}

export function requiresBrowser(paths) {
  return paths.filter(Boolean).map(normalize).some(isBrowserRelevant);
}

const DELIVERY_FIELDS = new Set(["player-visible", "preview-acceptance", "auto-merge"]);

export function parseDeliveryMetadata(body = "") {
  const block = body.match(/<!--\s*nestled-burrow-delivery:v1([\s\S]*?)-->/iu);
  if (!block) return { present: false, valid: true, values: {}, errors: [] };

  const values = {};
  const errors = [];
  for (const rawLine of block[1].split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([a-z-]+):\s*([a-z-]+)$/iu);
    if (!match || !DELIVERY_FIELDS.has(match[1].toLowerCase())) {
      errors.push(`unsupported metadata line: ${line}`);
      continue;
    }
    const field = match[1].toLowerCase();
    if (values[field]) errors.push(`duplicate metadata field: ${field}`);
    values[field] = match[2].toLowerCase();
  }

  const allowed = {
    "player-visible": new Set(["yes", "no"]),
    "preview-acceptance": new Set(["required", "not-required"]),
    "auto-merge": new Set(["yes", "no"]),
  };
  for (const field of DELIVERY_FIELDS) {
    if (!values[field]) errors.push(`missing metadata field: ${field}`);
    else if (!allowed[field].has(values[field])) errors.push(`invalid ${field}: ${values[field]}`);
  }

  return { present: true, valid: errors.length === 0, values, errors };
}

export function classifyPullRequest(paths, body = "") {
  const lane = classifyPaths(paths);
  const metadata = parseDeliveryMetadata(body);
  let preview = requiresPreview(paths);
  if (metadata.present && metadata.valid) {
    const visible = metadata.values["player-visible"] === "yes";
    const acceptanceRequired = metadata.values["preview-acceptance"] === "required";
    preview = visible || acceptanceRequired;
  }

  return {
    lane,
    fullValidation: lane === "runtime" || lane === "strict",
    browser: requiresBrowser(paths),
    preview,
    autoMerge:
      metadata.present &&
      metadata.valid &&
      metadata.values["auto-merge"] === "yes" &&
      metadata.values["preview-acceptance"] === "not-required" &&
      metadata.values["player-visible"] === "no" &&
      !preview,
    metadata,
  };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function changedPaths(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "git diff failed");
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function runCli() {
  const base = readArgument("--base");
  const head = readArgument("--head");
  if (!base || !head) throw new Error("usage: node scripts/classify-pr-scope.mjs --base <sha> --head <sha>");

  const paths = changedPaths(base, head);
  const bodyEnv = readArgument("--body-env");
  const classification = classifyPullRequest(paths, bodyEnv ? process.env[bodyEnv] ?? "" : "");
  const { lane, metadata } = classification;
  const output = [
    `lane=${lane}`,
    `full_validation=${classification.fullValidation}`,
    `browser=${classification.browser}`,
    `preview=${classification.preview}`,
    `auto_merge=${classification.autoMerge}`,
    `metadata_valid=${metadata.valid}`,
  ].join("\n");
  console.log(`PR scope: ${lane} (${paths.length} changed path${paths.length === 1 ? "" : "s"})`);
  if (!metadata.valid) console.warn(`Delivery metadata ignored: ${metadata.errors.join("; ")}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
  else console.log(output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli();