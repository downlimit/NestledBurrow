import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const normalize = (path) => path.replaceAll("\\", "/");

const isStrict = (path) =>
  path.startsWith(".github/workflows/") ||
  path === "package.json" ||
  path === "package-lock.json" ||
  path === "requirements-dev.txt" ||
  path === "vite.config.js";

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
  const lane = classifyPaths(paths);
  const output = [
    `lane=${lane}`,
    `full_validation=${lane === "runtime" || lane === "strict"}`,
    `browser=${lane === "runtime" || lane === "strict"}`,
    `preview=${requiresPreview(paths)}`,
  ].join("\n");
  console.log(`PR scope: ${lane} (${paths.length} changed path${paths.length === 1 ? "" : "s"})`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
  else console.log(output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli();
