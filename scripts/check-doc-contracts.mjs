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
    "api_tool.list_resources",
    "Полное ревью не должно блокировать чат Лида",
  ],
  "PROJECT.md",
);
assert(
  /для роли Лид[^\n]*`LEAD\.md`/.test(project) && /для роли Интегратор[^\n]*`REVIEW\.md`/.test(project),
  "PROJECT.md must route both roles to their contracts",
);
assert(
  /описания функции[^\n]*не является ограничением среды/.test(project),
  "PROJECT.md must reject false tool-unavailability claims",
);

hasAll(
  lead,
  [
    "<!-- audience: lead-chat -->",
    "постоянного ChatGPT-чата **Лид**",
    "проверь все PR",
    "NB-YYYYMMDD-NN",
    "Depends on",
    "Merge phase",
    "Owned paths",
    "Shared files",
    "fan-out / fan-in",
    "Пользователь не обязан управлять партиями, идентификаторами или зависимостями",
  ],
  "LEAD.md",
);

hasAll(
  review,
  [
    "<!-- audience: integrator-chat -->",
    "постоянного ChatGPT-чата **Интегратор**",
    "проверь все PR",
    "всем открытым non-draft PR",
    "dependency graph",
    "merge order",
    "legacy PR",
    "после каждого merge синхронизирует зависимые ветки",
    "api_tool.list_resources",
    "fetch_pr_patch",
    "Побочный вопрос пользователя в Integrator-чате не отменяет активную операцию",
  ],
  "REVIEW.md",
);

hasAll(
  agents,
  [
    "<!-- audience: codex -->",
    "Do **not** read `PROJECT.md`, `LEAD.md`, `REVIEW.md` or `LIBRARY.md` by default.",
    "## Integration metadata",
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

console.log("documentation contracts passed: project bootstrap, Lead, Integrator and Codex roles are separated");