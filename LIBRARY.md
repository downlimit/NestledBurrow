<!-- audience: optional-map -->
# Library: карта NestledBurrow

## Назначение

`LIBRARY.md` — необязательная карта важных адресов проекта. Она помогает найти нужную область, не читая весь репозиторий и все Markdown-файлы подряд.

Этот файл не является обязательным входом для Лида, Интегратора или Codex.

## Когда читать

- **Любой новый чат** сначала читает `PROJECT.md`.
- **Лид** затем читает `LEAD.md` и открывает `LIBRARY.md` только когда нужно найти конкретную область проекта.
- **Интегратор** затем читает `REVIEW.md` и открывает карту для адресов, затронутых очередью PR.
- **Codex** сначала читает прямой промпт и `AGENTS.md`; карта нужна только когда из промпта и структуры репозитория неясно расположение системы.
- Файл из `tasks/` читается только при прямой ссылке на него.

## Контракты документов

| Документ | Аудитория | Канонически владеет |
|---|---|---|
| `PROJECT.md` | все новые project-чаты | bootstrap, выбор роли, опубликованное состояние и устойчивые решения |
| `LEAD.md` | Lead-чат | обсуждение, архитектура задач, parallel batches и Codex prompt metadata |
| `ARCHITECTURE.md` | Lead-чат | оценка runtime-архитектуры, принятые направления и приоритетная очередь улучшений |
| `REVIEW.md` | Integrator-чат | поиск всех PR, dependency order, ревью, repair, merge, публикация и documentation drift |
| `AGENTS.md` | Codex | исполнение задачи, scope, checks, branch и delivery metadata |
| `LIBRARY.md` | роли по необходимости | карта важных адресов и назначение файлов |
| `ASSETS.md` | задачи с внешними ассетами | источники, лицензии, hashes и asset policy |
| `tasks/*.md` | только явно указанная сложная задача | долговечный task-specific контракт |

Один факт должен иметь одного канонического владельца. Другие документы ссылаются на него, а не копируют полный текст.

## Управление проектом

### `PROJECT.md`

Общий bootstrap. Новый чат читает его первым, выбирает роль по фразе пользователя и переходит к `LEAD.md` или `REVIEW.md`.

### `LEAD.md`

Контракт постоянного Лида: живое обсуждение, актуализация продуктовых решений, подготовка одиночных и параллельных Codex-задач, owned/shared paths и fan-out/fan-in.

### `ARCHITECTURE.md`

Каноническая архитектурная оценка runtime-проекта, подтверждённые направления развития, уже реализованные архитектурные шаги и оставшаяся приоритетная очередь. Лид открывает документ перед постановкой архитектурных задач и сверяет его с фактическим `main`.

### `REVIEW.md`

Контракт постоянного Интегратора. Команда `проверь все PR` запускает обработку всей открытой очереди в `main` без передачи пользователем wave, номеров PR или merge order.

### `AGENTS.md`

Единственный обязательный репозиторный документ Codex для обычной реализации. Содержит Integration metadata и границы параллельной задачи.

### `tasks/TEMPLATE.md`

Необязательный шаблон для крупных, рискованных, многоэтапных, возобновляемых или повторно используемых задач. Обычная итерация использует прямой промпт без task-файла.

### `tasks/branch-cleanup.md`

Отдельная maintenance-задача безопасного удаления старых remote-веток. Не должна запускаться как побочный эффект обычной реализации.

### `.github/pull_request_template.md`

Адаптивный отчёт финального PR: Integration metadata, review class, scope, lifecycle, применимые checks, runtime evidence, limitations и documentation drift confirmation.

### `ASSETS.md`

Канонический список внешних ассетов. Basic Village зафиксирован как основной набор окружения.

## Runtime

### `src/main.js`

Phaser composition root непрерывного мира: создаёт мир и `Character`-сущности по actor profiles, связывает клавиатуру, `MobileJoystick`, `MovementDebugPanel`, камеру, fullscreen и screen-space HUD, вызывает update и уничтожает runtime-компоненты.

### `src/actorProfiles.js`

Канонический registry неизменяемых actor profiles. Сейчас содержит стабильные ID `player` и `villager`, явные production movement/visual значения, строгий lookup и debug-only policy для синхронизации villager tuning с player debug config без зависимости production данных от mutable runtime state.

### `src/character.js`

Переиспользуемая композиционная сущность игрока и NPC: sprite, movement state/config, actor-profile visual defaults, collision footprint, facing, animation и depth sorting. Формирует изолированный controller snapshot и применяет нормализованный `ControllerCommand`.

### `src/controllerCommand.js`

Каноническая форма команды персонажа: нормализованные `moveDirection`, optional `aimDirection` и boolean actions `interact`, `primary`, `secondary`.

### `src/controllers.js`

`PlayerController` и `PatrolController` возвращают общий `ControllerCommand`. Player получает input/aim/actions callbacks; patrol ведёт NPC по loop или ping-pong waypoint-маршрутам и обрабатывает tolerance/blocked-waypoint fallback.

### `src/npcConfig.js`

Декларативные profile ID, spawn-точки и маршруты домашнего loop-NPC и уличного ping-pong-NPC.

### `src/input.js`

Чистая логика мобильного ввода: touch/coarse-pointer detection, зона активации, runtime-центр джойстика, clamp, dead zone, аналоговая сила и ограничение входного вектора.

### `src/mobileJoystick.js`

Runtime-компонент мобильного джойстика: Phaser/native/window listeners, one-pointer ownership, pointer capture и fallback, HUD exclusion, safety reset, графика, direction state и полный cleanup.

### `src/movementDebugPanel.js`

Опциональная DOM-панель по `?movementDebug=1`: tuning inputs, нормализация, `localStorage`, reset/copy, runtime status, async clipboard lifecycle и cleanup.

### `src/fullscreen.js`

Helper стандартного Fullscreen API: поддержка, active state, безопасный вход/выход и rejected Promise.

### `src/hud.js`

Переиспользуемый Phaser screen-space HUD: 5×7 bitmap glyphs, compact build label, fullscreen-иконка, pixel-aligned placement и hit areas.

### `src/movementConfig.js`

Ссылка на канонический player movement profile, диапазоны runtime-тюнинга, cloning и нормализация конфигурации движения относительно явного base config.

### `src/characterMovement.js`

Переиспользуемое состояние и интегратор движения: desired direction, velocity, разгон, торможение, разворот, facing/aim, delta cap и создание mutable runtime config из явного base profile.

### `src/collisionEnvironment.js`

Контракт collision environment и фабрика grid-среды: finite bounds, положительный `cellSize`, обязательный blocking query либо удобный `blockedCells` collection.

### `src/movement.js`

Foot-box collision и axis-separated sliding по переданному collision environment. Resolver использует environment bounds/cell size/blocking query, поддерживает non-zero origin и не импортирует глобальные размеры мира.

### `src/visualConfig.js`

Активные кадры персонажа, foot box, facing hysteresis и скорость анимации. Legacy room exports удалены.

### `src/worldConfig.js`

Размеры экрана, мира и тайла; параметры дома и двери; пути и frame-индексы Basic Village. Actor movement values здесь не хранятся.

### `src/worldLayout.js`

Сборка мира: ground, path, интерьер, стены, деревья, spawn, outdoor target и diagnostic blocked set. Возвращает production collision environment с bounds, cell size и blocking query.

## Проверки и инструменты

### `scripts/check-doc-contracts.mjs`

Проверяет role bootstrap, отдельные Lead/Integrator/Codex contracts, команду `проверь все PR`, dynamic GitHub tool discovery, Integration metadata и отсутствие blanket context loading для Codex.

### `scripts/check-input.mjs`

Проверяет чистую joystick math и production `MobileJoystick`: activation, clamp, dead zone, analog strength, one-pointer ownership, HUD exclusion, drag за пределами canvas, lost-capture fallback, matching release и cleanup listeners.

### `scripts/check-runtime-components.mjs`

Contract checks для `MobileJoystick` и `MovementDebugPanel`: support detection, native/Phaser pointer lifecycle, safety resets, listener cleanup, tuning/persistence/reset/copy/status, idempotent destroy и завершение async clipboard после уничтожения панели.

### `scripts/check-fullscreen.mjs`

Mock-проверки Fullscreen API helper.

### `scripts/check-hud.mjs`

Bitmap glyph coverage, build label, pixel placement, fullscreen hit area и передача HUD exclusion в `MobileJoystick`.

### `scripts/check-movement.mjs`

Max speed, diagonal normalization, acceleration, braking, reverse, turn, blocked axes, aim, tuning limits, delta cap, canonical player profile identity и независимые mutable runtime configs.

### `scripts/check-character.mjs`

Проверяет actor profile registry и immutability, explicit villager production/debug values, NPC profile wiring, общий `ControllerCommand`, player aim/actions, изоляцию controller snapshot, общую `Character`-фабрику игрока и NPC, loop/ping-pong переходы, waypoint tolerance, walkable маршруты, world collision и player-only camera target.

### `scripts/check-visual.mjs`

Проверяет удаление legacy room sources/atlases, pixel grid, Basic Village hashes, spritesheet loading, integer zoom, camera и активные character frames.

### `scripts/check-world.mjs`

Проверяет production и искусственные collision environments, bounds/cell size/blocking query, doorway, spawn/waypoint walkability, collision, sliding, anti-tunneling, blocked axes и non-zero origin.

### `scripts/check-room-preview.py`

Генерирует:

- `artifacts/world-overview.png`
- `artifacts/camera-indoor.png`
- `artifacts/camera-outdoor.png`
- `artifacts/top-wall-detail.png`

Indoor/outdoor camera previews включают соответствующего NPC. Использует зависимости из `requirements-dev.txt`; локальная ошибка установки не разрешает самодельную замену Pillow.

### `scripts/audit-spritesheet.py`

Аудит spritesheet: геометрия, кадры, CSV, SHA-256 и contact sheets.

### `requirements-dev.txt`

Канонические Python-зависимости визуальных проверок.

### `package.json`

Команды запуска, сборки и полного набора documentation/input/runtime-components/fullscreen/HUD/movement/character/visual/world/preview проверок.

## Инфраструктура

### `.github/workflows/pr-check.yml`

Проверяет финальный PR и загружает world previews.

### `.github/workflows/deploy-pages.yml`

Публикует GitHub Pages, создаёт `/version.json`, проверяет опубликованный SHA и выставляет `pages/live`.

### Настройки GitHub

- `main` защищён от удаления и force-push.
- Automatic head-branch deletion удаляет обычные merged ветки.
- Persistent `release/*`, `archive/*` и `keep/*` требуют отдельной repository-side protection.

## Правила развития карты

- Добавлять адрес только для самостоятельной и реально используемой области.
- Обновлять карту при добавлении, удалении, переименовании или существенной смене ответственности файла.
- Не обновлять карту ради каждой мелкой поведенческой правки.
- Не дублировать подробные правила из `PROJECT.md`, `LEAD.md`, `AGENTS.md`, `REVIEW.md` или `ASSETS.md`.
- Не создавать пустые разделы «на будущее».
