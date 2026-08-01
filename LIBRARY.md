<!-- audience: context-router -->
# NestledBurrow: маршрутизатор систем

## Назначение

`LIBRARY.md` помогает выбрать минимальный контекст. Это не продуктовый документ, не roadmap и не перечень всех файлов.

Обычная задача читает один system-документ. Два допустимы, когда изменение действительно пересекает системы. Все документы заранее не загружаются.

## Маршруты

| Запрос или область | System-документ | Основные владельцы | Targeted checks |
|---|---|---|---|
| локации, переход Нора ↔ Гнездо, world bounds, location lifecycle | `systems/world-and-resources.md` + `systems/character-and-needs.md` | `worldLocationConfig.js`, `worldLocationCoordinator.js`, `worldLocationLifecycle.js`, `nestWorldLayout.js` | `check:task-059`, focused location Browser E2E |
| движение, joystick, камера, сон, потребности | `systems/character-and-needs.md` | `characterMotor.js`, `input.js`, `mobileJoystick.js`, `cameraFollowRuntime.js`, `needsDomain.js` | `check:input`, `check:mobile-camera`, `check:movement`, `check:needs`, `check:clock-cycle` |
| Дикий Атолл, экспедиции, сегменты, пороги, события забега, подготовка и прогресс глубины | `systems/wild-atoll.md` | `WildAtollPrototype/` как standalone-макет; production owner ещё не создан | `check:docs` |
| ресурсы, добыча, инвентарь, выброшенные предметы, огород, вода, растения | `systems/world-and-resources.md` | `resourceDomain.js`, `debrisRuntime.js`, `inventoryDomain.js`, `inventoryRuntime.js`, `farmingDomain.js`, `farmingRuntime.js` | `check:inventory`, `check:world`, `check:interaction`, `check:task-047`, `check:task-049`, `check:task-056` |
| готовка, кухня, вывеска, гости, монеты | `systems/tavern-service.md` | `cookingDomain.js`, `kitchenInteractionRuntime.js`, `facilityRuntime.js`, `guestRuntime.js`, `tavernServiceRuntime.js`, `coinRuntime.js` | `check:cooking`, `check:guest`, `check:facilities`, `check:task-049` |
| строительство, стены, перенос, коллайдеры, pivot, авторинг | `systems/build-and-authoring.md` | `buildModeRuntime.js`, `buildWorldGeometry.js`, `editorAuthoringRuntime.js`, `assetProfiles.js`, `startingLayout.js` | `check:build-mode`, `check:authoring`, `check:task-044` |
| save, migration, NEW GAME, browser draft | `systems/persistence.md` | `gameSessionState.js`, `sessionPersistence.js`, `inventoryDomain.js`, `authoringBackup.js` | `check:inventory`, `check:progress`, `check:authoring`, `check:task-049`, `check:task-056` |
| HUD, inventory/combat loadout presentation and drag, localization, audio, day/night, visual presentation | `systems/presentation.md` | `gameHud.js`, `inventoryRuntime.js`, `combatLoadoutRuntime.js`, `loadoutDragCoordinator.js`, `inventoryModeRuntime.js`, `inventoryGainPresentation.js`, `transientMessageRuntime.js`, `interactionHud.js`, `localization/`, `audioRuntime.js` | `check:inventory`, `check:hud`, `check:task-053`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:task-049`, `check:visual` |

## Межсистемные задачи

Дополнительно открыть `ARCHITECTURE.md`, когда:

- появляется новый owner или coordinator;
- меняется общий state ownership;
- задача добавляет orchestration в `src/main.js`;
- затронуты одновременно build/authoring и gameplay persistence;
- facilities меняют motor/presentation/camera contract;
- вводится dependency, deployment или security boundary.

## Инструкционные документы

- Лид: `PROJECT.md` + `LEAD.md`.
- Прямая реализация/Codex: `AGENTS.md` + `AGENTS.override.md`.
- Интегратор: `PROJECT.md` + `REVIEW.md`.
- Бинарные assets: `ASSETS.md` + `BINARY_IMPORT.md`.
- Скоростной аудит: `FAST_LOOP.md` только при отдельной ретроспективе.
- `tasks/*.md` читаются только когда конкретный файл назван в задаче.

## Правило обновления

Менять этот файл только при добавлении/переименовании системы, владельца или canonical check. Баланс, Task status, координаты и быстро меняющиеся детали сюда не записываются.
