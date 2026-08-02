import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { classifyPullRequest, parseDeliveryMetadata } from "./classify-pr-scope.mjs";
import { inspectNodeModules } from "./codex-preflight.mjs";
import { timingStatePath } from "./manage-delivery-timing.mjs";
import { selectValidationScripts } from "./run-validation-ladder.mjs";
import { analyzeSource } from "./scan-owner-impact.mjs";

const read = (path) => readFileSync(path, "utf8");
const metadata = `<!-- nestled-burrow-delivery:v1
player-visible: no
preview-acceptance: not-required
auto-merge: yes
-->`;

assert.equal(parseDeliveryMetadata(metadata).valid, true);
const routed = classifyPullRequest(["package.json", ".github/workflows/pr-check.yml"], metadata);
assert.equal(routed.lane, "strict");
assert.equal(routed.fullValidation, true);
assert.equal(routed.browser, false, "process-only Strict changes must skip Browser E2E");
assert.equal(routed.preview, false);
assert.equal(routed.autoMerge, true);

const invalid = classifyPullRequest(["src/main.js"], metadata.replace("player-visible: no", "player-visible: maybe"));
assert.equal(invalid.metadata.valid, false);
assert.equal(invalid.preview, true, "invalid metadata must preserve path-based preview");
assert.equal(invalid.autoMerge, false, "invalid metadata must disable automatic merge routing");

const impact = analyzeSource("src/worldBuildCoordinator.js");
assert(impact.importers.includes("src/main.js"), "owner scan must find the composition-root importer");
assert(impact.checks.includes("scripts/check-task-062.mjs"), "owner scan must find source-address contract checks");

const selected = selectValidationScripts(
  ["AGENTS.md", "src/worldBuildCoordinator.js", "scripts/check-task-063.mjs"],
  "063",
  {
    "check:docs": "node scripts/check-doc-contracts.mjs",
    "check:architecture": "node scripts/check-architecture-boundaries.mjs",
    "check:task-062": "node scripts/check-task-062.mjs",
    "check:task-063": "node scripts/check-task-063.mjs",
  },
  impact.checks,
);
assert.deepEqual(selected, ["check:docs", "check:architecture", "check:task-063", "check:task-062"]);

const dependencies = inspectNodeModules(process.cwd());
assert.equal(dependencies.external, false, "dependencies must not resolve through an external junction");
assert(timingStatePath().startsWith(tmpdir()), "delivery timing state must live in OS temp");

const agents = read("AGENTS.md");
const workflow = read(".github/workflows/pr-check.yml");
const pythonLauncher = read("scripts/run-python-check.mjs");
const validationLadder = read("scripts/run-validation-ladder.mjs");
assert(agents.includes("npm run codex:preflight") && agents.includes("npm run codex:impact"));
assert(agents.includes("native auto-merge through the connector"));
assert(workflow.includes("--body-env PR_BODY") && workflow.includes("metadata_valid"));
assert(pythonLauncher.includes("NESTLEDBURROW_ARTIFACT_DIR") && pythonLauncher.includes("codex-runtimes"));
assert(validationLadder.includes('run("git", ["diff", "--check", base])'));

console.log("Task #063 delivery-loop contract passed");
