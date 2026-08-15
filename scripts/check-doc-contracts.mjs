import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const requireText = (text, tokens, label) => {
  for (const token of tokens) assert(text.includes(token), `${label} must contain: ${token}`);
};

const project = read("PROJECT.md");
const lead = read("LEAD.md");
const artist = read("ARTIST.md");
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
const architecturePressureWorkflow = read(".github/workflows/architecture-pressure.yml");
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
const systemDocBudgets = new Map([
  ["systems/character-and-needs.md", 7000],
  ["systems/tavern-service.md", 20000],
]);

requireText(project, [
  "<!-- audience: project-bootstrap -->",
  "## Режимы запроса Лиду",
  "### Прямая реализация чатом",
  "AGENTS.md",
  "ARTIST.md",
  "ты художник",
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
  "Codex никогда не генерирует",
  "отдельной роли Художника",
  "code-only integration task",
  "визуальная «пиксельность» не является доказательством native asset",
  "точной native frame grid",
  "integer nearest-neighbor preview",
], "LEAD.md");

requireText(artist, [
  "<!-- audience: artist-chat -->",
  "## Intent gate",
  "### Discussion",
  "### Concept production",
  "### Native production",
  "## Обязательный контекст",
  "## Reference hierarchy",
  "Sketch is geometry source of truth",
  "### Rough sketch normalization",
  "canonical project camera wins",
  "### World stairs / ramps / bridges",
  "rough narrowing в скетче **никогда само по себе не разрешает perspective",
  "## Silent production preflight",
  "## Generator bridge — обязательный Generation brief",
  "Generation brief",
  "Do not interpret sketch taper/narrowing as camera perspective",
  "## Camera contract",
  "no perspective convergence",
  "rough-sketch narrowing не считается perspective instruction",
  "## Pixel-art style contract",
  "hard-edged color clusters",
  "failed generation",
  "TILE_SIZE",
  "src/world/worldConfig.js",
  "Image generation output is never native runtime binary",
  "## Native request means exact native binary",
  "## Native proof",
  "## Approval boundary",
  "### Final binary approval",
  "exact approved bytes",
  "repository SHA-256 == approved SHA-256",
  "public/assets/project/<owner>/",
  "NestledBurrow_<SemanticName>.png",
  "asset-inbox/incoming",
  "SHA-256",
  "code-only integration task",
], "ARTIST.md");
assert(!artist.includes("ровно 3 pseudo-pixel concept variants"), "ARTIST.md must not force every new asset through three concepts");
assert(!artist.includes("обязательным дефолтом независимо"), "ARTIST.md must not override explicit native requests with a mandatory concept route");
assert(artist.includes("не выполняется напрямую из сырого пользовательского сообщения"), "ARTIST.md must materialize repo-derived constraints before image generation");
assert(artist.includes("Запрещено самовольно добавлять перила, столбы, стены, крышу, фундамент"), "ARTIST.md must treat sketch geometry as binding rather than optional inspiration");
assert(artist.includes("Rough sketch не задаёт перспективу"), "ARTIST.md must not treat rough-sketch taper as a perspective instruction");
assert(artist.includes("глубина передаётся ритмом ступеней, overlap и map layering, а не перспективным convergence"), "ARTIST.md must keep traversable world assets out of perspective convergence");
assert(artist.includes("не показывает его как приемлемый candidate"), "ARTIST.md must reject painterly generation before presenting it as a pixel-art candidate");

requireText(agents, [
  "<!-- audience: codex -->",
  "only the system documents",
  "Do not read `PROJECT.md`",
  "Draft PR before acceptance",
  "Late Task-number collision",
  "assign the current `ROADMAP.md` next-free number without further confirmation",
  "Treat this replacement as the same publication cycle",
  "src/main.js is composition only",
  "check:architecture",
  "Fast publication after `принято`",
  "one Ready PR",
  "Codex never generates",
  "missing, mismatched or undecodable required binary is a blocker",
  "Image generation was not invoked.",
  "npm run codex:preflight",
  "npm run codex:impact",
  "npm run codex:validate",
  "nestled-burrow-delivery:v1",
  "native auto-merge through the connector",
  "Never create an empty commit.",
], "AGENTS.md");

const forbiddenImagePermission = "Codex image generation explicitly allowed";
assert(!lead.includes(forbiddenImagePermission), "LEAD.md must not contain a prompt-level Codex image-generation bypass");
assert(!artist.includes(forbiddenImagePermission), "ARTIST.md must not contain a Codex image-generation bypass");
assert(!agents.includes(forbiddenImagePermission), "AGENTS.md must not contain a prompt-level Codex image-generation bypass");
assert(!taskTemplate.includes(forbiddenImagePermission), "tasks/TEMPLATE.md must not contain a prompt-level Codex image-generation bypass");

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
  assert(text.length <= (systemDocBudgets.get(path) ?? 5000), `${path} exceeds focused system-doc budget`);
  assert(library.includes(path), `LIBRARY.md must route to ${path}`);
}

requireText(library, [
  "<!-- audience: context-router -->",
  "Обычная задача читает один system-документ",
  "## Маршруты",
  "## Межсистемные задачи",
  "Художник: `PROJECT.md` + `ARTIST.md`",
  "public/assets/project/",
], "LIBRARY.md");

requireText(architecture, [
  "src/main.js",
  "жёсткий предел",
  "1300",
  "WorldBuildCoordinator",
  "WorldInteractionCoordinator",
  "WorldLocationRuntime",
  "WorldPresentationRuntime",
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
requireText(taskTemplate, [
  "## Relevant systems",
  "## Asset preflight",
  "Every required tracked binary already exists",
  "Codex integrates immutable binaries only",
  "One Ready PR",
], "tasks/TEMPLATE.md");
requireText(override, ["Existing PR repair route", "same branch and PR", "final-head CI"], "AGENTS.override.md");
requireText(prTemplate, ["nestled-burrow-delivery:v1", "executor: choose", "player-visible: choose", "preview-acceptance: choose", "auto-merge: choose", "chatgpt + pending", "# Task", "## Result", "## Validation", "PR CI supplies the full repository suite"], "PR template");

assert(prWorkflow.includes("github.event.pull_request.draft == false"), "Draft PR must defer final validation until Ready");
assert(architecturePressureWorkflow.includes("github.event.pull_request.draft == false"), "Draft PR must defer architecture gate until Ready");
assert(prWorkflow.includes("github.event.action != 'ready_for_review'"), "Ready transition must not republish an unchanged accepted preview");
assert(prWorkflow.includes("github.event.pull_request.draft == true"), "Public preview must be limited to a pre-acceptance Draft PR");
requireText(prWorkflow, ["Classify Scope", "PR_BODY", "metadata_valid", "needs: scope", "Run metadata checks"], "PR workflow");

requireText(focusedE2E, ["mkdtempSync", "tmpdir()", "PW_OUTPUT_DIR", "PW_REPORT_DIR"], "focused E2E");
requireText(managedPreview, ["tmpdir()", "task-preview.json", "smokeCanvas", "detached: true"], "managed preview");
requireText(pythonLauncher, ["NESTLEDBURROW_PYTHON", "NESTLEDBURROW_ARTIFACT_DIR", "codex-runtimes", "python_embed", "No usable Python 3 runtime was found"], "Python launcher");
requireText(packageJson, ['"codex:preflight"', '"codex:impact"', '"codex:validate"', '"delivery:timing"', '"check:task-063"', '"check:task-086"', '"check:architecture": "node scripts/check-architecture-boundaries.mjs"'], "package.json");

for (const [label, text, limit] of [
  ["PROJECT.md", project, 7000],
  ["LEAD.md", lead, 7500],
  ["ARTIST.md", artist, 18000],
  ["AGENTS.md", agents, 11000],
  ["REVIEW.md", review, 5000],
  ["GAME.md", game, 11000],
  ["ROADMAP.md", roadmap, 4500],
  ["LIBRARY.md", library, 7500],
]) {
  assert(text.length <= limit, `${label} exceeds context budget: ${text.length} > ${limit}`);
}

console.log("documentation contracts passed: Lead, Artist, Codex and Integrator routing, focused system context, active-only roadmap, composition-root guard and native asset delivery are enforced");
