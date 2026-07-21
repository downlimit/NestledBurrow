<!-- audience: lead-chat -->
# Архитектура NestledBurrow

## Назначение

`ARCHITECTURE.md` — канонический долгоживущий адрес для оценки runtime-архитектуры, принятых направлений её развития и очереди архитектурных улучшений.

Документ предназначен прежде всего для Lead-чата. Он описывает подтверждённое направление, но не выдаёт запланированную работу за уже опубликованную реализацию. Фактическое состояние всегда проверяется по `main`, исходникам и `PROJECT.md`.

## Базовая оценка

Текущая архитектура соответствует стадии раннего игрового прототипа и не требует полной перестройки.

Устойчивые границы:

- чистая velocity-based математика движения отделена от Phaser;
- параметры движения задаются именованными actor profiles;
- collision resolver получает явный environment contract;
- `CharacterMotor` владеет movement/controller/collision без Phaser;
- `CharacterVisual` владеет sprite/facing/animation/depth;
- `CharacterSystem` предоставляет stable-ID registry, ordered update и runtime-free snapshots;
- player и patrol controllers используют общий `ControllerCommand`;
- NPC spawn и patrol-маршруты задаются декларативно;
- `GameSessionState` сериализуется в JSON и не содержит runtime-ссылок;
- interaction targeting является чистой детерминированной функцией;
- `InteractionRuntime` связывает snapshots, session operations и presenter;
- `InteractionHud` изолирует Phaser-представление диалога и mobile tap lifecycle;
- `MobileJoystick` и `MovementDebugPanel` имеют самостоятельное lifecycle ownership.

Существующий movement core следует расширять эволюционно.

## Главный архитектурный риск

`WorldScene` остаётся composition root и всё ещё координирует:

- preload и world rendering;
- создание runtime-систем;
- keyboard/action sampling;
- camera follow и integer zoom;
- fullscreen;
- screen-space HUD;
- browser lifecycle listeners и cleanup.

При текущем масштабе это допустимо. Language switching, fullscreen и будущий `NEW GAME` создают реальную причину выделить компактный `GameHud`, но не универсальный UI framework.

## Принятые архитектурные направления

### 1. Общая команда персонажа

Контроллер возвращает:

```js
{
  moveDirection: { x, y },
  aimDirection: { x, y } | null,
  actions: {
    interact: false,
    primary: false,
    secondary: false,
  },
}
```

Контроллер получает изолированный snapshot вместо mutable `Character`. Locomotion, orientation, aim и действия не смешиваются.

### 2. Разгрузка `WorldScene`

Уже выделены:

- `MobileJoystick`;
- `MovementDebugPanel`;
- `CharacterSystem`;
- `InteractionRuntime`;
- `InteractionHud`.

Следующая оправданная граница:

- `GameHud` — build label, fullscreen, language control, будущий `NEW GAME`, общие screen-space hit areas и cleanup.

`WorldScene` создаёт системы и связывает зависимости, но не становится владельцем их внутренней логики.

### 3. Actor profiles и визуалы

Player и villager используют явные immutable profiles. Movement и visual data разделены.

- NPC используют прогулочный movement profile примерно с третью скорости игрока;
- разные персонажи могут иметь разные visual profiles при общем movement profile;
- animation prefixes должны исключать конфликт Phaser animations;
- preload собирает texture keys из реально используемых visual profiles;
- visual diversity не должна дублировать movement/collision configuration.

Будущие `guard`, `meleeEnemy` и `rangedEnemy` расширяют тот же контракт только при появлении соответствующей роли.

### 4. Locomotion, orientation и animation

Семантика:

- `moveDirection` — команда перемещения;
- `velocity` — фактическое движение;
- `facingDirection` — continuous ориентация;
- `aimDirection` — направление целевой системы;
- cardinal facing принадлежит visual layer.

Walk animation использует явно проверенную последовательность:

```text
step A → neutral → step B → neutral
```

После прекращения движения sprite обязан явно перейти в neutral frame текущего facing независимо от последней фазы animation.

Назначение source frames подтверждается визуально по PNG, а не выводится из имени или числового порядка файла.

### 5. Collision environment

Collision functions получают:

```js
{
  bounds: { left, top, right, bottom },
  cellSize,
  isBlockedCell(x, y),
}
```

Текущий axis-separated substep resolver сохраняется, пока dash, knockback или быстрые сущности не докажут необходимость замены.

### 6. Character aggregate

- `CharacterMotor` хранит position, movement state/config, controller, collision footprint и blocked axes;
- `CharacterVisual` хранит Phaser sprite, facing, animation и depth;
- `Character` связывает motor и visual;
- `CharacterSystem` управляет registry и update.

HP, quests, inventory, save logic и dialogue state не добавляются в motor или visual.

### 7. World definition/runtime/renderer

По мере появления переходов мир разделяется на:

- `WorldDefinition` — layers, markers, spawn, collisions, zones;
- `WorldRuntime` — collision queries, triggers и entity registry;
- `WorldRenderer` — Phaser representation и depth.

Tiled или LDtk вводятся только после подтверждённой проблемы ручного авторинга.

### 8. Session state и persistence

`GameSessionState` хранит version, current world, player/entity IDs, flags и dialogue progress. Он не хранит Phaser objects, functions, Maps/Sets или frame-level positions без подтверждённой необходимости.

Persistence вводится вместе с первым содержательным мини-квестом:

- versioned save envelope;
- strict validation;
- явные migrations;
- safe fallback при повреждённом или неизвестном save;
- сохранение только устойчивого прогресса;
- `NEW GAME` создаёт чистое session state и удаляет progress save;
- язык и другие presentation preferences не входят в `GameSessionState` и переживают `NEW GAME`.

### 9. Interaction и dialogue runtime

Interaction descriptor является immutable JSON-like data с stable ID, entity ID, kind, radius, priority, facing policy и payload.

`InteractionRuntime`:

- получает свежие snapshots;
- выбирает доступную цель;
- запускает и продвигает dialogue;
- применяет декларативные completion effects;
- сообщает controllers об active dialogue entity;
- не хранит Phaser objects.

User-facing текст не хранится в session state. Session хранит только stable dialogue/content IDs и progress indices.

Первый содержательный slice:

1. home NPC выдаёт поручение;
2. street NPC отвечает;
3. session flags меняют доступные реплики;
4. возвращение к home NPC завершает поручение;
5. после завершения оба NPC имеют короткие repeat-реплики.

До второго содержательно отличающегося паттерна отдельная универсальная quest system не вводится.

### 10. Patrol behavior

Waypoint поддерживает optional `waitMs`:

- смысловые точки ждут примерно 2000–3000 ms;
- pass-through точки используют `waitMs: 0`;
- dialogue pause замораживает движение, wait timer и blocked timer;
- blocked fallback не изображает успешное достижение точки.

Route validation и blocked recovery добавляются раньше pathfinding. A* не вводится без реальной необходимости.

### 11. Локализация

Локализация является отдельным framework-agnostic application service, а Phaser отвечает только за presentation.

Принятый стек:

- `i18next` — orchestration, locale fallback, namespaces и resource lifecycle;
- `i18next-browser-languagedetector` — browser detection и отдельное сохранение language preference;
- `i18next-icu` — ICU MessageFormat для plural/select/interpolation;
- официальный `i18next-cli` — extraction, lint, locale sync и status;
- JSON resources по locale и namespace;
- Phaser `Text` с локально поставляемыми Unicode fonts для пользовательского текста.

Правила:

- stable semantic keys вместо английских фраз как ключей;
- namespaces минимум `common`, `hud`, `dialogue`, позднее `quest`;
- полный переводимый message хранится единым ICU message, без concatenation из фрагментов;
- supported locales задаются registry с BCP-47 code, display label, direction и font key;
- начальный язык: сохранённая preference → browser locale → fallback `en`;
- preference хранится отдельно от progress save;
- language change обновляет уже видимый HUD/dialogue без перезапуска сцены;
- `document.documentElement.lang` и `dir` синхронизируются с выбранной locale;
- missing key, missing locale entry, invalid ICU message и пустой перевод являются validation failure;
- production не показывает пустую строку; fallback идёт в `en`, а development делает defect заметным;
- runtime/gameplay data хранит translation keys, а не готовый локализованный текст;
- локализация не зависит от Phaser и тестируется в Node;
- cloud TMS/backend не вводится сейчас, но resource layout должен позволять подключить его без переписывания callers.

Для `en` и `ru` используется локально bundled OFL/Apache/CC0 font с проверенным Latin/Cyrillic coverage. Locale registry допускает отдельные font packs для будущих writing systems.

Ручное расширение самодельного 5×7 glyph map не является основным путём многоязычного текста. Pixel graphics/icons могут остаться кастомными, а пользовательские строки должны использовать Unicode-capable text rendering.

### 12. HUD presentation

`GameHud` владеет:

- build label;
- fullscreen;
- language toggle;
- будущим `NEW GAME`;
- объединёнными HUD hit areas;
- cleanup.

Localized labels не полагаются на fixed English widths. Layout измеряет фактический текст, поддерживает wrapping, safe margins и mobile tap areas.

Phaser `Text` обновляется только при изменении UI/content state или языка, не каждый frame.

### 13. Browser-level проверки

После появления localization, touch HUD, persistence и mini-quest browser-level risk достаточен для Playwright.

Playwright должен проверять:

- desktop keyboard lifecycle;
- coarse/touch pointer lifecycle;
- locale detection и language switching;
- fullscreen/resize coexistence;
- полный quest flow;
- reload persistence;
- `NEW GAME` с сохранением language preference;
- отсутствие console/page errors.

Используются отдельные desktop и mobile projects с locale/touch/device emulation. Screenshot artifacts полезны для review; хрупкие pixel-diff baselines не вводятся без стабильной rendering environment.

Unit/contract tests остаются основным доказательством pure logic.

## Реализованные шаги

1. Введён `ControllerCommand`.
2. Player и patrol controllers переведены на общий contract.
3. Выделен `MobileJoystick`.
4. Выделен `MovementDebugPanel`.
5. Runtime-компоненты подключены через composition root.
6. Введены actor profiles `player` и `villager`.
7. Collision resolver переведён на environment contract.
8. Удалены legacy room sources; Basic Village является активным environment.
9. `Character` разделён на `CharacterMotor` и `CharacterVisual`.
10. Введён `CharacterSystem`.
11. Введён JSON-сериализуемый `GameSessionState`.
12. Введены immutable interaction descriptors и pure targeting.
13. Session state подключён к composition root.
14. Реализован первый `TALK` → three-line dialogue lifecycle.
15. Введены `InteractionRuntime` и `InteractionHud`.
16. HUD exclusion покрывает dialogue panel.
17. Villager получил прогулочную скорость, waypoint waits и естественные multi-point маршруты.

Visual repair с проверенным cadence, neutral idle и разными NPC skins не считается опубликованным до фактического merge и runtime inspection.

## Приоритетная очередь

### Следующая безопасная волна после visual repair

1. Параллельно:
   - localization platform + Unicode text + `GameHud`;
   - pure mini-quest/progress domain + versioned persistence.
2. Fan-in:
   - локализованный playable mini-quest;
   - auto-save/load;
   - `NEW GAME`, сохраняющий язык;
   - desktop/mobile Playwright evidence.
3. Обновить каноническую документацию в том же integration PR, без отдельного DOC PR.

### После этой волны

1. Interaction с объектом, отличным от NPC.
2. Zones/triggers и переход между двумя пространствами.
3. Разделение world definition/runtime/renderer по фактической потребности.
4. Новые behavior states и route recovery по реальному контенту.
5. Новые actor/visual types по игровой роли.

## Ограничения

До подтверждённой необходимости не вводятся:

- полноценный ECS;
- глобальный event bus;
- dependency injection framework;
- массовая миграция на TypeScript;
- Phaser Physics вместо текущего movement/collision core;
- A* pathfinding;
- Tiled или LDtk;
- крупный механический перенос структуры каталогов;
- собственный самодельный localization framework;
- locale-specific `if/else` в gameplay/HUD callers;
- строковая concatenation переводимых предложений;
- cloud TMS или runtime translation service;
- универсальная quest system до второго содержательного паттерна.

Архитектура развивается законченными functional slices. Fan-out/fan-in применяется здесь потому, что localization/UI и pure progress/persistence имеют разные области владения, но сходятся в одном playable loop.

## Текущий implementation status

Movement/collision core, actor profiles, `CharacterSystem`, session state, interaction targeting, первый dialogue slice и прогулочное поведение NPC реализованы. Следующий шаг после фактического visual repair — крупная localization/progress wave с одним playable fan-in, persistence и browser-level evidence.
