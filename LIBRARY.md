<!-- audience: context-router -->
# NestledBurrow: маршрутизатор систем

## Назначение

`LIBRARY.md` помогает выбрать минимальный контекст. Это не продуктовый документ, не roadmap и не перечень всех файлов.

Обычная задача читает один system-документ. Два допустимы, когда изменение действительно пересекает системы. Все документы заранее не загружаются.

## Маршруты

| Запрос или область | System-документ | Основные владельцы | Targeted checks |
|---|---|---|---|
| локации, переход Нора ↔ Гнездо, world bounds, location lifecycle | `systems/world-and-resources.md` + `systems/character-and-needs.md` | `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`, `src/world/nestWorldLayout.js` | `check:task-059`, `check:task-065`, focused location Browser E2E |
| движение, joystick, камера, сон, потребности | `systems/character-and-needs.md` | `src/character/characterMotor.js`, `src/controls/input.js`, `src/controls/mobileJoystick.js`, `src/character/cameraFollowRuntime.js`, `src/interaction/interactionApproach.js`, `src/needs/needsDomain.js`, `src/needs/needsRuntime.js`, `src/needs/needsFlowRuntime.js`, `src/needs/interactionTimelineRuntime.js`, `src/needs/toiletAccidentTimelineRuntime.js`, `src/needs/needsInteractionCoordinator.js` | `check:input`, `check:interaction`, `check:movement`, `check:needs`, `check:task-061` |
| Дикий Атолл, стартовые арены, развилка Лес/Шахты, локальные ресурсы и будущая глубина | `systems/wild-atoll.md` | `src/world/wildAtollDomain.js`, `src/world/wildAtollRuntime.js`; `WildAtollPrototype/` остаётся standalone design aid | `check:task-068`, `check:docs` |
| ресурсы, добыча, world interactions, инвентарь, выброшенные предметы, огород, вода, растения | `systems/world-and-resources.md` | `src/interaction/interaction.js`, `src/interaction/interactionRuntime.js`, `src/interaction/worldInteractionCoordinator.js`, `src/resources/resourceDomain.js`, `src/resources/debrisRuntime.js`, `src/inventory/inventoryDomain.js`, `src/inventory/inventoryRuntime.js`, `src/resources/farmingDomain.js`, `src/resources/farmingRuntime.js` | `check:inventory`, `check:world`, `check:interaction`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-064` |
| готовка, кухня, вывеска, гости, монеты | `systems/tavern-service.md` | `src/tavern/cookingDomain.js`, `src/tavern/kitchenInteractionRuntime.js`, `src/facilities/facilityRuntime.js`, `src/tavern/guestRuntime.js`, `src/tavern/tavernServiceRuntime.js`, `src/tavern/coinRuntime.js` | `check:cooking`, `check:guest`, `check:facilities`, `check:task-049` |
| строительство, стены, перенос, коллайдеры, pivot, авторинг | `systems/build-and-authoring.md` | `src/build/worldBuildCoordinator.js`, `src/build/buildModeRuntime.js`, `src/build/buildWorldGeometry.js`, `src/build/editorAuthoringRuntime.js`, `src/build/assetProfiles.js`, `src/build/startingLayout.js` | `check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068` |
| save, migration, NEW GAME, browser draft | `systems/persistence.md` | `src/session/gameSessionState.js`, `src/session/sessionPersistence.js`, `src/inventory/inventoryDomain.js`, `src/build/authoringBackup.js` | `check:inventory`, `check:progress`, `check:authoring`, `check:task-049`, `check:task-056` |
| HUD, inventory/combat loadout presentation and drag, numbered self-use, localization, audio, day/night, visual presentation | `systems/presentation.md` | `src/ui/gameHud.js`, `src/ui/presentationTuning.js`, `src/inventory/inventoryRuntime.js`, `src/combat/combatLoadoutRuntime.js`, `src/inventory/combatQuickUse.js`, `src/inventory/loadoutDragCoordinator.js`, `src/inventory/inventoryModeRuntime.js`, `src/inventory/inventoryGainPresentation.js`, `src/ui/transientMessageRuntime.js`, `src/ui/interactionHud.js`, `localization/`, `src/audio/audioRuntime.js` | `check:inventory`, `check:hud`, `check:task-053`, `check:task-068`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:task-049`, `check:visual` |

## Канонические адреса owners

Production-модули сгруппированы по игровому или системному владельцу. `src/main.js` остаётся bundler entry/composition root, `src/style.css` — корневым stylesheet. Остальные production-модули находятся в следующих каталогах:

| Owner | Канонический каталог |
|---|---|
| персонажи, motor, controllers и character presentation | `src/character/` |
| потребности и их timelines | `src/needs/` |
| interaction selection, dialogue и world dispatch | `src/interaction/` |
| layouts, locations, Дикий Атолл и world presentation | `src/world/` |
| ресурсы, debris/beds, farming и merchant | `src/resources/` |
| build mode, geometry и authoring | `src/build/` |
| fixed facilities | `src/facilities/` |
| cooking, guests, service, sign и coins | `src/tavern/` |
| inventory state, quick-use, world items и loadout drag | `src/inventory/` |
| melee и combat presentation | `src/combat/` |
| player input adapters | `src/controls/` |
| HUD и общие UI presenters | `src/ui/` |
| session state, persistence и clock | `src/session/` |
| audio settings и runtime | `src/audio/` |
| developer/test adapters | `src/devtools/` |

Существующие публичные каталоги `src/assets/` и `src/localization/` сохраняют свои контракты. Постоянную границу проверяет `check:source-layout`.

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
