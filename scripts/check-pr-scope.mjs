import assert from "node:assert/strict";
import { classifyPaths } from "./classify-pr-scope.mjs";

assert.equal(classifyPaths(["docs/readme.md", "NestledBurrow_local.bat"]), "micro");
assert.equal(classifyPaths(["AGENTS.md", "scripts/classify-pr-scope.mjs"]), "ci-meta");
assert.equal(classifyPaths(["scripts/manage-task-preview.mjs"]), "ci-meta");
assert.equal(classifyPaths(["src/main.js", "docs/runtime-note.md"]), "runtime");
assert.equal(classifyPaths([".github/workflows/pr-check.yml"]), "strict");
assert.equal(classifyPaths(["src/main.js", "package-lock.json"]), "strict");

console.log("PR scope classifier passed: micro, ci-meta, runtime and strict precedence are stable");
