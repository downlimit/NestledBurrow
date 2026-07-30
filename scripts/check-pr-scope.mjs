import assert from "node:assert/strict";
import { classifyPaths, requiresPreview } from "./classify-pr-scope.mjs";

assert.equal(classifyPaths(["docs/readme.md", "NestledBurrow_local.bat"]), "micro");
assert.equal(classifyPaths(["AGENTS.md", "scripts/classify-pr-scope.mjs"]), "ci-meta");
assert.equal(classifyPaths(["scripts/manage-task-preview.mjs"]), "ci-meta");
assert.equal(classifyPaths(["src/main.js", "docs/runtime-note.md"]), "runtime");
assert.equal(classifyPaths([".github/workflows/pr-check.yml"]), "strict");
assert.equal(classifyPaths(["src/main.js", "package-lock.json"]), "strict");

assert.equal(requiresPreview(["GAME.md", "ROADMAP.md"]), false);
assert.equal(requiresPreview([".github/workflows/pr-check.yml", "scripts/check-pr-preview-contract.mjs"]), false);
assert.equal(requiresPreview(["requirements-dev.txt"]), false);
assert.equal(requiresPreview(["src/main.js"]), true);
assert.equal(requiresPreview(["package-lock.json"]), true);
assert.equal(requiresPreview([".github/workflows/pr-check.yml", "src/main.js"]), true);

console.log("PR scope classifier passed: lanes and preview relevance are stable");
