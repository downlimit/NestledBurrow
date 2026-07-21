import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const hasAll = (text, required, label) => {
  for (const token of required) {
    assert(text.includes(token), `${label} must contain: ${token}`);
  }
};

const project = read("PROJECT.md");
const lead = read("LEAD.md");
const agents = read("AGENTS.md");
const review = read("REVIEW.md");
const library = read("LIBRARY.md");
const taskTemplate = read("tasks/TEMPLATE.md");
const prTemplate = read(".github/pull_request_template.md");

hasAll(
  project,
  [
    "<!-- audience: project-bootstrap -->",
    "привет, ты лид",
    "привет, ты интегратор",
    "проверь все PR",
    "LEAD.md",
    "REVIEW.md",
    "Fast lane используется по умолчанию",
    "Полное ревью не должно блокировать Lead-чат",
  ],
  "PROJECT.md",
);
assert(
  /для роли Лид[^\n]*`LEAD\.md`/.test(project) && /для роли Интегратор[^\n]*`REVIEW\.md`/.test(project),
  "PROJECT.md must route both roles to their contracts",
);

hasAll(
  lead,
  [
    "<!-- audience: lead-chat -->",
    "постоянного ChatGPT-чата **Лид**",
    "проверь все PR",
    "Fast lane — режим по умолчанию",
    "Strict lane — только по реальному риску",
    "одна задача",
    "одна ветка",
    "один финальный PR",
    "fetch_file",
    "Полный clone допустим только",
    "Integration metadata",
    "Depends on",
    "Merge phase",
    "Owned paths",
    "Shared files allowed",
    "Fan-out/fan-in используется только при реальном конфликте",
  ],
  "LEAD.md",
);
assert(
  lead.includes("Не требуется автоматически включать:") && lead.includes("Batch/Task ID"),
  "LEAD.md must keep routine fast-lane metadata optional",
);

hasAll(
  review,
  [
    "<!-- audience: integrator-chat -->",
    "постоянного ChatGPT-чата **Интегратор**",
    "проверь все PR",
    "всем открытым non-draft PR",
    "Fast lane — по умолчанию",
    "Strict lane — только по реальному риску",
    "targeted reads и per-file patches",
    "final-head CI",
    "Независимый PR не обязан ребейзиться",
    "api_tool.list_resources",
    "Побочный вопрос пользователя не отменяет активную операцию",
  ],
  "REVIEW.md",
);
assert(
  review.includes("Отсутствие полной Integration metadata в обычном самостоятельном PR не является дефектом"),
  "REVIEW.md must not make strict metadata mandatory for routine PRs",
);

hasAll(
  agents,
  [
    "<!-- audience: codex -->",
    "Do **not** read `PROJECT.md`, `LEAD.md`, `REVIEW.md` or `LIBRARY.md` by default.",
    "## Task entry modes",
    "### Routine direct prompt",
    "## Integration metadata",
    "When these fields are present:",
    "Batch",
    "Base SHA",
    "Depends on",
    "Merge phase",
    "Owned paths",
    "Shared files allowed",
  ],
  "AGENTS.md",
);
assert(!agents.includes("Read `PROJECT.md`, `LIBRARY.md`"), "AGENTS.md must not restore blanket context loading");

hasAll(
  library,
  [
    "<!-- audience: optional-map -->",
    "Этот файл не является обязательным входом для Лида, Интегратора или Codex.",
    "### `LEAD.md`",
    "### `REVIEW.md`",
    "проверь все PR",
  ],
  "LIBRARY.md",
);

hasAll(
  taskTemplate,
  ["Optional only when genuinely needed:", "Integration metadata", "Depends on", "Owned paths", "Shared files allowed"],
  "tasks/TEMPLATE.md",
);

hasAll(
  prTemplate,
  [
    "# Integration metadata",
    "Batch",
    "Base SHA",
    "Depends on",
    "Merge phase",
    "Owned paths",
    "Shared files touched",
    "Canonical documentation owned by this change is current",
  ],
  ".github/pull_request_template.md",
);

console.log("documentation contracts passed: risk-based Project, Lead, Integrator and Codex roles are aligned");
