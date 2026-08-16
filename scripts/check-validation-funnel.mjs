import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const agents = read("AGENTS.md");
const workflow = read(".github/workflows/pr-check.yml");
const packageJson = JSON.parse(read("package.json"));

assert(
  agents.includes("PR CI owns broad repository validation for both Fast and Strict work."),
  "Codex publication must defer broad repository proof to PR CI",
);
assert(
  agents.includes("Do not run full `npm run check` or full Playwright locally merely to mirror PR CI."),
  "Codex publication must not duplicate full CI locally",
);
assert(
  agents.includes("Do not repeat `git diff --check` outside `codex:validate`."),
  "codex:validate must remain the single publication diff-check owner",
);

assert(workflow.includes("name: Static Validation"), "PR CI must expose a static validation gate");
assert(workflow.includes("Run owner and system checks"), "owner/system contracts must run before historical regressions");
assert(workflow.includes("Run historical regressions"), "historical regressions must remain in full CI");
assert(workflow.includes("needs: [scope, build]"), "browser shards must wait for static validation");
assert(workflow.includes("needs.build.result == 'success'"), "browser regression must not start on a red static head");

assert.equal(
  packageJson.scripts.check,
  "npm run check:owners && npm run check:history && npm run build",
  "full check must preserve the owner → history → build funnel",
);
assert(packageJson.scripts["check:owners"], "owner/system check group is required");
assert(packageJson.scripts["check:history"], "historical regression group is required");
assert(
  packageJson.scripts["check:history"].includes("check:task-091"),
  "Task #091 regression must participate in the full historical suite",
);

console.log("validation funnel contract passed: Codex stays targeted while CI owns ordered broad regression");
