import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const project = read("PROJECT.md");
const roadmap = read("ROADMAP.md");
const lead = read("LEAD.md");
const review = read("REVIEW.md");
const override = read("AGENTS.override.md");
const prTemplate = read(".github/pull_request_template.md");
const taskTemplate = read("tasks/TEMPLATE.md");

const canonicalTask = "Task #001 — Первая расчистка участка";
const linkedReference = "PR #81 · Task #001 — Первая расчистка участка";
const repairCommand = "Task #001 — Почини «Первую расчистку участка» в существующем PR #81 по последнему repair-комментарию.";

for (const [label, text] of [
  ["PROJECT.md", project],
  ["ROADMAP.md", roadmap],
  ["LEAD.md", lead],
  ["REVIEW.md", review],
]) {
  assert(text.includes("Task #<" ) || text.includes(canonicalTask), `${label} must describe numbered Task identity`);
}

assert(roadmap.includes(canonicalTask), "ROADMAP.md must assign the active task a permanent Task number");
assert(roadmap.includes("Следующий свободный номер"), "ROADMAP.md must record the next free Task number");
assert(roadmap.includes("Task #002 — Полный цикл одного картофеля"), "ROADMAP.md must number planned work consistently");
assert(roadmap.includes(linkedReference), "ROADMAP.md must link PR and Task identities");
assert(roadmap.includes(repairCommand), "ROADMAP.md must expose the canonical numbered repair command");

assert(lead.includes("Первая строка prompt"), "LEAD.md must standardize the first Codex prompt line");
assert(lead.includes("PR title: Task #001 — Первая расчистка участка"), "LEAD.md must standardize PR title from Task identity");
assert(lead.includes("task/001-first-debris-clear"), "LEAD.md must standardize task branch naming");
assert(lead.includes(linkedReference), "LEAD.md must require linked PR and Task references");

assert(review.includes("PR #<номер> · Task #<номер> — <название>"), "REVIEW.md must require linked PR and Task references");
assert(review.includes(repairCommand), "REVIEW.md must issue a numbered repair command");
assert(review.includes("Repair, rebase и повторная приёмка сохраняют исходный Task number"), "REVIEW.md must preserve Task identity through repair");

assert(override.includes("Task #<task-number>"), "AGENTS.override.md must route numbered repair commands");
assert(override.includes("same existing PR head branch"), "AGENTS.override.md must preserve existing repair branch ownership");

assert(prTemplate.includes("# Task"), "PR template must have a mandatory Task section");
assert(prTemplate.includes("PR title: must exactly match the Task title above"), "PR template must preserve exact Task title");
assert(prTemplate.includes("task/<number>-<slug>"), "PR template must use numbered branch naming");

assert(taskTemplate.startsWith("# Task #<number> —"), "durable task template must start with canonical Task identity");
assert(taskTemplate.includes("Repair of the same result keeps the same Task number"), "task template must preserve identity through repair");

console.log("task identity contract passed: numbered Codex title, branch, PR and role references stay linked");
