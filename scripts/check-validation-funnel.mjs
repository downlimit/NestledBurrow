import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const agents = read("AGENTS.md");
const workflow = read(".github/workflows/pr-check.yml");
const packageJson = JSON.parse(read("package.json"));

assert(
  /PR CI owns broad (?:repository )?validation/u.test(agents),
  "Codex publication must defer broad repository proof to PR CI",
);
assert(
  /Do not[^\n]*(?:mirror full PR CI locally|full `npm run check`[^\n]*full Playwright[^\n]*mirror PR CI)/u.test(agents),
  "Codex publication must not duplicate full CI locally",
);
assert(
  /Do not[^\n]*repeat `git diff --check`/u.test(agents),
  "codex:validate must remain the single publication diff-check owner",
);

assert(workflow.includes("name: Static Validation"), "PR CI must expose a static validation gate");
assert(workflow.includes("Run owner and system checks"), "owner/system contracts must run before historical regressions");
assert(workflow.includes("Run historical regressions"), "historical regressions must remain in full CI");
assert(workflow.includes("needs: [scope, build]"), "browser shards must wait for static validation");
assert(workflow.includes("needs.build.result == 'success'"), "browser regression must not start on a red static head");
assert(
  /github\.event\.action == 'edited' \|\|\s*needs\.scope\.outputs\.full_validation == 'false'/u.test(workflow),
  "Ready PR metadata edits must use the lightweight metadata gate",
);
assert(
  (workflow.match(/github\.event\.action != 'edited'/gu) ?? []).length >= 2,
  "PR body/title edits must not restart full static/browser validation",
);

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

console.log("validation funnel contract passed: Codex stays targeted, PR metadata edits stay cheap, and CI owns ordered broad regression");
