import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize as normalizeNative, posix, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const normalize = (path) => path.replaceAll("\\", "/");
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".py", ".md", ".json", ".yml", ".yaml"]);

function trackedFiles(root) {
  const result = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "git ls-files failed");
  return result.stdout.split(/\r?\n/u).filter(Boolean).map(normalize);
}

function localImports(text) {
  const values = [];
  const pattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/gu;
  for (const match of text.matchAll(pattern)) if (match[1].startsWith(".")) values.push(match[1]);
  return values;
}

function resolveImport(importer, specifier, files) {
  const base = normalize(posix.normalize(posix.join(posix.dirname(importer), specifier)));
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}.ts`, `${base}/index.js`]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

function exportedNames(text) {
  return [...text.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gu)].map(
    (match) => match[1],
  );
}

export function analyzeSource(sourcePath, root = process.cwd()) {
  const source = normalize(relative(root, resolve(root, sourcePath)));
  const absolute = join(root, normalizeNative(source));
  if (!existsSync(absolute)) throw new Error(`Source does not exist: ${sourcePath}`);

  const files = trackedFiles(root);
  const fileSet = new Set(files);
  const sourceText = readFileSync(absolute, "utf8");
  const dependencies = localImports(sourceText)
    .map((specifier) => resolveImport(source, specifier, fileSet))
    .filter(Boolean);
  const importers = [];
  const references = [];
  const tokens = new Set([posix.basename(source), posix.basename(source, extname(source)), ...exportedNames(sourceText)]);

  for (const file of files) {
    if (file === source || !SOURCE_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const text = readFileSync(join(root, normalizeNative(file)), "utf8");
    const importsSource = localImports(text).some((specifier) => resolveImport(file, specifier, fileSet) === source);
    if (importsSource) importers.push(file);
    if ([...tokens].some((token) => token.length >= 4 && text.includes(token))) references.push(file);
  }

  const checks = [...new Set(references.filter((path) => /^scripts\/check-.*\.(?:mjs|py)$/u.test(path)))];
  return {
    source,
    exports: exportedNames(sourceText),
    dependencies: [...new Set(dependencies)].sort(),
    importers: [...new Set(importers)].sort(),
    checks: checks.sort(),
    references: [...new Set(references)].sort(),
  };
}

function argumentsFor(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function main() {
  const sources = argumentsFor("--source");
  if (sources.length === 0) throw new Error("usage: node scripts/scan-owner-impact.mjs --source <path> [--source <path>]");
  const reports = sources.map((source) => analyzeSource(source));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }
  for (const report of reports) {
    console.log(`Owner impact: ${report.source}`);
    console.log(`  imports: ${report.dependencies.join(", ") || "none"}`);
    console.log(`  importers: ${report.importers.join(", ") || "none"}`);
    console.log(`  contract checks: ${report.checks.join(", ") || "none"}`);
    console.log(`  source-address references: ${report.references.length}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
