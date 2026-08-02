import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSource } from "./scan-owner-impact.mjs";

const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix =
  process.platform === "win32" ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] : [];
const dryRun = process.argv.includes("--dry-run");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function changedPaths(base) {
  const result = spawnSync("git", ["diff", "--name-only", base], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "git diff failed");
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (untracked.status !== 0) throw new Error(untracked.stderr.trim() || "git ls-files failed");
  return [result.stdout, untracked.stdout].join("\n").split(/\r?\n/u).filter(Boolean);
}

export function selectValidationScripts(paths, taskNumber, packageScripts, referencedChecks = []) {
  const selected = new Set();
  if (paths.some((path) => path.endsWith(".md") || path.startsWith(".github/") || path === "package.json")) {
    selected.add("check:docs");
  }
  if (paths.some((path) => path.startsWith("src/") || path === "ARCHITECTURE.md")) {
    selected.add("check:architecture");
  }
  if (taskNumber && packageScripts[`check:task-${taskNumber}`]) selected.add(`check:task-${taskNumber}`);

  for (const [name, command] of Object.entries(packageScripts)) {
    if (!name.startsWith("check:") || name === "check:e2e" || name === "check:e2e:focused") continue;
    if (paths.some((path) => command.includes(path))) selected.add(name);
    if (referencedChecks.some((path) => command.includes(path))) selected.add(name);
  }
  return [...selected];
}

function main() {
  const base = readArgument("--base");
  if (!base) throw new Error("usage: node scripts/run-validation-ladder.mjs --base <sha> [--task 063] [--full]");
  const task = readArgument("--task");
  const paths = changedPaths(base);
  const packageScripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  const referencedChecks = paths
    .filter((path) => path.startsWith("src/") && existsSync(path))
    .flatMap((path) => analyzeSource(path).checks);

  run("git", ["diff", "--check", base]);
  for (const path of paths.filter((path) => existsSync(path) && [".js", ".mjs"].includes(extname(path)))) {
    run(process.execPath, ["--check", path]);
  }
  const selected = selectValidationScripts(paths, task, packageScripts, referencedChecks);
  console.log(`Validation ladder direct checks: ${selected.join(", ") || "none"}`);
  for (const name of selected) run(npmCommand, [...npmPrefix, "run", name]);
  if (process.argv.includes("--full")) run(npmCommand, [...npmPrefix, "run", "check"]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
