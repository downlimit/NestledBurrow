import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const project = read("PROJECT.md");
const agents = read("AGENTS.md");
const review = read("REVIEW.md");
const library = read("LIBRARY.md");
const taskTemplate = read("tasks/TEMPLATE.md");
const prTemplate = read(".github/pull_request_template.md");

assert(project.includes("<!-- audience: main-chat -->"), "PROJECT.md must be marked as main-chat context");
assert(agents.includes("<!-- audience: codex -->"), "AGENTS.md must be marked as Codex context");
assert(
  review.includes("<!-- audience: main-chat-review -->"),
  "REVIEW.md must be marked as main-chat review context",
);
assert(library.includes("<!-- audience: optional-map -->"), "LIBRARY.md must be marked as optional routing context");

assert(
  project.includes("В репозитории downlimit/NestledBurrow прочитай PROJECT.md."),
  "PROJECT.md must preserve the canonical new-chat recovery prompt",
);
assert(
  project.includes("Не следует автоматически добавлять в ключ `PROJECT.md`, `REVIEW.md` или `LIBRARY.md`."),
  "PROJECT.md must keep routine Codex prompts free of lead-only context",
);
assert(
  project.includes("## Операционный запуск нового чата"),
  "PROJECT.md must turn PR requests into immediate operational work",
);
assert(
  project.includes("`api_tool.list_resources`"),
  "PROJECT.md must define dynamic GitHub tool discovery for new chats",
);
assert(
  project.includes("Наличие описания функции без уже загруженной схемы **не является ограничением среды**."),
  "PROJECT.md must reject false tool-unavailability claims",
);

assert(
  agents.includes("Do **not** read `PROJECT.md`, `REVIEW.md` or `LIBRARY.md` by default."),
  "AGENTS.md must explicitly reject mandatory lead-context loading",
);
assert(
  !agents.includes("Read `PROJECT.md`, `LIBRARY.md`"),
  "AGENTS.md reintroduced the obsolete mandatory PROJECT/LIBRARY read",
);
assert(
  !agents.includes("Read `REVIEW.md` before preparing the pull request"),
  "AGENTS.md reintroduced mandatory reviewer-context loading",
);

assert(
  library.includes("Этот файл не является обязательным входом ни для основного чата, ни для Codex."),
  "LIBRARY.md must remain optional",
);
assert(
  review.includes("The user must never need to request routine Markdown maintenance."),
  "REVIEW.md must assign documentation drift ownership to the main chat",
);
assert(
  review.includes("## 1. Operational trigger"),
  "REVIEW.md must require execution instead of plan-only PR responses",
);
assert(
  review.includes("Do not claim `fetch_pr_patch` or another described action is unavailable"),
  "REVIEW.md must require actual tool discovery before reporting a blocker",
);
assert(
  review.includes("A side question during active review does not cancel the operation"),
  "REVIEW.md must preserve active work across user interruptions",
);
assert(
  taskTemplate.includes("Optional only when genuinely needed:"),
  "Durable task template must distinguish optional context",
);
assert(
  !taskTemplate.includes("- `PROJECT.md`\n- `LIBRARY.md`\n- `REVIEW.md`"),
  "Durable task template reintroduced blanket lead-context reading",
);
assert(
  prTemplate.includes("Canonical documentation owned by this change is current"),
  "PR template must retain documentation drift confirmation",
);

console.log("documentation contracts passed");
