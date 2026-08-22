<!-- audience: lead-chat -->
# Архитектура NestledBurrow

## Принцип

Проект развивается небольшими игровыми slices. Универсальная граница появляется после реального повторяющегося use case, но уже подтверждённые owners не обходятся ради скорости.

Системные контракты описаны в `systems/*.md`; этот документ хранит только межсистемные решения и ограничения.

## Устойчивые границы

- character motor, visual и controller разделены;
- input и mobile joystick возвращают команды, а не владеют gameplay state;
- needs, resources, cooking и guest flow имеют domain/runtime owners;
- persistent population state, его нормализация и coarse offscreen-реконструкция принадлежат `src/character/populationDomain.js`; shared household money, family reconciliation и coarse household cashflow принадлежат `src/character/householdEconomyDomain.js`; session только сохраняет, загружает и вызывает этих владельцев;
- session save JSON-safe и versioned;
- developer authoring отделён от gameplay save;
- HUD, world/UI camera split, audio и build UI имеют lifecycle owners;
- interaction selection остаётся детерминированным контрактом; collision-valid use position и visual aim position разделены, а общая extractable-группа ресурсов и растений ранжируется по направлению взгляда до локальной дистанции;
- `WorldLocationCoordinator` владеет реестром локаций, атомарным переключением layout/camera/motor и location-specific lifecycle;
- повторно используемый world-entity type имеет одного runtime owner и один presentation adapter во всех локациях. Location config передаёт owner только stable ID, placement и location capability; authoring регистрирует экземпляр у того же owner. Отдельные location-specific visuals, targeting, hit feedback и teardown для общего типа запрещены;
- Дикий Атолл имеет отдельный transport-free world layout (`src/world/atollWorldLayout.js`), topology/resource-placement rules (`src/world/wildAtollDomain.js`) и transient arena presentation/input (`src/world/wildAtollRuntime.js`); его arena state не сериализуется;
- применение предметов из numbered combat slots разделяет UI activation (`src/combat/combatLoadoutRuntime.js`) и мутацию item/needs (`src/inventory/combatQuickUse.js`).

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

### Persistent population

`src/character/populationDomain.js` владеет созданием устойчивых person identities, полным canonical need state, ручной мутацией одной потребности с rebased evaluation time, стабильными budget/preference profiles и детерминированной coarse-реконструкцией по прошедшему world time. `src/character/personInspectionRuntime.js` — отдельный presentation/input owner live person binding, hover/touch lifecycle, card geometry и need-bar hit zones; общую NESTLD-отрисовку игрока и NPC предоставляет `src/ui/needsPanelPresentation.js`. Inspector вызывает публичную population mutation и не владеет visit/order state. `src/session/gameSessionState.js` и `src/session/sessionPersistence.js` вызывают публичные функции owner для JSON-safe state и schema migration, не размещая у себя population formulas.

`src/character/householdEconomyDomain.js` отдельно владеет person→household assignment, реальными семейными монетами, переносом/разделением денег при изменении семьи, coarse daily income/expenses, reserve pressure и денежными reservations. Он потребляет family/life-stage/wealth state population owner, но не владеет отношениями, профессиями, tavern orders или player coins. `src/session/gameSessionState.js` нормализует и продвигает этот owner через его публичный API; tavern вызывает только reserve/release/settle/available-money contracts.

Tavern, social и profession systems могут позже потреблять один и тот же persisted person state через эти owners. Они не создают собственную population, need vocabulary, offscreen evaluation или альтернативный household wallet.

### Build и authoring

`WorldBuildCoordinator` владеет player-facing world mutation и transient build-session state:

- world sprites и topology;
- placement/move/demolition;
- profile collider и drag anchor;
- facilities/resources/build objects;
- grouped undo, preview и demolition highlight;
- публичный API для authoring и E2E bridge.

`BuildModeRuntime` продолжает владеть UI/input state и создаётся координатором на Phaser rendering host. Его BUILD и TEST являются двумя transient представлениями одной панели; `src/build/simulationTestPalette.js` содержит малую presentation-группировку canonical inventory IDs и grant-функции, использующие inventory owner. Facilities, resources/beds, wells/farming, tavern sign и training dummy сохраняют собственные runtime states; координатор только маршрутизирует их мутации через явно переданные adapters. `WorldScene` создаёт координатор, передаёт layout, profiles, runtime owners и ограниченные callbacks, затем делегирует location cleanup. Authoring owners используют публичные методы координатора без доступа к его внутренним `Map`, undo stack и preview state.

### Tavern service

`TavernServiceRuntime` координирует persisted person-backed service, opportunity timer, visitor history, capability-based service-place/facility claims, value-bearing coin runtime и дочерний runtime активного меню. Он вызывает публичную offscreen evaluation population owner ровно для выбранного кандидата и публичный household economy owner для проверки свободных денег, reservation и settlement; собственный денежный баланс NPC внутри tavern запрещён. `src/tavern/tavernFeedbackDomain.js` владеет сохраняемыми person↔venue opinions, их world-time decay, descriptive sale-tag/service-reliability reputation, reputation-biased candidate stream с non-zero discovery, bounded flow pressure/cadence и severity-ordered closure/open-unserved/accepted-failure outcomes. `src/tavern/visitDemandDomain.js` владеет food motive, budget/taste/recency формулой и decision breakdown, принимая вычисленные feedback factors и доступный household balance; `src/tavern/visitPartyDomain.js` владеет возрастным весом естественного кандидата и составом семейных/подростковых групп; `src/tavern/saleProfileDomain.js` — canonical price/tag profiles; `src/tavern/orderDomain.js` — JSON-safe exact order, таймеры и допустимые переходы; `src/tavern/guestIntentDomain.js` — deterministic live N/E/S/T/L/D advancement, hysteresis, interruption/takeout/satisfaction policy. Таймер/history/snapshot normalization принадлежат `src/tavern/tavernServiceDomain.js`, live routes/resume orchestration — `src/tavern/guestRuntime.js`, recipes/stock/reservations — `src/tavern/cookingDomain.js`, character-anchored overhead channels с одним linearly filtered 6× CanvasTexture image на animated channel и inverse-zoom screen sizing внутри общего 3× backing framebuffer — `src/tavern/overheadPresentationRuntime.js`, `venueOffer` — `src/tavern/venueOfferDomain.js`, panel presentation/input — `src/tavern/venueMenuRuntime.js`. `WorldScene` только связывает owners и callbacks.

Dynamic take-order interaction существует только для live guest со статусом `offered`; exact item reveal является результатом acceptance. Socially motivated guests также публикуют ordinary talk interaction только при доступном player state. `TavernServiceRuntime.getGuestInteractionDefinitions()` публикует read-only definitions и делегирует обе активации guest runtime. `WorldInteractionCoordinator` агрегирует и маршрутизирует эти kinds рядом с другими world actions, не хранит order/intent state и не вычисляет tavern rules.

Следующее расширение очереди, staff или нескольких service stations развивает эти owners и не возвращает orchestration в `WorldScene`.

### Facilities и presentation

Facility runtime владеет объектом, collider и use lifecycle. Presentation pose не мутирует безопасную motor position. Camera получает presentation target через явный adapter. Sleep/wake и interaction candidate остаются отдельными контрактами.

`InteractionApproachResolver` owns collision-valid perimeter use points and bounded route selection for every interaction candidate. `InteractionTimelineRuntime` owns transient enter/active/exit phases and pose interpolation. `ToiletAccidentTimelineRuntime` owns the unskippable shake/recovery sequence and puddle hook. `NeedsInteractionCoordinator` binds these phases to facility, sleep and protected-need outputs. `NeedsFlowRuntime` measures actual N/E/S/T/L/D value deltas for HUD direction and tier without action labels. These owners are not serialized; `WorldScene` only constructs them, delegates update and routes callbacks.

### Combat loadout quick use

`CombatLoadoutRuntime` owns only numbered-slot activation, pointer/keyboard gating, presentation refresh and feedback dispatch. `LoadoutDragCoordinator` decides click versus drag before forwarding activation. `src/inventory/combatQuickUse.js` owns supported item profiles and atomic mutation of the selected combat slot, bucket water and target need.

Quick use is available only in stable `COMBAT`; Alt, panel transition, modal suppression and editable input disable it. Drag completion cannot also execute self-use. Adding an item profile must preserve the existing inventory item identity and define its exact consumption and need mutation in `src/inventory/combatQuickUse.js`. Successful water-bucket use also applies `-5 T` and reports self-use to `NeedsRuntime` under its own repetition key; only after the owning mutation succeeds does `CombatLoadoutRuntime` spawn a transient puddle at the player's cell through the location puddle owner.

### Дикий Атолл: первый runtime slice

`src/world/atollWorldLayout.js` owns a rectangular collision environment with blocked outer boundary and no static transports. `src/world/wildAtollDomain.js` owns segment/arena identity, the forward-only `1/2/2/2/1` starter graph, exit semantics and deterministic definitions for actual resources. `src/world/wildAtollRuntime.js` owns the northern Nest entrance and one transient run inside `WORLD_IDS.atoll`: arena choice, short path presentation, terminal Forest/Mines entrances, the white Nest teleport and blackout return after collapse.

Atoll logs, stones and berries are registered with the location `DebrisRuntime`. Target selection, outline, HP, cooldown, hit feedback, energy pricing, inventory reward and teardown remain in the same resource/interaction owners used in the Burrow and Nest. `wildAtollRuntime` may register/unregister transient definitions; it may not implement its own resource-hit loop.

Nest entry and terminal return call `WorldLocationCoordinator.transitionTo` with explicit safe spawns. Internal arena movement is one-way transient topology, not a location transition and not persisted. Collapse begins ordinary exhausted sleep at visible scale `1`, then simulates the remaining ordinary clock/needs progression behind black before returning to Nest. Future T1/T2 segments extend the same graph/resource boundaries and do not create a second location coordinator.

### World interaction execution

`InteractionRuntime` владеет candidate targeting, facing/approach selection, dialogue lifecycle и presenter protocol. `WorldInteractionCoordinator` агрегирует static world definitions, применяет общие availability gates и детерминированно исполняет недиалоговые действия в порядке merchant, farming, tavern sign, facility, bed, busy gate, exhausted wake, resource.

Координатор хранит только transient resource cooldown/activity state и делегирует мутации существующим merchant, farming, kitchen, needs, facility, debris и tavern-sign owners. `WorldLocationRuntime` явно rebind-ит эти owners после mount и отвязывает до teardown. `WorldScene` создаёт coordinator один раз на scene/session, передаёт ограниченные callbacks, подключает его к `InteractionRuntime` и читает cooldown/activity snapshots.

### Локации мира

`src/world/worldLocationConfig.js` задаёт постоянные ID, capabilities, транспорты и spawn-контракты. `WorldLocationCoordinator` выбирает активный layout, синхронизирует `sessionState.currentWorldId`, управляет transition lock, поддерживает explicit transport-free transitions и вызывает публичный location lifecycle.

`WorldLocationRuntime` один раз создаётся на scene/session, получает явные dependencies и factories, затем владеет location-scoped owners, capability-driven mount/unmount, frame-action/realtime/world-step порядком, candidate consumers и transition guard. Его `getOwners()` возвращает read-only snapshot с именованными полями; string service locator и поиск по полям `WorldScene` запрещены. `WorldPresentationRuntime` отдельно владеет terrain/floor/wall/supplement/decoration/transport sprites и surface registries. Presentation монтируется первой и уничтожается последней; interaction unbind и candidate reset происходят до teardown owners. `src/world/puddleRuntime.js` — ещё один location-scoped owner: transient высыхающие лужи от bucket self-use и toilet accident, один runtime и один presentation path, без collision/input/persistence. `WorldScene` создаёт эти владельцы, передаёт adapters/callbacks и делегирует lifecycle.

Геометрия Гнезда формируется в `src/world/nestWorldLayout.js` из одной модели острова для terrain render и collision. Геометрия арен Атолла формируется в `src/world/atollWorldLayout.js`. Домашний authoring остаётся привязан к capability `buildMode` локации `village`.

## Архитектурные точки давления

Это условные триггеры для последующих задач, а не отдельный backlog общего рефакторинга. Каждое техническое ТЗ объявляет `Architecture pressure: none` либо называет затронутый owner, сработавший триггер и локальное выделение, выполняемое в том же PR. Нельзя принять триггер и оставить его отдельным неопределённым follow-up.

### `src/main.js`

Изменение authoring workflow, sleep/time orchestration, frame-input arbitration или autosave cadence не расширяет соответствующую state machine внутри `WorldScene`. Затронутый workflow выделяется в owner/coordinator в той же задаче. Соблюдение лимита строк само по себе не доказывает корректную границу.

### `src/build/worldBuildCoordinator.js`

Новый entity-specific lifecycle `place → move → remove → restore` внутри координатора запрещён. Объект остаётся у своего runtime owner и подключается через placeable protocol/adapters. Встроенный lifecycle колодцев является принятой точкой давления: следующая задача, меняющая размещение, перенос, снос колодцев или farming/build integration, переносит его в farming/resources owner в том же PR. Структурные стены, поверхности, preview и grouped undo остаются обязанностью build coordinator.

### `src/world/worldLocationRuntime.js`

Runtime может выбирать factories, монтировать и уничтожать owners, задавать update order, rebind и проверять capabilities. Gameplay formulas, item recipes, economy/progression rules, encounter state, persistence normalization и presentation algorithms получают локального системного owner; добавлять их в location composition root запрещено.

### Новые системные адреса

Первое содержательное расширение боя за пределы текущего melee/loadout slice создаёт отдельный combat system contract и маршрут в `LIBRARY.md`. Подтверждённое межсистемное расширение экономики семейными деньгами принадлежит `src/character/householdEconomyDomain.js`; дальнейшие профессии, зарплаты и другие источники денег подключаются к этому owner через явные операции, а не создают параллельные кошельки в tavern/resources/build. Новые выделения не выполняются заранее без соответствующего use case.

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
