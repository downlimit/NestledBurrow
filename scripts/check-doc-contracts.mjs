import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (text, tokens, label) => {
  for (const token of tokens) assert(text.includes(token), `${label} must contain: ${token}`);
};

const project = read("PROJECT.md");
const agents = read("AGENTS.md");
const override = read("AGENTS.override.md");
const lead = read("LEAD.md");
const review = read("REVIEW.md");
const fastLoop = read("FAST_LOOP.md");
const taskTemplate = read("tasks/TEMPLATE.md");
const prTemplate = read(".github/pull_request_template.md");
const prWorkflow = read(".github/workflows/pr-check.yml");

requireText(project, ["<!-- audience: project-bootstrap -->", "По умолчанию пользователь ставит задачу непосредственно Codex", "FAST_LOOP.md"], "PROJECT.md");
requireText(agents, [
  "<!-- audience: codex -->",
  "The user talks directly to Codex",
  "Do not run the same proof through several equivalent commands",
  "Open one non-draft PR",
  "merge the routine PR",
  "Task #<number> — <name> (PR #<number>)",
], "AGENTS.md");
requireText(override, ["Existing PR repair", "same branch and PR", "Draft status is not required"], "AGENTS.override.md");
requireText(lead, ["Прямой разговор пользователя с Codex — основной маршрут", "Ориентир — до 40 строк", "Task #001 — Первая расчистка участка (PR #81)"], "LEAD.md");
requireText(review, ["Codex сам завершает обычную задачу", "одним проходом", "Task #001 — Первая расчистка участка (PR #81)", "Codex review, reaction"], "REVIEW.md");
requireText(fastLoop, ["# Task #020 — Ускорить цикл Codex", "## Приоритетный чеклист", "### P0", "### P1", "### P2"], "FAST_LOOP.md");
requireText(prTemplate, ["# Task", "## Result", "## Validation", "PR CI supplies the full repository suite"], "PR template");
requireText(taskTemplate, ["Use only for large, dependent, resumable", "Do not repeat AGENTS.md", "One Ready PR"], "task template");

assert(!prWorkflow.includes("github.event.pull_request.draft == false"), "PR CI must run for Draft and Ready PRs");
assert(!existsSync(".github/workflows/auto-merge-clean-pr.yml"), "review-gated auto-merge workflow must stay removed");

for (const [label, text, limit] of [
  ["AGENTS.md", agents, 10000],
  ["AGENTS.override.md", override, 6000],
  ["LEAD.md", lead, 7000],
  ["REVIEW.md", review, 7000],
  ["PR template", prTemplate, 2500],
  ["task template", taskTemplate, 2500],
]) {
  assert(text.length <= limit, `${label} exceeds the fast-loop size budget: ${text.length} > ${limit}`);
}

console.log("documentation contracts passed: direct Codex flow, Task-first reporting, compact prompts, proportional validation and CI-to-merge completion are enforced");
