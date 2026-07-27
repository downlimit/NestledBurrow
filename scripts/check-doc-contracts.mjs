import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const requireText = (text, tokens, label) => {
  for (const token of tokens) assert(text.includes(token), `${label} must contain: ${token}`);
};

const project = read("PROJECT.md");
const agents = read("AGENTS.md");
const override = read("AGENTS.override.md");
const lead = read("LEAD.md");
const architecture = read("ARCHITECTURE.md");
const library = read("LIBRARY.md");
const review = read("REVIEW.md");
const fastLoop = read("FAST_LOOP.md");
const roadmap = read("ROADMAP.md");
const taskTemplate = read("tasks/TEMPLATE.md");
const prTemplate = read(".github/pull_request_template.md");
const prWorkflow = read(".github/workflows/pr-check.yml");
const scopeClassifier = read("scripts/classify-pr-scope.mjs");
const focusedE2E = read("scripts/run-focused-e2e.mjs");
const managedPreview = read("scripts/manage-task-preview.mjs");
const pythonLauncher = read("scripts/run-python-check.mjs");
const playwrightConfig = read("playwright.config.js");
const packageJson = read("package.json");

requireText(project, [
  "<!-- audience: project-bootstrap -->",
  "Feedback-итерации пользователя являются продуктовой работой",
  "Fast: минимальная активная публикация",
  "полным локальным check/build/E2E без конкретного риска",
  "ARCHITECTURE.md",
], "PROJECT.md");

requireText(agents, [
  "<!-- audience: codex -->",
  "compact architecture-aware brief",
  "Never ask the user to operate GitHub",
  "Use one strong proof per material risk",
  "User feedback and the time needed to evaluate feel are product work",
  "**Feedback gate:**",
  "**Fast publication after `принято`:**",
  "skip local `npm run check`, full/focused E2E",
  "**Strict publication:**",
  "scripts/run-python-check.mjs",
  "OS temp directory",
  "Do not blindly repeat an entire command or suite elevated",
  "When resuming accepted existing local work",
  "Never open a knowingly stale-base PR",
  "one final-head CI cycle",
  "Create one non-draft PR",
  "wait until every job for the current head SHA is terminal",
  "Task #<number> — <name>",
  "## Visual assets",
  "Codex image generation explicitly allowed",
  "Image generation was not invoked.",
], "AGENTS.md");

requireText(override, ["Existing PR repair route", "same branch and PR", "final-head CI"], "AGENTS.override.md");

requireText(lead, [
  "свободное описание пользователя",
  "Feedback-итерации, визуальный подбор",
  "40–80 строк",
  "Preview acceptance: required",
  "После `принято` Fast-задача",
  "Текущие сигналы",
  "Task #001 — Первая расчистка участка (PR #81)",
  "одним непрерывным fenced-блоком `text`",
  "## Visual assets",
  "Лид не выдаёт Codex SHA сырого transport-объекта",
], "LEAD.md");

requireText(architecture, [
  "## Условные границы для следующих Лидов",
  "### Build mode",
  "### Facilities и presentation camera",
  "не общий rewrite",
  "Pixelify Sans",
], "ARCHITECTURE.md");

requireText(library, [
  "не источник продуктового статуса",
  "src/buildModeRuntime.js",
  "scripts/run-python-check.mjs",
  "OS temp",
], "LIBRARY.md");

requireText(review, [
  "Codex сам завершает обычную задачу",
  "одним проходом",
  "terminal-состояния всех jobs",
  "Task #001 — Первая расчистка участка (PR #81)",
  "Codex review, reaction",
], "REVIEW.md");

requireText(fastLoop, [
  "# Task #020 — Ускорить цикл Codex",
  "Feedback-фаза не имеет искусственного лимита времени",
  "## Ретроспектива Task #030–#035",
  "### Решения Task #036",
  "## Ретроспектива публикации Task #035",
  "### Решение Task #037",
  "disposable stale-base CI",
  "### P0",
  "### P1",
  "### P2",
], "FAST_LOOP.md");

requireText(roadmap, [
  "Следующий свободный номер:** `Task #045`",
  "Task #044 — Исправить геометрию строительства и перенос ассетов (PR #151)",
  "Task #043 — Профили ассетов, pivot-редактор и библиотека кухни (PR #150)",
  "Task #042 — Запретить самогенерацию ассетов и обновить обеденный стол",
  "Task #041 — Надёжно сохранять веб-правки коллизий и топологии",
  "Task #040 — Каноническая стартовая расстановка, коллайдеры и посаженные деревья (PR #144)",
  "Task #037 — Не тратить CI на заведомо устаревшую базу",
  "Task #036 — Ускорить публикацию и стабилизировать Windows-инструменты",
  "Task #035 — Исправить мобильное меню строительства и джойстик (PR #136)",
  "**Статус:** `Принято`",
], "ROADMAP.md");

requireText(prTemplate, ["# Task", "## Result", "## Validation", "PR CI supplies the full repository suite"], "PR template");
requireText(taskTemplate, ["Use only for large, dependent, resumable", "Do not repeat AGENTS.md", "One Ready PR"], "task template");

assert(!prWorkflow.includes("github.event.pull_request.draft == false"), "PR CI must run for Draft and Ready PRs");
requireText(prWorkflow, ["Classify changed paths", "Classify Scope", "needs: scope", "needs.scope.outputs.browser == 'true'", "Run metadata checks"], "PR workflow");
requireText(prWorkflow, ["- name: Upload world previews\n        if: failure() && needs.scope.outputs.full_validation == 'true'", "- name: Upload Playwright test artifacts\n        if: failure()"], "failure artifact policy");
assert((prWorkflow.match(/fetch-depth: 0/g) ?? []).length >= 2, "scope and metadata validation must fetch the PR base commit");

requireText(scopeClassifier, ["micro", "ci-meta", "runtime", "strict", "full_validation", "browser"], "PR scope classifier");

requireText(focusedE2E, [
  "mkdtempSync",
  "tmpdir()",
  "PW_OUTPUT_DIR",
  "PW_REPORT_DIR",
  "probe.listen(0, \"127.0.0.1\"",
  "PW_BASE_URL",
], "focused E2E launcher");
assert(!focusedE2E.includes('"--port", "4173"'), "focused E2E must not claim the preview port");

requireText(managedPreview, [
  "tmpdir()",
  "task-preview.json",
  "smokeCanvas",
  "width !== 320",
  "detached: true",
  "windowsHide: true",
], "managed task preview");
assert(!managedPreview.includes('resolve("artifacts")'), "managed preview state must not live in the worktree artifacts directory");

requireText(pythonLauncher, [
  "NESTLEDBURROW_PYTHON",
  "Windows py launcher",
  "python_embed",
  "No usable Python 3 runtime was found",
], "portable Python launcher");
requireText(packageJson, [
  "node scripts/run-python-check.mjs scripts/check-room-preview.py",
  "node scripts/run-python-check.mjs scripts/check-character-diagonals.py",
], "package Python check routes");
assert(!packageJson.includes('"check:room-preview": "python '), "package checks must not depend on python being present on PATH");

requireText(playwrightConfig, [
  "process.env.PW_BASE_URL",
  "PW_OUTPUT_DIR",
  "PW_REPORT_DIR",
  "outputDir",
], "Playwright config");
assert(!existsSync(".github/workflows/auto-merge-clean-pr.yml"), "review-gated auto-merge workflow must stay removed");

for (const [label, text, limit] of [
  ["AGENTS.md", agents, 12000],
  ["AGENTS.override.md", override, 1500],
  ["LEAD.md", lead, 8500],
  ["REVIEW.md", review, 7000],
  ["PR template", prTemplate, 2500],
  ["task template", taskTemplate, 2500],
]) {
  assert(text.length <= limit, `${label} exceeds the fast-loop size budget: ${text.length} > ${limit}`);
}

console.log("documentation contracts passed: copy-paste Lead prompts, explicit asset-generation permission, one-CI accepted publication and portable tooling are enforced");
