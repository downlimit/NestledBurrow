import assert from "node:assert/strict";
import {
  classifyPaths,
  classifyPullRequest,
  parseDeliveryMetadata,
  requiresBrowser,
  requiresPreview,
} from "./classify-pr-scope.mjs";

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
assert.equal(requiresBrowser([".github/workflows/pr-check.yml", "package.json"]), false);
assert.equal(requiresBrowser(["src/worldBuildCoordinator.js", "package.json"]), true);
assert.equal(requiresBrowser(["public/locales/en/translation.json"]), true);

const noPreviewBody = `<!-- nestled-burrow-delivery:v1
player-visible: no
preview-acceptance: not-required
auto-merge: yes
-->`;
const visibleBody = `<!-- nestled-burrow-delivery:v1
player-visible: yes
preview-acceptance: required
auto-merge: no
-->`;

assert.deepEqual(parseDeliveryMetadata(noPreviewBody).errors, []);
assert.equal(classifyPullRequest(["package.json"], noPreviewBody).preview, false);
assert.equal(classifyPullRequest(["package.json"], noPreviewBody).browser, false);
assert.equal(classifyPullRequest(["package.json"], noPreviewBody).autoMerge, true);
assert.equal(classifyPullRequest(["ROADMAP.md"], visibleBody).preview, true);
assert.equal(classifyPullRequest(["ROADMAP.md"], visibleBody).autoMerge, false);
assert.equal(
  classifyPullRequest(["ROADMAP.md"], visibleBody.replace("auto-merge: no", "auto-merge: yes")).autoMerge,
  false,
);
assert.equal(classifyPullRequest(["src/main.js"], "").preview, true);

const malformed = classifyPullRequest(
  ["src/main.js"],
  "<!-- nestled-burrow-delivery:v1\nplayer-visible: perhaps\n-->"
);
assert.equal(malformed.metadata.valid, false);
assert.equal(malformed.preview, true);
assert.equal(malformed.autoMerge, false);

console.log("PR scope classifier passed: lanes and fail-safe delivery metadata are stable");
