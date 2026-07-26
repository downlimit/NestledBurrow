import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const checkArgs = process.argv.slice(2);
if (checkArgs.length === 0) {
  console.error("usage: node scripts/run-python-check.mjs <script.py> [...args]");
  process.exit(2);
}

const candidates = [];
const seen = new Set();

function addCandidate(command, prefixArgs = [], label = command) {
  if (!command) return;
  const key = `${command}\0${prefixArgs.join("\0")}`;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({ command, prefixArgs, label });
}

for (const [name, value] of [
  ["NESTLEDBURROW_PYTHON", process.env.NESTLEDBURROW_PYTHON],
  ["PYTHON", process.env.PYTHON],
]) {
  if (value) addCandidate(value, [], name);
}

function collectPythonExecutables(root, depth = 2) {
  if (!root || !existsSync(root) || depth < 0) return;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isFile() && /^python(?:3(?:\.\d+)?)?\.exe$/iu.test(entry.name)) {
      addCandidate(path, [], path);
      continue;
    }
    if (!entry.isDirectory() || depth === 0) continue;
    if (depth === 2 || /python|runtime|embed|tools|versions/iu.test(entry.name)) {
      collectPythonExecutables(path, depth - 1);
    }
  }
}

if (process.platform === "win32") {
  addCandidate("py", ["-3"], "Windows py launcher");
  addCandidate("python", [], "python on PATH");
  addCandidate("python3", [], "python3 on PATH");

  const cwd = process.cwd();
  const executableDir = dirname(process.execPath);
  for (const root of [
    join(cwd, "python_embed"),
    join(dirname(cwd), "python_embed"),
    join(executableDir, "python_embed"),
    join(dirname(executableDir), "python_embed"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "Python"),
    process.env.USERPROFILE && join(process.env.USERPROFILE, ".pyenv", "pyenv-win", "versions"),
    process.env.USERPROFILE && join(process.env.USERPROFILE, "scoop", "apps", "python"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Python"),
  ]) {
    collectPythonExecutables(root);
  }
} else {
  addCandidate("python3", [], "python3 on PATH");
  addCandidate("python", [], "python on PATH");
}

function isUsable(candidate) {
  try {
    const result = spawnSync(candidate.command, [...candidate.prefixArgs, "--version"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

const selected = candidates.find(isUsable);
if (!selected) {
  console.error(
    "No usable Python 3 runtime was found. Set NESTLEDBURROW_PYTHON to python.exe or install a Python launcher once.",
  );
  process.exit(1);
}

const result = spawnSync(selected.command, [...selected.prefixArgs, ...checkArgs], {
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  console.error(`Failed to run ${selected.label}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
