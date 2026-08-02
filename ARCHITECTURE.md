<!-- audience: lead-chat -->
# Архитектура NestledBurrow

## Принцип

Проект развивается небольшими игровыми slices. Универсальная граница появляется после реального повторяющегося use case, но уже подтверждённые owners не обходятся ради скорости.

Системные контракты описаны в `systems/*.md`; этот документ хранит только межсистемные решения и ограничения.

## Устойчивые границы

- character motor, visual и controller разделены;
- input и mobile joystick возвращают команды, а не владеют gameplay state;
- needs, resources, cooking и guest flow имеют domain/runtime owners;
- session save JSON-safe и versioned;
- developer authoring отделён от gameplay save;
- HUD, camera, audio и build UI имеют lifecycle owners;
- interaction selection остаётся детерминированным контрактом; collision-valid use position и visual aim position разделены, а общая extractable-группа ресурсов и растений ранжируется по направлению взгляда до локальной дистанции.
- `WorldLocationCoordinator` владеет реестром локаций, атомарным переключением layout/camera/motor и location-specific lifecycle.
- Повторно используемый world-entity type имеет одного runtime owner и один presentation adapter во всех локациях. Location config передаёт owner только stable ID, placement и location capability; authoring регистрирует экземпляр у того же owner. Отдельные location-specific visuals, targeting, hit feedback и teardown для общего типа запрещены.
- Дикий Атолл имеет отдельный transport-free world layout (`src/world/atollWorldLayout.js`), topology/resource-placement rules (`src/world/wildAtollDomain.js`) и transient arena presentation/input (`src/world/wildAtollRuntime.js`); его arena state не сериализуется.
- Применение предметов из numbered combat slots разделяет UI activation (`src/combat/combatLoadoutRuntime.js`) и мутацию item/needs (`src/inventory/combatQuickUse.js`).

## `src/main.js` — только composition root

Разрешённые обязанности `WorldScene`:

- preload;
- создание scene/session owners и передача factories для location-scoped owners;
- передача callbacks и dependencies;
- делегирование frame phases владельцам orchestration;
- lifecycle cleanup;
- сборка E2E bridge из готовых owners.

В `src/main.js` нельзя добавлять новую domain logic, самостоятельную state machine, сериализацию, placement algorithm, editor workflow или крупную presentation subsystem.

Для `src/main.js` действует жёсткий предел `1300` строк, который устанавливает `scripts/check-architecture-boundaries.mjs`. Текущий файл остаётся ниже него. Это предохранитель: следующая содержательная функция должна сопровождаться локальным выделением, чтобы composition root не рос дальше.

## Физическая граница `src/`

Системный owner задаёт физический адрес production-модуля. Domain, runtime, config и presentation одного подтверждённого владельца располагаются рядом в owner-каталоге:

- `src/character/`, `src/needs/`, `src/interaction/`, `src/world/`;
- `src/resources/`, `src/build/`, `src/facilities/`, `src/tavern/`;
- `src/inventory/`, `src/combat/`, `src/controls/`, `src/ui/`;
- `src/session/`, `src/audio/`, `src/devtools/`.

В корне `src/` разрешены `src/main.js` и `src/style.css`. Публичные контракты `src/assets/` и `src/localization/` сохраняются. Generic-каталоги `common`, `shared`, `misc`, `utils`, `core`, `runtime`, `domain` и `config`, а также новые barrel `index.js`, запрещены проверкой `check:source-layout`. Architecture scanner рекурсивно индексирует production JS по полному repository-relative path.

## Следующие подтверждённые выделения

### Build и authoring

`WorldBuildCoordinator` владеет player-facing world mutation и transient build-session state:

- world sprites и topology;
- placement/move/demolition;
- profile collider и drag anchor;
- facilities/resources/build objects;
- grouped undo, preview и demolition highlight;
- публичный API для authoring и E2E bridge.

`BuildModeRuntime` продолжает владеть UI/input state и создаётся координатором на Phaser rendering host. Facilities, resources/beds, wells/farming, tavern sign и training dummy сохраняют собственные runtime states; координатор только маршрутизирует их мутации через явно переданные adapters. `WorldScene` создаёт координатор, передаёт layout, profiles, runtime owners и ограниченные callbacks, затем делегирует location cleanup. Authoring owners используют публичные методы координатора без доступа к его внутренним `Map`, undo stack и preview state.

### Tavern service

`TavernServiceRuntime` координирует persisted multi-guest service и value-bearing coin runtime. `KitchenInteractionRuntime` делегирует fixed-facility mutations соответствующим domain/runtime owners. Расписание волн принадлежит `src/tavern/tavernServiceDomain.js`, маршруты и состояние визита — `src/tavern/guestRuntime.js`, рецепты/stock/reservations — `src/tavern/cookingDomain.js`, а `WorldScene` только связывает owners и callbacks.

Следующее расширение очереди, меню, staff или нескольких service stations развивает эти owners и не возвращает orchestration в `WorldScene`.

### Facilities и presentation

Facility runtime владеет объектом, collider и use lifecycle. Presentation pose не мутирует безопасную motor position. Camera получает presentation target через явный adapter. Sleep/wake и interaction candidate остаются отдельными контрактами.

`InteractionApproachResolver` owns collision-valid perimeter use points and bounded route selection for every interaction candidate. `InteractionTimelineRuntime` owns transient enter/active/exit phases and pose interpolation. `ToiletAccidentTimelineRuntime` owns the unskippable shake/recovery sequence and puddle hook. `NeedsInteractionCoordinator` binds these phases to facility, sleep and protected-need outputs. `NeedsFlowRuntime` measures actual N/E/S/T/L/D value deltas for HUD direction and tier without action labels. These owners are not serialized; `WorldScene` only constructs them, delegates update and routes callbacks.

### Combat loadout quick use

`CombatLoadoutRuntime` owns only numbered-slot activation, pointer/keyboard gating, presentation refresh and feedback dispatch. `LoadoutDragCoordinator` decides click versus drag before forwarding activation. `src/inventory/combatQuickUse.js` owns supported item profiles and atomic mutation of the selected combat slot, bucket water and target need.

Quick use is available only in stable `COMBAT`; Alt, panel transition, modal suppression and editable input disable it. Drag completion cannot also execute self-use. Adding an item profile must preserve the existing inventory item identity and define its exact consumption and need mutation in `src/inventory/combatQuickUse.js`.

### Дикий Атолл: первый runtime slice

`src/world/atollWorldLayout.js` owns a rectangular collision environment with blocked outer boundary and no static transports. `src/world/wildAtollDomain.js` owns starter topology, exit semantics and deterministic placement of actual resource nodes. `src/world/wildAtollRuntime.js` owns the northern Nest entrance and one transient run inside `WORLD_IDS.atoll`: three starter arenas, exactly two cave exits at the Forest/Mines fork, local node state, world visuals/colliders, tool-gated harvesting and reward delivery.

Nest entry and edge return call `WorldLocationCoordinator.transitionTo` with explicit safe spawns. That method reuses the canonical location lifecycle without requiring a paired persistent transport or creating a hidden transition lock. Internal arena transitions remain inside the Atoll runtime. The runtime uses peaceful inventory selection for axe/pickaxe gating, asks the existing needs owner to price and record physical work, and sends ordinary inventory/world-item mutations through existing owners. Arena transitions do not mutate needs directly. Future multi-location segments extend the registered location/lifecycle model and do not create a second coordinator.

### World interaction execution

`InteractionRuntime` владеет candidate targeting, facing/approach selection, dialogue lifecycle и presenter protocol. `WorldInteractionCoordinator` агрегирует static world definitions, применяет общие availability gates и детерминированно исполняет недиалоговые действия в порядке merchant, farming, tavern sign, facility, bed, busy gate, exhausted wake, resource.

Координатор хранит только transient resource cooldown/activity state и делегирует мутации существующим merchant, farming, kitchen, needs, facility, debris и tavern-sign owners. `WorldLocationRuntime` явно rebind-ит эти owners после mount и отвязывает до teardown. `WorldScene` создаёт coordinator один раз на scene/session, передаёт ограниченные callbacks, подключает его к `InteractionRuntime` и читает cooldown/activity snapshots.

### Локации мира

`src/world/worldLocationConfig.js` задаёт постоянные ID, capabilities, транспорты и spawn-контракты. `WorldLocationCoordinator` выбирает активный layout, синхронизирует `sessionState.currentWorldId`, управляет transition lock, поддерживает explicit transport-free transitions и вызывает публичный location lifecycle.

`WorldLocationRuntime` один раз создаётся на scene/session, получает явные dependencies и factories, затем владеет location-scoped owners, capability-driven mount/unmount, frame-action/realtime/world-step порядком, candidate consumers и transition guard. Его `getOwners()` возвращает read-only snapshot с именованными полями; string service locator и поиск по полям `WorldScene` запрещены. `WorldPresentationRuntime` отдельно владеет terrain/floor/wall/supplement/decoration/transport sprites и surface registries. Presentation монтируется первой и уничтожается последней; interaction unbind и candidate reset происходят до teardown owners. `WorldScene` создаёт эти два владельца, передаёт adapters/callbacks и делегирует lifecycle.

Геометрия Гнезда формируется в `src/world/nestWorldLayout.js` из одной модели острова для terrain render и collision. Геометрия арен Атолла формируется в `src/world/atollWorldLayout.js`. Домашний authoring остаётся привязан к capability `buildMode` локации `village`.

## Запрещённые преждевременные решения

Без отдельного доказанного use case не вводятся:

- ECS;
- глобальный event bus;
- универсальный editor framework;
- общий rewrite `WorldScene`;
- массовое перемещение файлов ради метрики;
- dependency только для уменьшения локального кода.

## Изменение архитектуры

Когда задача создаёт новый устойчивый owner:

1. код и targeted check появляются в том же PR;
2. соответствующий `systems/*.md` обновляется;
3. `LIBRARY.md` меняется только если появился новый адрес;
4. этот документ меняется только при межсистемном решении.
