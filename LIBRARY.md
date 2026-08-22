<!-- audience: context-router -->
# NestledBurrow: маршрутизатор систем

## Назначение

`GAME.md` — фантазия игры; `LIBRARY.md` — карта систем, `systems/*.md` — подробности.

Обычная задача читает один system-документ. Два допустимы, когда изменение действительно пересекает системы. Все документы заранее не загружаются.

## Маршруты

| Запрос или область | System-документ | Основные владельцы | Targeted checks |
|---|---|---|---|
| локации, переход Нора ↔ Гнездо, world bounds и location lifecycle | `systems/world-and-resources.md` + `systems/character-and-needs.md` | `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`, `src/world/nestWorldLayout.js`, `src/world/atollWorldLayout.js` | `check:task-059`, `check:task-065`, `check:task-069`, focused location Browser E2E |
| движение, joystick, камера, сон, потребности | `systems/character-and-needs.md` | `src/character/characterMotor.js`, `src/controls/input.js`, `src/character/cameraFollowRuntime.js`, `src/needs/needsDomain.js`, `src/needs/needsRuntime.js`, `src/needs/needsInteractionCoordinator.js` | `check:input`, `check:interaction`, `check:movement`, `check:needs`, `check:task-061` |
| persistent population, поколения, имена/фамилии, family tree, inspection, demand, offscreen needs | `systems/character-and-needs.md` + `systems/persistence.md` | `src/character/populationDomain.js`, `src/character/populationLifecycleDomain.js`, `src/character/populationWealthBalance.js`, `src/character/personEconomyProfile.js`, `src/character/personNames.js`, `src/character/personFamilyNames.js`, `src/character/personNameLocalization.js`, `src/character/personFamilyTree.js`, `src/character/personInspectionRuntime.js`, `src/session/sessionPersistence.js` | `check:task-086`, `check:task-088`, `check:task-090`, `check:task-096`, `check:task-098`, `check:task-099`, `check:task-100`, `check:task-101`, `check:task-102` |
| Дикий Атолл, схема Шхер/Гротов, NPC-переймы, Моту, Голубая дыра, T1-T3 | `systems/wild-atoll.md` | `src/world/atollWorldLayout.js`, `src/world/wildAtollDomain.js`, `src/world/wildAtollRuntime.js`; `WildAtollPrototype/` — standalone design aid | `check:task-059`, `check:task-068`, `check:docs` |
| ресурсы, добыча, interactions, инвентарь, выброшенные предметы, огород, вода, растения | `systems/world-and-resources.md` | `src/interaction/interaction.js`, `src/interaction/interactionRuntime.js`, `src/interaction/worldInteractionCoordinator.js`, `src/resources/resourceDomain.js`, `src/resources/debrisRuntime.js`, `src/inventory/inventoryDomain.js`, `src/inventory/inventoryRuntime.js`, `src/resources/farmingDomain.js`, `src/resources/farmingRuntime.js` | `check:inventory`, `check:world`, `check:interaction`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-064` |
| таверна: offer, visits/groups, feedback, orders и service | `systems/tavern-service.md` | `src/tavern/cookingDomain.js`, `src/tavern/saleProfileDomain.js`, `src/tavern/visitDemandDomain.js`, `src/tavern/visitPartyDomain.js`, `src/tavern/tavernFeedbackDomain.js`, `src/tavern/orderDomain.js`, `src/tavern/guestIntentDomain.js`, `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`, `src/tavern/guestRuntime.js`, `src/tavern/overheadPresentationRuntime.js`, `src/tavern/coinRuntime.js` | `check:cooking`, `check:guest`, `check:task-049`, `check:task-087`, `check:task-088`, `check:task-089`, `check:task-091`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-102` |
| строительство, BUILD/TEST, simulation grants, стены, перенос, коллайдеры, pivot, авторинг | `systems/build-and-authoring.md` | `src/build/worldBuildCoordinator.js`, `src/build/buildModeRuntime.js`, `src/build/simulationTestPalette.js`, `src/build/simulationTestFeedback.js`, `src/build/buildWorldGeometry.js`, `src/build/editorAuthoringRuntime.js`, `src/build/assetProfiles.js`, `src/build/startingLayout.js` | `check:build-mode`, `check:task-090`, `check:task-100`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068` |
| save, migration, NEW GAME, browser draft | `systems/persistence.md` | `src/session/gameSessionState.js`, `src/session/sessionPersistence.js`, `src/inventory/inventoryDomain.js`, `src/build/authoringBackup.js` | `check:inventory`, `check:progress`, `check:authoring`, `check:task-049`, `check:task-056`, `check:task-102` |
| HUD, UI/world cameras, loadouts, localization, audio, day/night | `systems/presentation.md` | `src/ui/gameHud.js`, `src/ui/presentationCameraRuntime.js`, `src/inventory/inventoryRuntime.js`, `src/combat/combatLoadoutRuntime.js`, `src/ui/interactionHud.js`, `localization/`, `src/audio/` | `check:inventory`, `check:hud`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:visual` |

## Канонические адреса owners

`src/main.js` остаётся composition root, `src/style.css` — корневым stylesheet. Production-модули сгруппированы по владельцу:

| Owner | Канонический каталог |
|---|---|
| персонажи, persistent population, motor, controllers и character presentation | `src/character/` |
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

`src/assets/` и `src/localization/` сохраняют контракты; границу проверяет `check:source-layout`.

Visual runtime binaries размещаются по `ARTIST.md`, `ASSETS.md` и `BINARY_IMPORT.md`. Для project-authored assets Художник выбирает системного owner и существующую semantic folder в `public/assets/project/`; `asset-inbox/incoming` не canonical owner.

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
- Художник: `PROJECT.md` + `ARTIST.md` + `ASSETS.md` + `BINARY_IMPORT.md`.
- Исполнение: ChatGPT — `CHATGPT.md`; Codex — `AGENTS.md` + `AGENTS.override.md`.
- Интегратор: `PROJECT.md` + `REVIEW.md`.
- Бинарные assets вне Artist-route: `ASSETS.md` + `BINARY_IMPORT.md`.
- Скоростной аудит: `FAST_LOOP.md` только при отдельной ретроспективе.
- `tasks/*.md` читаются только когда конкретный файл назван в задаче.

## Правило обновления

Менять этот файл только при добавлении/переименовании системы, владельца или canonical check. Баланс, Task status, координаты и быстро меняющиеся детали сюда не записываются.
