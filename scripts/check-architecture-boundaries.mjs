import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync("src/main.js", "utf8").replace(/\r\n/g, "\n");
const lineCount = main.split("\n").length;
const MAX_WORLD_SCENE_LINES = 2900;

assert(
  lineCount <= MAX_WORLD_SCENE_LINES,
  `src/main.js is ${lineCount} lines; composition-root ceiling is ${MAX_WORLD_SCENE_LINES}. Extract system orchestration instead of growing WorldScene.`,
);

console.log(`architecture boundaries passed: src/main.js ${lineCount}/${MAX_WORLD_SCENE_LINES} lines`);
