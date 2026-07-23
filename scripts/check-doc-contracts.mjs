import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const hasAll = (text, required, label) => {
  for (const token of required) {
    assert(text.includes(token), `${label} must contain: ${token}`);
  }
};

const project = read("PROJECT.md");
const game = read("GAME.md");
const roadmap = read("ROADMAP.md");
const lead = read("LEAD.md");
const agentsOverride = read("AGENTS.override.md");
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
    "GAME.md",
    "ROADMAP.md",
    "LEAD.md",
    "REVIEW.md",
    "Fast lane используется по умолчанию",
    "Полная приёмка PR не должна блокировать Lead-чат",
  ],
  "PROJECT.md",
);

hasAll(
  game,
  [
    "<!-- audience: product-design -->",
    "продуктового вижна и фактической карты реализации",
    "### Зрелость реализации",
    "### Продуктовый verdict",
    "Отсутствует",
    "Фундамент",
    "Играбельно",
    "Интегрировано",
    "Принято",
    "Переделать",
    "Отклонено",
    "ROADMAP.md",
    "## Карта продукта: что реально существует",
    "Расчистка и присвоение заброшенного пространства",
    "Вскапывание, посадка, полив и урожай картофеля",
    "Гости, выбор продукта, потребление и оплата",
    "Миньоны из предметов и назначение работы",
  ],
  "GAME.md",
);
assert(
  game.includes("Merge и зелёный CI меняют только зрелость") &&
    game.includes("Verdict меняется только после пользовательского теста"),
  "GAME.md must separate implementation maturity from product acceptance",
);

hasAll(
  roadmap,
  [
    "<!-- audience: project-roles -->",
    "что мы делаем прямо сейчас",
    "что собираемся проверять следующим",
    "## Сейчас",
    "Первая расчистка участка",
    "## Следом",
    "Полный цикл одного картофеля",
    "Первый сервисный цикл таверны",
    "Первый миньон",
    "Base SHA не хранится здесь",
    "Завершённая работа не остаётся бесконечно висеть активной",
  ],
  "ROADMAP.md",
);

for (const [label, text] of [
  ["PROJECT.md", project],
  ["GAME.md", game],
  ["ROADMAP.md", roadmap],
  ["LEAD.md", lead],
  ["REVIEW.md", review],
]) {
  assert(!text.includes("#80"), `${label} must not depend on a magic issue number`);
  assert(!text.includes("Canonical execution ledger"), `${label} must not restore the removed issue ledger`);
}

hasAll(
  lead,
  [
    "<!-- audience: lead-chat -->",
    "одна самодостаточная задача Codex",
    "одна ветка",
    "один финальный PR",
    "Прочитай AGENTS.md и только релевантные файлы проекта.",
    "GAME.md",
    "ROADMAP.md",
    "Base SHA",
    "Fast lane",
    "Strict lane",
    "Параллельная волна допустима только",
    "BINARY_IMPORT.md",
    "Собственная Lead-задача не завершена",
  ],
  "LEAD.md",
);

hasAll(
  review,
  [
    "<!-- audience: integrator-chat -->",
    "проверь все PR",
    "всем открытым non-draft PR",
    "GAME.md",
    "ROADMAP.md",
    "## Быстрый маршрут приёмки",
    "минимальным числом GitHub-вызовов",
    "Процессные документы нельзя «улучшать по пути»",
    "Как только доказательств достаточно, остановить исследование",
    "Малый и средний PR должен обычно закрываться одним review-pass",
    "## Fast lane",
    "## Strict lane",
    "final-head CI",
    "Публикация комментария не означает запуск Codex",
    "почини PR <номер>",
    "Содержательный repair остаётся в существующей PR-ветке",
    "Интегратор не присваивает verdict",
  ],
  "REVIEW.md",
);
assert(
  review.includes("механические defects") && review.includes("Не создавать новый issue, branch или PR"),
  "REVIEW.md must keep mechanical repairs local and substantive repairs in the existing PR",
);

hasAll(
  agentsOverride,
  [
    "<!-- audience: codex -->",
    "# Root Codex command-routing override",
    "почини PR <number>",
    "fetch the named PR metadata",
    "stop without editing anything",
    "is not `main`",
    "must not",
    "invoke `make_pr`",
    "same existing PR head branch",
  ],
  "AGENTS.override.md",
);
assert(
  agentsOverride.includes("read the root `AGENTS.md`") &&
    agentsOverride.includes("never means to edit repair instructions"),
  "AGENTS.override.md must route the short repair command before any repository mutation",
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
    "### Existing PR repair task",
    "integrator-codex-repair:v1",
    "Update the existing PR branch",
    "Do not create another branch or pull request",
    "## Integration metadata is optional",
    "Routine independent work does not require Batch",
    "## Risk-based validation",
    "### Fast lane",
    "### Strict lane",
    "same applicable validation path that CI will enforce",
    "Do not rerun an unchanged deterministic failure",
  ],
  "AGENTS.md",
);
assert(!agents.includes("Read `PROJECT.md`, `LIBRARY.md`"), "AGENTS.md must not restore blanket context loading");

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

console.log("documentation contracts passed: named product map, roadmap, role recovery, fast review and exact PR-repair routing are enforced");
