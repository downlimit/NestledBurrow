import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/pr-check.yml");
const classifier = read("scripts/classify-pr-scope.mjs");
const lead = read("LEAD.md");
const agents = read("AGENTS.md");
const project = read("PROJECT.md");
const obsoleteTerm = ["пере", "проверка"].join("");

assert.match(workflow, /Publish Direct Preview/);
assert.match(workflow, /preview: \$\{\{ steps\.classify\.outputs\.preview \}\}/);
assert.match(workflow, /needs\.scope\.outputs\.preview == 'true'/);
assert.match(workflow, /github\.event\.pull_request\.draft == true/);
assert.match(workflow, /Verify delivery metadata/);
assert.match(workflow, /Enforce pending preview phase/);
assert.match(workflow, /if: steps\.classify\.outputs\.preview == 'true'/);
assert.match(workflow, /IS_DRAFT: \$\{\{ github\.event\.pull_request\.draft \}\}/);
assert.match(workflow, /test "\$IS_DRAFT" = "true"/);
assert.match(workflow, /github\.event\.action == 'ready_for_review'/);
assert.match(workflow, /npm run build -- --base=\.\//);
assert.match(workflow, /preview-pr-\$\{\{ github\.event\.pull_request\.number \}\}/);
assert.match(workflow, /raw\.githack\.com/);
assert.match(workflow, /Verify public preview/);
assert.match(workflow, /github\.event\.repository\.private == false/);
assert.match(workflow, /Verify private preview artifact/);
assert.match(workflow, /Upload private preview artifact/);
assert.match(workflow, /steps\.private-preview\.outputs\.artifact-url/);
assert.match(workflow, /github\.event\.action == 'closed'/);
assert.match(workflow, /git push origin --delete/);
assert.match(workflow, /nestled-burrow-direct-preview/);
assert.match(classifier, /metadata\.values\.executor === "chatgpt"/);
assert.match(classifier, /metadata\.values\["preview-acceptance"\] === "pending"/);
assert.match(classifier, /const preview = metadata\.present && metadata\.valid/);
assert.match(agents, /Codex never creates a Draft PR before acceptance/);
assert.match(agents, /set `preview-acceptance: accepted` while the PR is still Draft/);

for (const [name, source] of [["LEAD.md", lead], ["AGENTS.md", agents], ["PROJECT.md", project]]) {
  assert.match(source, /препровер/iu, `${name} must describe the canonical precheck route`);
  assert.equal(source.includes(obsoleteTerm), false, `${name} still contains the obsolete term`);
}

console.log("PR direct preview contract check passed: ChatGPT pending online preview is Draft-only and Codex remains local before acceptance");
