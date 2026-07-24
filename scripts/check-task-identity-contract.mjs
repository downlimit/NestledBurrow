import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const roadmap = read("ROADMAP.md");
const lead = read("LEAD.md");
const review = read("REVIEW.md");
const override = read("AGENTS.override.md");
const prTemplate = read(".github/pull_request_template.md");
const taskTemplate = read("tasks/TEMPLATE.md");

const task = "Task #001 — Первая расчистка участка";
const taskFirstLink = "Task #001 — Первая расчистка участка (PR #81)";

assert(roadmap.includes(task), "ROADMAP.md must keep numbered Task identity");
assert(roadmap.includes("Следующий свободный номер"), "ROADMAP.md must record the next free Task number");
assert(roadmap.includes(taskFirstLink), "ROADMAP.md must use Task-first PR links");
assert(lead.includes(taskFirstLink), "LEAD.md must use Task-first PR links");
assert(review.includes(taskFirstLink), "REVIEW.md must use Task-first PR links");
assert(override.includes("Task #<task> — <name> (PR #<pr>)"), "repair reports must be Task-first");
assert(prTemplate.includes("Task: `Task #<number> — <human-readable result>`"), "PR template must keep Task identity");
assert(prTemplate.includes("task/<number>-<slug>"), "PR template must keep numbered branch identity");
assert(taskTemplate.startsWith("# Task #<number> —"), "durable task template must start with Task identity");

console.log("task identity contract passed: Task number and name are primary; PR number is a secondary address");
