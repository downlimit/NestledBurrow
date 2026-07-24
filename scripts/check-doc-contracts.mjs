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
const scopeClassifier = read("scripts/classify-pr-scope.mjs");
const focusedE2E = read("scripts/run-focused-e2e.mjs");
const playwrightConfig = read("playwright.config.js");

requireText(project, ["<!-- audience: project-bootstrap -->", "По умолчанию пользователь формулирует желаемый результат Лиду обычными словами", "достаточно глубоко разбирается в затронутой архитектуре", "системно безопасное ТЗ", "FAST_LOOP.md"], "PROJECT.md");
requireText(agents, [
  "<!-- audience: codex -->",
  "compact architecture-aware brief",
  "Never ask the user to operate GitHub",
  "Use one strong proof per material risk",
  "**Micro:**",
  "Skip installs, build, full checks",
  "Create one non-draft PR",
  "merge and fast-forward local `main`",
  "npm run check:e2e:focused",
  "native auto-merge",
  "## Preview acceptance",
  "explicit `принято`",
  "No full diff, stage, commit, push, PR, auto-merge, or merge",
  "separate free ports and never stop the live preview",
  "inspect state read-only before retry",
  "inspect the full diff once; commit once; push",
  "Task #<number> — <name>",
], "AGENTS.md");
requireText(override, ["Existing PR repair route", "same branch and PR", "final-head CI"], "AGENTS.override.md");
requireText(lead, ["свободное описание пользователя", "достаточно глубоко для системно безопасного ТЗ", "сохранения архитектурной целостности", "40–80 строк", "80–140 строк", "Preview acceptance: required", "до явного `принято`", "Task #001 — Первая расчистка участка (PR #81)"], "LEAD.md");
requireText(review, ["Codex сам завершает обычную задачу", "одним проходом", "Task #001 — Первая расчистка участка (PR #81)", "Codex review, reaction"], "REVIEW.md");
requireText(fastLoop, ["# Task #020 — Ускорить цикл Codex", "## Приоритетный чеклист", "### P0", "### P1", "### P2"], "FAST_LOOP.md");
requireText(prTemplate, ["# Task", "## Result", "## Validation", "PR CI supplies the full repository suite"], "PR template");
requireText(taskTemplate, ["Use only for large, dependent, resumable", "Do not repeat AGENTS.md", "One Ready PR"], "task template");

assert(!prWorkflow.includes("github.event.pull_request.draft == false"), "PR CI must run for Draft and Ready PRs");
requireText(prWorkflow, ["Classify changed paths", "Classify Scope", "needs: scope", "needs.scope.outputs.browser == 'true'", "Run metadata checks"], "PR workflow");
assert((prWorkflow.match(/fetch-depth: 0/g) ?? []).length >= 2, "scope and metadata validation must fetch the PR base commit");
requireText(scopeClassifier, ["micro", "ci-meta", "runtime", "strict", "full_validation", "browser"], "PR scope classifier");
requireText(focusedE2E, ["createServer", "probe.listen(0, \"127.0.0.1\"", "PW_BASE_URL", "String(port)"], "focused E2E launcher");
assert(!focusedE2E.includes('"--port", "4173"'), "focused E2E must not claim the preview port");
requireText(playwrightConfig, ["process.env.PW_BASE_URL", "baseURL", "${port}"], "Playwright config");
assert(!existsSync(".github/workflows/auto-merge-clean-pr.yml"), "review-gated auto-merge workflow must stay removed");

for (const [label, text, limit] of [
  ["AGENTS.md", agents, 7500],
  ["AGENTS.override.md", override, 1500],
  ["LEAD.md", lead, 7000],
  ["REVIEW.md", review, 7000],
  ["PR template", prTemplate, 2500],
  ["task template", taskTemplate, 2500],
]) {
  assert(text.length <= limit, `${label} exceeds the fast-loop size budget: ${text.length} > ${limit}`);
}

console.log("documentation contracts passed: compact Lead briefs, proportional validation, preview acceptance and CI-to-merge completion are enforced");
