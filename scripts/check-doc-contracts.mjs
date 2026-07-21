import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const project = read("PROJECT.md");
const lead = read("LEAD.md");
const agents = read("AGENTS.md");
const review = read("REVIEW.md");
const library = read("LIBRARY.md");
const taskTemplate = read("tasks/TEMPLATE.md");
const prTemplate = read(".github/pull_request_template.md");

assert(
  project.includes("<!-- audience: project-bootstrap -->"),
  "PROJECT.md must be marked as the shared project bootstrap",
);
assert(lead.includes("<!-- audience: lead-chat -->"), "LEAD.md must be marked as Lead context");
assert(agents.includes("<!-- audience: codex -->"), "AGENTS.md must be marked as Codex context");
assert(
  review.includes("<!-- audience: integrator-chat -->"),
  "REVIEW.md must be marked as Integrator context",
);
assert(library.includes("<!-- audience: optional-map -->"), "LIBRARY.md must remain optional routing context");

assert(project.includes("привет, ты лид"), "PROJECT.md must preserve the one-line Lead recovery phrase");
assert(
  project.includes("привет, ты интегратор"),
  "PROJECT.md must preserve the one-line Integrator recovery phrase",
);
assert(
  project.includes("проверь все PR"),
  "PROJECT.md must define one-command processing of all open PRs",
);
assert(
  project.includes("прочитать `PROJECT.md`") &&
    project.includes("для роли Лид прочитать `LEAD.md`") &&
    project.includes("для роли Интегратор прочитать `REVIEW.md`"),
  "PROJECT.md must route new chats to their role contracts",
);
assert(
  project.includes("`api_tool.list_resources`"),
  "PROJECT.md must define dynamic GitHub tool discovery",
);
assert(
  project.includes("Наличие описания функции без загруженной схемы не является ограничением среды."),
  "PROJECT.md must reject false tool-unavailability claims",
);
assert(
  project.includes("Полное ревью не должно блокировать чат Лида."),
  "PROJECT.md must preserve Lead availability during integration",
);

assert(
  lead.includes("постоянного ChatGPT-чата **Лид**"),
  "LEAD.md must define a persistent Lead role",
);
assert(
  lead.includes("проверь все PR"),
  "LEAD.md must hand the complete PR queue to the Integrator with one command",
);
assert(
  lead.includes("Batch: `NB-YYYYMMDD-NN`") &&
    lead.includes("Depends on") &&
    lead.includes("Merge phase") &&
    lead.includes("Owned paths") &&
    lead.includes("Shared files"),
  "LEAD.md must define parallel integration metadata",
);
assert(
  lead.includes("Пользователь не обязан управлять партиями, идентификаторами или зависимостями."),
  "LEAD.md must keep integration bookkeeping away from the user",
);
assert(
  lead.includes("fan-out / fan-in"),
  "LEAD.md must define the parallel isolation and integration pattern",
);

assert(
  review.includes("полный проход по всем открытым non-draft PR"),
  "REVIEW.md must define all-open-PR processing",
);
assert(
  review.includes("строит dependency graph и merge order"),
  "REVIEW.md must require dependency-aware integration",
);
assert(
  review.includes("Отсутствие или ошибка metadata в legacy PR не являются причиной"),
  "REVIEW.md must handle legacy PRs without user bookkeeping",
);
assert(
  review.includes("после каждого merge синхронизирует зависимые ветки"),
  "REVIEW.md must revalidate dependent branches after each merge",
);
assert(
  review.includes("Нельзя заявлять, что `fetch_pr_patch`"),
  "REVIEW.md must require actual tool discovery before reporting a blocker",
);
assert(
  review.includes("Побочный вопрос пользователя в Integrator-чате не отменяет активную операцию"),
  "REVIEW.md must preserve active work across side questions",
);

assert(
  agents.includes("Do **not** read `PROJECT.md`, `LEAD.md`, `REVIEW.md` or `LIBRARY.md` by default."),
  "AGENTS.md must keep Codex free of Lead and Integrator context by default",
);
assert(
  agents.includes("## Integration metadata") &&
    agents.includes("Shared files allowed") &&
    agents.includes("Owned paths"),
  "AGENTS.md must enforce integration metadata and file ownership",
);
assert(
  !agents.includes("Read `PROJECT.md`, `LIBRARY.md`"),
  "AGENTS.md reintroduced blanket lead-context loading",
);

assert(
  library.includes("### `LEAD.md`") && library.includes("### `REVIEW.md`"),
  "LIBRARY.md must map both persistent chat roles",
);
assert(
  library.includes("Этот файл не является обязательным входом для Лида, Интегратора или Codex."),
  "LIBRARY.md must remain optional",
);

assert(
  taskTemplate.includes("Optional only when genuinely needed:"),
  "Durable task template must distinguish optional context",
);
assert(
  taskTemplate.includes("Integration metadata") && taskTemplate.includes("Shared files allowed"),
  "Durable task template must carry dependency and ownership metadata",
);

assert(
  prTemplate.includes("# Integration metadata"),
  "PR template must expose machine-readable integration metadata",
);
assert(
  prTemplate.includes("Depends on") &&
    prTemplate.includes("Merge phase") &&
    prTemplate.includes("Owned paths") &&
    prTemplate.includes("Shared files touched"),
  "PR template must provide dependency and ownership fields",
);
assert(
  prTemplate.includes("Canonical documentation owned by this change is current"),
  "PR template must retain documentation drift confirmation",
);

console.log("documentation contracts passed: project bootstrap, Lead, Integrator and Codex roles are separated");