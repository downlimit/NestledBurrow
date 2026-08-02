import { existsSync, lstatSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix =
  process.platform === "win32" ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] : [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    stdio: options.inherit ? "inherit" : "pipe",
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `${command} exited ${result.status}`;
    throw new Error(detail);
  }
  return result.stdout?.trim() ?? "";
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function isWithin(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function inspectNodeModules(root) {
  const path = join(root, "node_modules");
  if (!existsSync(path)) return { exists: false, complete: false, external: false, path };
  const resolved = realpathSync(path);
  const linked = lstatSync(path).isSymbolicLink();
  return {
    exists: true,
    complete: existsSync(join(path, ".package-lock.json")),
    external: linked && !isWithin(realpathSync(root), resolved),
    linked,
    path,
    resolved,
  };
}

function verifyWritable(parent, label) {
  const directory = mkdtempSync(join(parent, ".nestledburrow-preflight-"));
  try {
    writeFileSync(join(directory, "write-probe"), "ok\n", "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log(`PASS ${label}: writable`);
}

function main() {
  const root = realpathSync(run("git", ["rev-parse", "--show-toplevel"]));
  const branch = run("git", ["branch", "--show-current"], { cwd: root });
  const head = run("git", ["rev-parse", "HEAD"], { cwd: root });
  const base = readArgument("--base") ?? head;

  run("git", ["cat-file", "-e", `${base}^{commit}`], { cwd: root });
  if (head !== run("git", ["rev-parse", base], { cwd: root })) {
    throw new Error(`HEAD ${head} does not match requested Base SHA ${base}`);
  }
  if (!branch.startsWith("task/") || branch === "main") {
    throw new Error(`Expected an isolated task/* branch, got ${branch || "detached HEAD"}`);
  }
  if (run("git", ["status", "--porcelain"], { cwd: root })) {
    throw new Error("Preflight must run before edits in a clean worktree");
  }
  console.log(`PASS git: ${branch} at ${head}`);

  verifyWritable(root, "worktree");
  verifyWritable(tmpdir(), "OS temp");

  let dependencies = inspectNodeModules(root);
  if (dependencies.external) {
    throw new Error(`node_modules resolves outside this worktree: ${dependencies.resolved}`);
  }
  if ((!dependencies.exists || !dependencies.complete) && hasFlag("--install")) {
    console.log("Installing isolated dependencies with npm ci...");
    const cacheKey = createHash("sha256").update(root).digest("hex").slice(0, 12);
    run(npmCommand, [...npmPrefix, "ci"], {
      cwd: root,
      inherit: true,
      env: { ...process.env, npm_config_cache: join(tmpdir(), "NestledBurrow", "npm-cache", cacheKey) },
    });
    dependencies = inspectNodeModules(root);
  }
  if (!dependencies.exists || !dependencies.complete) {
    throw new Error("node_modules is missing or incomplete; rerun with --install for an isolated npm ci");
  }
  console.log(`PASS dependencies: ${dependencies.linked ? "local link" : "local directory"}`);

  run(process.execPath, ["scripts/run-python-check.mjs", "-c", "import sys; print(sys.executable)"], {
    cwd: root,
    inherit: true,
  });
  console.log("PASS Python: usable runtime discovered");

  const origin = run("git", ["remote", "get-url", "origin"], { cwd: root });
  console.log(`PASS publication route: connector-first for ${origin}; verify app capability before push`);
  console.log("Codex preflight passed");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
