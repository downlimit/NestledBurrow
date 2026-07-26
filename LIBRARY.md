<!-- audience: optional-map -->
# Library: карта NestledBurrow

## Назначение

`LIBRARY.md` — необязательная карта устойчивых адресов. Она помогает найти владельца системы без чтения всего репозитория. Это не источник продуктового статуса, баланса или следующей задачи.

Новый project-чат сначала читает `PROJECT.md`. Лид затем следует `LEAD.md`, Интегратор — `REVIEW.md`, Codex — прямому prompt и `AGENTS.md`. Эта карта открывается только для поиска конкретной области.

## Канонические документы

| Документ | Владеет |
|---|---|
| `PROJECT.md` | bootstrap, роли и опубликованный технический контекст |
| `GAME.md` | продуктовый вижн, фактическая зрелость и пользовательский verdict |
| `ROADMAP.md` | активная/следующая работа и Task numbers |
| `LEAD.md` | перевод замысла в компактное ТЗ и выбор Fast/Strict |
| `ARCHITECTURE.md` | подтверждённые runtime-границы и условные точки выделения |
| `REVIEW.md` | независимая приёмка, repair и merge нескольких/сложных PR |
| `AGENTS.md` | исполнение Codex, preview, proportional validation и delivery |
| `FAST_LOOP.md` | человеческие ретроспективы скорости; не обязательный контекст Codex |
| `ASSETS.md` | provenance, лицензии, размеры и hashes runtime assets |
| `BINARY_IMPORT.md` | Lead-owned доставка пользовательских binary blobs |
| `tasks/*.md` | только явно указанная большая/возобновляемая задача |

Один изменяемый факт имеет одного владельца. Эта карта описывает адрес и ответственность, но не дублирует подробные правила.

## Composition root

### `src/main.js`

Phaser `WorldScene`: preload и создание runtime-компонентов, wiring world/session/input/HUD/audio, общий update, autosave/reset и E2E bridge. Build-mode world rendering/orchestration и часть facility/camera coordination пока сходятся здесь; условные точки следующего выделения находятся в `ARCHITECTURE.md`.

## Character и движение

### `src/controllerCommand.js`

Нормализованная команда персонажа: движение, optional aim и boolean actions.

### `src/controllers.js`

Player/patrol controllers над snapshots и общим `ControllerCommand`.

### `src/actorProfiles.js`

Immutable movement/profile registry персонажей.

### `src/characterVisualProfiles.js`

Immutable visual profiles, cardinal/diagonal textures, frame references и animation keys.

### `src/characterMotor.js`

Runtime-free position, movement state/config, controller, footprint и collision integration.

### `src/characterVisual.js`

Phaser presentation: sprite, eight-direction facing, animation, depth и position sync.

### `src/character.js`

Aggregate, связывающий motor и visual.

### `src/characterSystem.js`

Stable-ID registry, ordered update, snapshots и lifecycle.

### `src/characterMovement.js`, `src/movement.js`, `src/collisionEnvironment.js`

Чистая математика скорости и axis-separated collision через явный environment contract.

### `src/input.js`, `src/mobileJoystick.js`

Чистая joystick math и runtime touch/coarse-pointer lifecycle.

### `src/cameraFollowRuntime.js`

Presentation camera B/F/C и отдельная follow target без мутации motor position.

### `src/movementDebugPanel.js`

Dev/runtime tuning UI, живущий отдельно от gameplay save.

## Мир и строительство

### `src/worldConfig.js`

Устойчивые размеры экрана/мира/тайла, Basic Village paths и semantic frame mappings.

### `src/worldLayout.js`

Production composition, edge-grid tavern geometry, doorway/path, environment objects и collision queries.

### `src/buildAssetCatalog.js`

Канонический catalog доступных build assets и placement metadata.

### `src/buildModeRuntime.js`

Build-mode UI/input state: library, selection, touch scroll/inertia, placement gestures, prediction, demolition и grouped undo lifecycle.

### `src/facilityPreviewVisuals.js`

Общий adapter canonical furniture sprites для build thumbnails, ghosts и demolition tint.

## Gameplay state

### `src/gameSessionState.js`

JSON-safe fresh/normalize boundary текущей save schema: world/player IDs, flags, needs/resources и устойчивый progress без Phaser refs.

### `src/sessionPersistence.js`

Versioned envelope, validation, migrations, save/load/clear и safe fallback.

### `src/needsDomain.js`

Pure needs values/rates/clamps и flow semantics. Gameplay timing остаётся вне HUD.

### `src/resourceDomain.js`, `src/resourceConfig.js`

Immutable resource profiles, actions/rewards/balance и stable world definitions.

### `src/debrisRuntime.js`

Resource/bed world objects, individual progress, colliders, visuals и teardown.

### `src/facilityConfig.js`, `src/facilityRuntime.js`

Canonical furniture assets, footprints, colliders, optional presentation pose и use lifecycle.

## Interaction, HUD и localization

### `src/interaction.js`

Immutable descriptors и чистый deterministic target selection.

### `src/interactionConfig.js`, `src/dialogueConfig.js`, `src/neighborQuest.js`

Stable IDs, dialogue definitions и pure quest transitions.

### `src/interactionRuntime.js`

Framework-agnostic candidate/action/dialogue coordination и persistent effects.

### `src/interactionHud.js`

Phaser prompts/dialogue, mobile tap lifecycle и HUD exclusion.

### `src/gameHud.js`

Screen-space needs/resources, options, language/audio/fullscreen/`NEW GAME`, build-menu presentation и hit-area lifecycle.

### `src/localization/index.js`

i18next service: locale detection, EN fallback, ICU, preference persistence и live subscriptions.

### `public/locales/{en,ru}`

Canonical `common`, `hud` и `dialogue` JSON namespaces.

Runtime font подключается из pinned `@fontsource/pixelify-sans` Latin/Cyrillic package subsets; font binaries не копируются в tracked runtime paths.

## Audio и assets

### `src/audioRuntime.js`, `src/audioSettings.js`

Playlist/no-repeat/crossfade runtime и отдельные master/music preferences.

### `ASSETS.md`

Basic Village, character sheets, Pixelify Sans package и user-uploaded music/furniture provenance.

## Проверки и локальные инструменты

### `package.json`

Канонические команды build, targeted checks, managed preview и E2E.

### `scripts/run-python-check.mjs`

Portable Python 3 resolver для Windows/Linux checks. Использует explicit env override, стандартный launcher/PATH или известный bundled runtime без ручного поиска в каждой задаче.

### `scripts/manage-task-preview.mjs`

Один detached preview на стабильном task-порту; state/logs живут в OS temp, а status подтверждает HTTP, page errors и canvas 320×180.

### `scripts/run-focused-e2e.mjs`

Владеет отдельными Vite/Playwright processes и OS-temp outputs. Удаляет artifacts при успехе и сохраняет диагностический путь только при failure.

### `scripts/check-*.mjs`, `scripts/check-*.py`

Targeted contract checks. Каждый check доказывает свою область; полный `npm run check` является Strict/local repository gate, а не default после принятого Fast-preview.

Ключевые группы:

- `check-needs`, `check-clock-cycle`, `check-progress` — state/rates/persistence;
- `check-input`, `check-mobile-camera`, `check-movement`, `check-character` — input/movement/presentation;
- `check-build-mode`, `check-world`, `check-facilities` — geometry/editor/furniture;
- `check-hud`, `check-text-resolution`, `check-localization` — layout/glyphs/RU-EN parity;
- `check-audio`, `check-binary-import`, `check-visual`, Python sprite/world audits — assets and rendering contracts.

### `playwright.config.js`, `tests/e2e/*`

Desktop/mobile integrated browser evidence. Full suite принадлежит PR CI; local focused spec используется только для скрытого риска, не доказанного preview или более дешёвым check.

## CI и публикация

### `.github/workflows/pr-check.yml`

Классифицирует scope и параллельно запускает Validate/Browser E2E для runtime/strict. Diagnostic artifacts загружаются только при failure.

### `.github/workflows/deploy-pages.yml`

Публикует Pages и проверяет опубликованный SHA.

## Правила карты

- Добавлять адрес только для самостоятельной реально используемой области.
- Обновлять при добавлении, удалении, переименовании или существенной смене ответственности.
- Не фиксировать здесь «следующий шаг», текущий баланс, конкретный Task status или быстро меняющиеся числа.
- Не копировать подробные правила из канонических документов.
