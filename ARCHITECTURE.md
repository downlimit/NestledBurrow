<!-- audience: lead-chat -->
# Архитектура NestledBurrow

## Назначение

`ARCHITECTURE.md` хранит долгоживущую оценку runtime-архитектуры, подтверждённые границы и условные точки следующего выделения. Фактическое состояние всегда сверяется с актуальным `main`; продуктовая зрелость принадлежит `GAME.md`.

## Общая оценка

Архитектура соответствует раннему playable-прототипу и не требует полной перестройки. Проект развивается законченными функциональными slices: временный локальный код допустим для проверки ощущения, а новая универсальная граница вводится после повторного реального use case.

Устойчивые разделения:

- `CharacterMotor` владеет runtime-free movement/controller/collision;
- `CharacterVisual` владеет Phaser sprite, facing, animation и depth;
- `CharacterSystem` предоставляет stable-ID registry и ordered update;
- player и patrol controllers возвращают общий `ControllerCommand`;
- actor/visual profiles декларативны;
- collision resolver получает environment contract;
- `GameSessionState` JSON-safe и versioned;
- interaction targeting является чистой детерминированной функцией;
- `InteractionRuntime` отделён от `InteractionHud`;
- `GameHud`, `MobileJoystick`, `MovementDebugPanel`, `CameraFollowRuntime` и `BuildModeRuntime` имеют собственное lifecycle ownership;
- needs, facilities, resources и audio имеют выделенные domain/config/runtime-модули.

## Главный текущий риск: `WorldScene` / `src/main.js`

`WorldScene` остаётся composition root, но сейчас координирует больше, чем простой wiring:

- preload и world rendering;
- создание и связывание runtime-систем;
- keyboard/action sampling;
- needs/resource/facility/sleep update;
- build-mode world preview, placement и demolition presentation;
- camera presentation sync;
- audio lifecycle;
- autosave, reset и E2E bridge;
- browser listeners и cleanup.

Это допустимо для работающего прототипа, однако Task #030–#034 подтвердили рост цены изменений в этом файле. Решение — не общий rewrite, а локальное выделение при следующем содержательном use case.

## Условные границы для следующих Лидов

### Build mode

При следующей задаче, которая существенно меняет build mode, Лид обязан проверить фактический `main` и включить в ТЗ локальное выделение build-mode rendering/orchestration, если новая логика иначе снова разрастается в `WorldScene`.

Предпочтительное направление:

- `BuildModeRuntime` владеет UI/input state, gestures, selection, scroll, prediction и undo lifecycle;
- catalog/placement metadata остаются в `buildAssetCatalog` и связанных definitions;
- world-facing build renderer/coordinator получает явные callbacks/contracts от scene;
- `WorldScene` создаёт компонент и передаёт world/facility/resource owners, но не хранит его внутреннюю state machine.

Это правило не требует отдельного рефакторинга без gameplay-задачи и не разрешает одновременно переписывать всю world architecture.

### Facilities и presentation camera

При следующей задаче, которая одновременно меняет facilities, presentation pose, motor position или camera follow, Лид проверяет возможность выделить только coordination boundary:

- facility runtime владеет объектом, collider и use lifecycle;
- presentation pose не мутирует безопасную motor position;
- `CameraFollowRuntime` получает presentation position через один явный adapter;
- sleep/wake и interaction candidate остаются самостоятельными контрактами;
- `WorldScene` только связывает эти результаты.

Не создавать универсальную animation/presentation framework до второго отличающегося паттерна.

## Принятые направления

### Controller и движение

Контроллер возвращает нормализованный `ControllerCommand` с `moveDirection`, optional `aimDirection` и действиями. Он получает snapshot вместо mutable `Character`.

`CharacterMotor` хранит position, movement state/config, controller, collision footprint и blocked axes. `CharacterVisual` синхронизирует presentation из motor snapshot. HP, quests, inventory и save logic в motor/visual не добавляются.

Текущий axis-separated substep collision resolver сохраняется, пока dash, knockback или быстрые сущности не докажут необходимость замены.

### Facing и animation

- `moveDirection` — команда;
- `velocity` — фактическое движение;
- `facingDirection` — continuous orientation;
- cardinal/diagonal frame selection принадлежит visual layer;
- walk cadence: `step A → neutral → step B → neutral`;
- после остановки sprite явно возвращается в neutral frame текущего facing.

Назначение pixel frames подтверждается по PNG и contact sheet, а не угадывается по имени или порядку.

### World geometry

Активный environment использует Basic Village. Таверна построена на 16 px world cells, стены — на рёбрах между клетками; render и collision используют общую edge-геометрию. Resource placement сохраняет собственный 8 px grid.

`worldConfig` хранит устойчивые размеры и atlas mappings. `worldLayout` собирает production composition и collision environment. Полное разделение `WorldDefinition` / `WorldRuntime` / `WorldRenderer` вводится только когда переходы между пространствами или повторное авторство мира создадут фактическую потребность.

Tiled/LDtk не вводятся без подтверждённой проблемы ручного авторинга.

### Build mode

`BuildModeRuntime` и `buildAssetCatalog` уже существуют. Режим поддерживает локализованную library, placement/drag prediction, demolition, grouped undo, surfaces, walls, furniture и дерево. Постройки пока runtime-only и не меняют save schema.

Следующее расширение не должно добавлять ещё один параллельный catalog, placement grid или renderer path.

### Session и persistence

`GameSessionState` хранит только JSON-safe устойчивое gameplay state. Persistence использует versioned envelope, validation, явные migrations и fresh-state fallback. Presentation preferences — язык, звук и debug tuning — хранятся отдельно и переживают `NEW GAME`.

Новая save schema является Strict-задачей. Runtime-only experimentation допустима без преждевременного persistence, если граница явно названа.

### Needs, resources и facilities

- needs rates/flow и clamps принадлежат pure domain/config;
- resources используют immutable profiles и общий interaction/action contract;
- facilities декларативно задают sprite, footprint, collider и optional presentation pose;
- world runtime хранит stable IDs и teardown;
- HUD показывает состояние, но не вычисляет gameplay.

Не строить универсальный inventory/tool/facility framework до появления второго содержательно отличающегося цикла.

### Interaction и dialogue

Interaction descriptors immutable и JSON-like. Targeting учитывает radius, facing, priority, distance и stable ID. `InteractionRuntime` выбирает candidate, разрешает dialogue/action и применяет persistent transition; Phaser presentation принадлежит HUD/runtime-компонентам.

User-facing текст не хранится в session state. Session хранит stable IDs и progress.

### Camera

`CameraFollowRuntime` владеет B/F/C и невидимой follow target. Он получает presentation-позицию после visual update; sleep и facility pose не должны перемещать безопасную motor position. Camera bounds и integer zoom остаются у scene.

### HUD и локализация

`GameHud` уже выделен и владеет screen-space controls, needs/resources, options/new-game lifecycle и hit areas. `InteractionHud` владеет prompts/dialogue. Layout измеряет фактический текст и поддерживает native `320×180` и coarse-pointer mobile.

Локализация использует i18next, ICU и JSON namespaces. Runtime font — Pixelify Sans с Latin/Cyrillic subsets из pinned package. Gameplay/config хранит translation keys, а не готовые строки.

### Audio

`audioRuntime` владеет playlist/no-repeat/crossfade и применением master/music volume к активным трекам. Canonical user audio paths и provenance принадлежат `ASSETS.md`. UI плейлиста и отдельная музыкальная система не вводятся без продуктовой необходимости.

### Browser evidence

Node contract checks являются основным доказательством pure logic. Playwright проверяет интегрированные desktop/mobile flows, persistence, input и отсутствие page errors. Visual feel подтверждается preview пользователем; хрупкие pixel-diff baselines не вводятся.

## Реализованные архитектурные шаги

- общий `ControllerCommand`, actor profiles и collision environment;
- `CharacterMotor` / `CharacterVisual` / `CharacterSystem`;
- `MobileJoystick`, `MovementDebugPanel`, `CameraFollowRuntime`;
- JSON-safe session, versioned persistence и `NEW GAME`;
- `InteractionRuntime`, `InteractionHud`, dialogue/quest slice;
- i18next RU/EN и Pixelify Sans;
- `GameHud`, needs/resource/facility/audio runtimes;
- edge-grid world geometry;
- `BuildModeRuntime` и asset catalog;
- desktop/mobile Browser E2E.

## Не вводить без доказанной необходимости

- полноценный ECS;
- глобальный event bus;
- dependency injection framework;
- массовую миграцию на TypeScript;
- Phaser Physics вместо текущего movement/collision core;
- A* pathfinding;
- Tiled или LDtk;
- крупный механический перенос каталогов;
- самодельный localization framework;
- cloud TMS/runtime translation service;
- универсальную quest/inventory/facility/build framework до второго реального паттерна.
