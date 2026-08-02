import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function gitRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "git root unavailable");
  return result.stdout.trim();
}

export function timingStatePath(root = gitRoot()) {
  const key = createHash("sha256").update(root).digest("hex").slice(0, 12);
  return join(tmpdir(), "NestledBurrow", "delivery-timing", `${key}.json`);
}

function load(path) {
  if (!existsSync(path)) throw new Error("No delivery timing session; run delivery:timing start <task> first");
  return JSON.parse(readFileSync(path, "utf8"));
}

function save(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function elapsed(start, end) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 1000);
}

function report(state) {
  const points = [{ name: "start", at: state.startedAt }, ...state.marks];
  console.log(`Delivery timing ${state.task}`);
  for (let index = 1; index < points.length; index += 1) {
    console.log(`  ${points[index].name}: ${elapsed(points[index - 1].at, points[index].at)}s`);
  }
  console.log(`  total: ${elapsed(state.startedAt, points.at(-1).at)}s`);
}

function main() {
  const [command, value] = process.argv.slice(2);
  const path = timingStatePath();
  if (command === "start") {
    if (!value) throw new Error("usage: npm run delivery:timing -- start <Task #number>");
    const state = { task: value, startedAt: new Date().toISOString(), marks: [] };
    save(path, state);
    console.log(`Delivery timing started for ${value}`);
  } else if (command === "mark") {
    if (!value) throw new Error("usage: npm run delivery:timing -- mark <phase>");
    const state = load(path);
    state.marks.push({ name: value, at: new Date().toISOString() });
    save(path, state);
    report(state);
  } else if (command === "report") {
    report(load(path));
  } else {
    throw new Error("usage: npm run delivery:timing -- start <task> | mark <phase> | report");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
