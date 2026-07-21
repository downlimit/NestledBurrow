import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, content) => writeFileSync(path, content, "utf8");
const replaceExact = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Missing documentation anchor: ${label}`);
  return text.replace(from, to);
};

let project = read("PROJECT.md");
project = replaceExact(
  project,
  `- \`GameSessionState\` хранит JSON-сериализуемые player/NPC entities, flags и состояние диалога без Phaser/runtime references.
- Первый interaction/dialogue vertical slice работает в runtime: у домашнего NPC появляется \`TALK\`, а \`E\`, \`SPACE\` или мобильный tap запускают и пролистывают трёхстрочный диалог.
- Interaction targets строятся из свежих \`CharacterSystem\` snapshots; во время разговора блокируется movement input игрока и приостанавливается только выбранный NPC.
- Завершение разговора записывает entity flag \`greeted\`.
- \`InteractionHud\` рисует prompt и dialogue panel в Phaser и отделяет touch interaction от мобильного джойстика.
- Клавиатура и динамический мобильный джойстик объединяются в единый нормализованный movement vector.
- \`MobileJoystick\` владеет pointer lifecycle, capture/fallback, safety reset, графикой и cleanup.
- \`MovementDebugPanel\` владеет tuning UI, persistence, status и cleanup; \`WorldScene\` остаётся composition root.
- Камера следует за игроком с целочисленным pixel-grid рендером; Phaser HUD содержит build label и fullscreen.`,
  `- \`GameSessionState\` хранит JSON-сериализуемые player/NPC entities, durable flags и transient dialogue state без Phaser/runtime references.
- Версионированный save envelope сохраняет только устойчивый прогресс, безопасно восстанавливается после повреждённого/неподдерживаемого save и не смешивает язык с игровым состоянием.
- Первый законченный мини-квест связывает домашнего и уличного NPC: поручение, ответ, возвращение и repeat-реплики определяются стабильными dialogue/flag IDs.
- Interaction targets строятся из свежих \`CharacterSystem\` snapshots; во время разговора блокируется movement input игрока и приостанавливается только выбранный NPC.
- EN/RU локализация построена на i18next, ICU namespaces и локально поставляемом Rubik с проверенным Latin/Cyrillic coverage; язык меняет уже видимые HUD/dialogue строки.
- \`GameHud\` владеет build label, fullscreen, language toggle и локализованным \`NEW GAME\`; сброс удаляет quest progress, но сохраняет языковую preference.
- \`InteractionHud\` рисует Unicode prompt/dialogue panel и отделяет touch interaction от мобильного джойстика.
- Клавиатура и динамический мобильный джойстик объединяются в единый нормализованный movement vector; desktop/mobile Chromium E2E покрывает язык, quest flow, reload persistence и reset.
- \`MobileJoystick\` и \`MovementDebugPanel\` сохраняют самостоятельное lifecycle ownership; \`WorldScene\` остаётся composition root.
- Камера следует за игроком с целочисленным pixel-grid рендером; GitHub Pages публикует только проверенный \`main\`.`,
  "published state",
);
write("PROJECT.md", project);

let architecture = read("ARCHITECTURE.md");
architecture = replaceExact(
  architecture,
  `17. Villager получил прогулочную скорость, waypoint waits и естественные multi-point маршруты.

Visual repair с проверенным cadence, neutral idle и разными NPC skins не считается опубликованным до фактического merge и runtime inspection.`,
  `17. Villager получил прогулочную скорость, waypoint waits и естественные multi-point маршруты.
18. Visual repair закрепил four-phase cadence и явный возврат в neutral idle frame.
19. Введены i18next localization service, EN/RU namespaces, Unicode Rubik и \`GameHud\`.
20. Введены pure neighbor quest domain и versioned session persistence.
21. Fan-in подключил локализованный playable quest, auto-save/load и \`NEW GAME\`, сохраняющий язык.
22. Desktop/mobile Playwright проверяет language lifecycle, полный quest flow, reload persistence, reset и touch dialogue start.

Visual repair, localization/progress fan-out и playable fan-in опубликованы как законченная функциональная волна.`,
  "realized steps",
);
architecture = replaceExact(
  architecture,
  `### Следующая безопасная волна после visual repair

1. Параллельно:
   - localization platform + Unicode text + \`GameHud\`;
   - pure mini-quest/progress domain + versioned persistence.
2. Fan-in:
   - локализованный playable mini-quest;
   - auto-save/load;
   - \`NEW GAME\`, сохраняющий язык;
   - desktop/mobile Playwright evidence.
3. Обновить каноническую документацию в том же integration PR, без отдельного DOC PR.

### После этой волны

1. Interaction с объектом, отличным от NPC.
2. Zones/triggers и переход между двумя пространствами.
3. Разделение world definition/runtime/renderer по фактической потребности.
4. Новые behavior states и route recovery по реальному контенту.
5. Новые actor/visual types по игровой роли.`,
  `### Следующая безопасная волна

1. Interaction с объектом, отличным от NPC.
2. Zones/triggers и переход между двумя пространствами.
3. Разделение world definition/runtime/renderer по фактической потребности переходов.
4. Новые behavior states и route recovery по реальному контенту.
5. Новые actor/visual types только по появившейся игровой роли.`,
  "priority queue",
);
architecture = replaceExact(
  architecture,
  `Movement/collision core, actor profiles, \`CharacterSystem\`, session state, interaction targeting, первый dialogue slice и прогулочное поведение NPC реализованы. Следующий шаг после фактического visual repair — крупная localization/progress wave с одним playable fan-in, persistence и browser-level evidence.`,
  `Movement/collision core, actor profiles, \`CharacterSystem\`, локализованный interaction/dialogue runtime, neighbor mini-quest, versioned persistence, \`GameHud\`, \`NEW GAME\` и desktop/mobile browser evidence реализованы. Следующий продуктовый шаг — interaction с не-NPC объектом и zones/transitions между пространствами.`,
  "implementation status",
);
write("ARCHITECTURE.md", architecture);

let library = read("LIBRARY.md");
library = replaceExact(
  library,
  `Phaser composition root непрерывного мира: создаёт layout, \`CharacterSystem\`, персонажей по actor profiles, \`GameSessionState\`, \`InteractionHud\` и \`InteractionRuntime\`; связывает keyboard/mobile actions, \`MobileJoystick\`, \`MovementDebugPanel\`, камеру, fullscreen и screen-space HUD; вызывает system/runtime update и уничтожает runtime-компоненты.`,
  `Phaser composition root непрерывного мира: создаёт layout, \`CharacterSystem\`, локализованный \`GameHud\`/\`InteractionHud\`, загружает versioned session через persistence и связывает neighbor quest resolver/effects с \`InteractionRuntime\`; координирует input, camera, runtime update, auto-save, \`NEW GAME\` и cleanup.`,
  "main map",
);
library = replaceExact(
  library,
  `Plain JSON-сериализуемая session-модель: version, current world, player/entity IDs, global/entity flags и dialogue state. Предоставляет создание/lookup entities, flag operations и start/advance/close dialogue без runtime ссылок. Reserved object-property IDs обрабатываются как собственные данные без prototype mutation.`,
  `Plain JSON-сериализуемая session-модель и canonical fresh/normalize boundary: version, current world, player/entity IDs, global/entity flags и transient dialogue state. Reserved object-property IDs обрабатываются как собственные данные без prototype mutation.`,
  "session map",
);
library = replaceExact(
  library,
  `### \`src/interaction.js\``,
  `### \`src/sessionPersistence.js\`

Версионированный save envelope и adapter над Storage: load/save/clear, strict validation, migration boundary, durable flags only и safe fresh-state recovery для empty/corrupt/unsupported saves.

### \`src/neighborQuest.js\`

Pure domain первого мини-квеста: stable stages, entity/dialogue/flag/resolver IDs, deterministic dialogue resolution и idempotent completion transitions.

### \`src/interaction.js\``,
  "new progress addresses",
);
library = replaceExact(
  library,
  `Неизменяемые runtime interaction definitions без статической world position. Текущая запись \`talk-home-npc\` связывает домашнего NPC, \`TALK\`, facing/radius policy и dialogue ID через JSON-like payload.`,
  `Неизменяемые runtime interaction definitions без статической world position. Home/street NPC используют общий stable quest resolver ID, локализованный \`TALK\` prompt и JSON-like payload.`,
  "interaction config map",
);
library = replaceExact(
  library,
  `Неизменяемые dialogue definitions и strict own-key lookup. Текущий \`home-npc-greeting\` содержит speaker и три строки; session хранит только dialogue ID и line index, а не текст.`,
  `Неизменяемые локализуемые definitions для всех стадий neighbor quest и strict own-key lookup. Session хранит только stable dialogue ID и line index, а presenter получает translation-key descriptors.`,
  "dialogue map",
);
library = replaceExact(
  library,
  `Phaser-agnostic coordinator первого interaction/dialogue vertical slice: получает свежие snapshots из \`CharacterSystem\`, подставляет target positions, выбирает candidate, управляет session dialogue lifecycle, вызывает presenter, выставляет completion flags и сообщает, какой NPC участвует в активном разговоре.`,
  `Phaser-agnostic coordinator локализованного quest dialogue lifecycle: получает snapshots, выбирает candidate, разрешает dialogue ID через injected resolver, применяет pure completion transition, вызывает auto-save только при persistent mutation и передаёт presenter translation-key descriptors.`,
  "runtime map",
);
library = replaceExact(
  library,
  `Phaser presenter boundary для \`TALK\` prompt и нижней dialogue panel: bitmap rendering, desktop/mobile labels, latched tap action, pointer propagation guard, повторное использование graphics/zones, полная HUD exclusion область для mobile joystick и idempotent cleanup.`,
  `Phaser Unicode presenter boundary для локализованных \`TALK\` prompt и dialogue panel: locale font, live language redraw, latched mobile tap, pointer guard, полная joystick exclusion и idempotent cleanup.`,
  "interaction hud map",
);
library = replaceExact(
  library,
  `### \`src/input.js\``,
  `### \`src/gameHud.js\`

Единый владелец screen-space build/fullscreen/language/\`NEW GAME\` UI: locale-aware Phaser Text, confirmation lifecycle, hit-area exclusion, language preference preservation и cleanup.

### \`src/localization/index.js\`

Framework-independent i18next application service: browser locale detection, EN fallback, namespace loading, ICU, separate language persistence, \`html lang/dir\` sync, subscriptions и lifecycle destroy.

### \`public/locales/{en,ru}\`

Канонические JSON resources \`common\`, \`hud\`, \`dialogue\` с semantic keys и namespace parity.

### \`src/input.js\``,
  "hud localization addresses",
);
library = replaceExact(
  library,
  `### \`scripts/check-movement.mjs\``,
  `### \`scripts/check-progress.mjs\`

Pure checks neighbor quest stages/transitions и versioned persistence load/save/clear/recovery behavior.

### \`scripts/check-localization.mjs\`

Namespace/key parity, non-empty translations, ICU samples, locale normalization, bundled Rubik/OFL presence и exact font SHA-256.

### \`playwright.config.js\` и \`tests/e2e/localized-loop.spec.js\`

Desktop/mobile Chromium evidence для locale detection/persistence, полного quest flow, reload save, localized \`NEW GAME\` и mobile touch dialogue start.

### \`scripts/check-movement.mjs\``,
  "test addresses",
);
write("LIBRARY.md", library);

console.log("fan-in canonical documentation updated");
