<!-- audience: context-router -->
# NestledBurrow: маршрутизатор систем

## Назначение

`LIBRARY.md` помогает выбрать минимальный контекст. Это не продуктовый документ, не roadmap и не перечень всех файлов.

Обычная задача читает один system-документ. Два допустимы, когда изменение действительно пересекает системы. Все документы заранее не загружаются.

## Маршруты

| Запрос или область | System-документ | Основные владельцы | Targeted checks |
|---|---|---|---|
| движение, joystick, камера, сон, потребности | `systems/character-and-needs.md` | `characterMotor.js`, `input.js`, `mobileJoystick.js`, `cameraFollowRuntime.js`, `needsDomain.js` | `check:input`, `check:mobile-camera`, `check:movement`, `check:needs`, `check:clock-cycle` |
| ресурсы, добыча, огород, вода, растения | `systems/world-and-resources.md` | `worldLayout.js`, `resourceDomain.js`, `resourceConfig.js`, `debrisRuntime.js` | `check:world`, `check:interaction`, `check:progress` |
| готовка, кухня, вывеска, гости, монеты | `systems/tavern-service.md` | `cookingDomain.js`, `cookingRuntime.js`, `facilityRuntime.js`, `guestRuntime.js`, `coinRuntime.js` | `check:cooking`, `check:guest`, `check:facilities` |
| строительство, стены, перенос, коллайдеры, pivot, авторинг | `systems/build-and-authoring.md` | `buildModeRuntime.js`, `buildWorldGeometry.js`, `editorAuthoringRuntime.js`, `assetProfiles.js`, `startingLayout.js` | `check:build-mode`, `check:authoring`, `check:task-044` |
| save, migration, NEW GAME, browser draft | `systems/persistence.md` | `gameSessionState.js`, `sessionPersistence.js`, `authoringBackup.js` | `check:progress`, `check:authoring` |
| HUD, localization, audio, day/night, visual presentation | `systems/presentation.md` | `gameHud.js`, `interactionHud.js`, `localization/`, `audioRuntime.js`, `gameClock.js` | `check:hud`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:visual` |

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
