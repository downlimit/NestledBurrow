import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const requireText = (text, tokens, label) => {
  for (const token of tokens) assert(text.includes(token), `${label} must contain: ${token}`);
};

const project = read("PROJECT.md");
const lead = read("LEAD.md");
const agents = read("AGENTS.md");
const override = read("AGENTS.override.md");
const review = read("REVIEW.md");
const game = read("GAME.md");
const roadmap = read("ROADMAP.md");
const library = read("LIBRARY.md");
const architecture = read("ARCHITECTURE.md");
const fastLoop = read("FAST_LOOP.md");
const taskTemplate = read("tasks/TEMPLATE.md");
const taskReadme = read("tasks/README.md");
const prTemplate = read(".github/pull_request_template.md");
const prWorkflow = read(".github/workflows/pr-check.yml");
const focusedE2E = read("scripts/run-focused-e2e.mjs");
const managedPreview = read("scripts/manage-task-preview.mjs");
const pythonLauncher = read("scripts/run-python-check.mjs");
const packageJson = read("package.json");

const systemPaths = [
  "systems/character-and-needs.md",
  "systems/world-and-resources.md",
  "systems/tavern-service.md",
  "systems/build-and-authoring.md",
  "systems/persistence.md",
  "systems/presentation.md",
];

requireText(project, [
  "<!-- audience: project-bootstrap -->",
  "## Режимы запроса Лиду",
  "### Прямая реализация чатом",
  "AGENTS.md",
  "один-два релевантных system-документа",
], "PROJECT.md");

requireText(lead, [
  "<!-- audience: lead-chat -->",
  "## Сначала определить режим",
  "## Контекстный бюджет",
  "максимум два system-документа",
  "20–50",
  "Draft PR до приёмки",
  "src/main.js",
], "LEAD.md");

requireText(agents, [
  "<!-- audience: codex -->",
  "only the system documents",
  "Do not read `PROJECT.md`",
  "Draft PR before acceptance",
  "src/main.js is composition only",
  "check:architecture",
  "Fast publication after `принято`",
  "one Ready PR",
], "AGENTS.md");

requireText(review, [
  "<!-- audience: integrator-chat -->",
  "Минимальный контекст",
  "только system-документы",
  "terminal-состояния",
  "Task #001 — Первая расчистка участка (PR #81)",
], "REVIEW.md");

requireText(game, [
  "<!-- audience: product-design -->",
  "## Основной цикл",
  "## Текущий playable baseline",
  "## Ближайший продуктовый критерий",
  "не хранит Task numbers",
], "GAME.md");
assert(!/Task #\d{3}/.test(game), "GAME.md must not contain task history");
assert(!/PR #\d+/.test(game), "GAME.md must not contain PR history");

const nextMatch = roadmap.match(/Следующий свободный номер:\*\* `Task #(\d{3})`/);
assert(nextMatch, "ROADMAP.md must contain one next free Task number");
const nextNumber = Number(nextMatch[1]);
const headingNumbers = [...roadmap.matchAll(/^### Task #(\d{3})/gm)].map((match) => Number(match[1]));
assert(headingNumbers.length <= 3, "ROADMAP.md must stay active-only: no more than three task sections");
assert(headingNumbers.every((number) => number < nextNumber), "ROADMAP task numbers must be below next free number");
requireText(roadmap, ["## Сейчас", "## Следующий продуктовый вопрос", "## Правило актуализации"], "ROADMAP.md");

for (const path of systemPaths) {
  assert(existsSync(path), `${path} must exist`);
  const text = read(path);
  requireText(text, ["## Purpose", "## Invariants", "## Current baseline", "## Evidence"], path);
  assert(text.length <= 5000, `${path} exceeds focused system-doc budget`);
  assert(library.includes(path), `LIBRARY.md must route to ${path}`);
}

requireText(library, [
  "<!-- audience: context-router -->",
  "Обычная задача читает один system-документ",
  "## Маршруты",
  "## Межсистемные задачи",
], "LIBRARY.md");

requireText(architecture, [
  "src/main.js",
  "жёсткий предел",
  "2900",
  "Build и authoring",
  "Tavern service",
  "не вводятся",
], "ARCHITECTURE.md");

requireText(fastLoop, [
  "Задачи #038–#044",
  "Draft до приёмки",
  "src/main.js",
  "Когда менять процесс снова",
], "FAST_LOOP.md");

requireText(taskReadme, ["историей", "не читается"], "tasks/README.md");
requireText(taskTemplate, ["## Relevant systems", "One Ready PR"], "tasks/TEMPLATE.md");
requireText(override, ["Existing PR repair route", "same branch and PR", "final-head CI"], "AGENTS.override.md");
requireText(prTemplate, ["# Task", "## Result", "## Validation", "PR CI supplies the full repository suite"], "PR template");

assert(!prWorkflow.includes("github.event.pull_request.draft == false"), "PR CI may run for an explicitly requested Draft");
requireText(prWorkflow, ["Classify Scope", "needs: scope", "Run metadata checks"], "PR workflow");

requireText(focusedE2E, ["mkdtempSync", "tmpdir()", "PW_OUTPUT_DIR", "PW_REPORT_DIR"], "focused E2E");
requireText(managedPreview, ["tmpdir()", "task-preview.json", "smokeCanvas", "detached: true"], "managed preview");
requireText(pythonLauncher, ["NESTLEDBURROW_PYTHON", "python_embed", "No usable Python 3 runtime was found"], "Python launcher");
requireText(packageJson, ['"check:architecture": "node scripts/check-architecture-boundaries.mjs"'], "package.json");

for (const [label, text, limit] of [
  ["PROJECT.md", project, 7000],
  ["LEAD.md", lead, 7500],
  ["AGENTS.md", agents, 11000],
  ["REVIEW.md", review, 5000],
  ["GAME.md", game, 7000],
  ["ROADMAP.md", roadmap, 4500],
  ["LIBRARY.md", library, 6500],
]) {
  assert(text.length <= limit, `${label} exceeds context budget: ${text.length} > ${limit}`);
}

console.log("documentation contracts passed: role routing, focused system context, active-only roadmap and composition-root guard are enforced");
