import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/pr-check.yml");
const lead = read("LEAD.md");
const agents = read("AGENTS.md");
const project = read("PROJECT.md");
const obsoleteTerm = ["пере", "проверка"].join("");

assert.match(workflow, /Publish Direct Preview/);
assert.match(workflow, /preview: \$\{\{ steps\.classify\.outputs\.preview \}\}/);
assert.match(workflow, /needs\.scope\.outputs\.preview == 'true'/);
assert.match(workflow, /npm run build -- --base=\.\//);
assert.match(workflow, /preview-pr-\$\{\{ github\.event\.pull_request\.number \}\}/);
assert.match(workflow, /raw\.githack\.com/);
assert.match(workflow, /Verify public preview/);
assert.match(workflow, /github\.event\.action == 'closed'/);
assert.match(workflow, /git push origin --delete/);
assert.match(workflow, /nestled-burrow-direct-preview/);

for (const [name, source] of [["LEAD.md", lead], ["AGENTS.md", agents], ["PROJECT.md", project]]) {
  assert.match(source, /препровер/iu, `${name} must describe the canonical precheck route`);
  assert.equal(source.includes(obsoleteTerm), false, `${name} still contains the obsolete term`);
}

console.log("PR direct preview contract check passed");
