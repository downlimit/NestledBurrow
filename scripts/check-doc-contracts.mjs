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
const prWorkflow = read(".github/workflows/pr-check.yml");

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
    "## Fast lane",
    "Fast lane используется по умолчанию",
    "## Strict lane",
    "Strict lane используется только при реальном риске",
    "одна самодостаточная задача Codex",
    "одна ветка",
    "один финальный PR",
    "Прочитай AGENTS.md и только релевантные файлы проекта.",
    "Binary delivery path",
    "Base SHA",
    "Depends on",
    "Merge phase",
    "## Выбор между одной задачей, волной и последовательностью",
    "### Настоящая параллельная волна",
    "реально сокращать критический календарный путь",
  ],
  "LEAD.md",
);
assert(
  lead.includes("Не добавлять автоматически Batch ID") && lead.includes("огромные owned-path списки"),
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
    "### Достаточность и темп",
    "Не делать серию одинаковых polling-вызовов",
    "Нулевая неопределённость не требуется",
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
    "## Creative fast lane",
    "use one ephemeral branch and one final PR",
    "targeted checks",
    "PR CI run the canonical full repository suite",
    "## Integration metadata is optional",
    "Routine independent work does not require Batch",
    "copy the metadata into the PR body, never into `.github/pull_request_template.md`",
    "## Risk-based validation",
    "### Fast lane",
    "### Strict lane",
    "Commit on the task branch as often as useful",
    "same applicable validation path that CI will enforce",
    "run the complete updated chain locally",
    "determine whether the same command already fails on the base/current `main` or only on the PR head",
    "A pre-existing base failure is repaired as a base-contract defect",
    "Do not rerun an unchanged deterministic failure",
    "Include Integration metadata only when the prompt supplied it",
  ],
  "AGENTS.md",
);
assert(!agents.includes("Read `PROJECT.md`, `LIBRARY.md`"), "AGENTS.md must not restore blanket context loading");
assert(
  !agents.includes("Always identify:\n\n- review class and concise scope;\n- Integration metadata"),
  "AGENTS.md must not require strict metadata in every completion report",
);

hasAll(
  prWorkflow,
  [
    "types:",
    "synchronize",
    "ready_for_review",
    "cancel-in-progress: true",
    "if: github.event.pull_request.draft == false",
  ],
  ".github/workflows/pr-check.yml",
);

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
    "Fast lane is the default",
    "# Scope",
    "# Review class",
    "## Git lifecycle",
    "Work branch:",
    "Final head SHA:",
    "## Validation",
    "PR CI supplies the canonical full repository suite",
    "## Integration metadata (optional)",
    "Routine independent PRs delete this section",
    "ready for Integrator review and merge",
  ],
  ".github/pull_request_template.md",
);
assert(!prTemplate.includes("Required for implementation PRs"), "PR template must not require strict metadata for routine work");
assert(!prTemplate.includes("strict Integrator review"), "PR template must not classify every PR as strict");

console.log("documentation contracts passed: structural workflow invariants and CI-parity preflight are enforced");
