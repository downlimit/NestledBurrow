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

## `src/main.js` — только composition root

Разрешённые обязанности `WorldScene`:

- preload;
- создание owners;
- передача callbacks и dependencies;
- порядок update/delegation;
- lifecycle cleanup;
- сборка E2E bridge из готовых owners.

В `src/main.js` нельзя добавлять новую domain logic, самостоятельную state machine, сериализацию, placement algorithm, editor workflow или крупную presentation subsystem.

Для `src/main.js` действует жёсткий предел `1520` строк, который устанавливает `scripts/check-architecture-boundaries.mjs`. Текущий файл остаётся ниже него. Это предохранитель: следующая содержательная функция должна сопровождаться локальным выделением, чтобы composition root не рос дальше.

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

`TavernServiceRuntime` координирует persisted multi-guest service и value-bearing coin runtime. `KitchenInteractionRuntime` делегирует fixed-facility mutations соответствующим domain/runtime owners. Расписание волн принадлежит `tavernServiceDomain.js`, маршруты и состояние визита — `guestRuntime.js`, рецепты/stock/reservations — `cookingDomain.js`, а `WorldScene` только связывает owners и callbacks.

Следующее расширение очереди, меню, staff или нескольких service stations развивает эти owners и не возвращает orchestration в `WorldScene`.

### Facilities и presentation

Facility runtime владеет объектом, collider и use lifecycle. Presentation pose не мутирует безопасную motor position. Camera получает presentation target через явный adapter. Sleep/wake и interaction candidate остаются отдельными контрактами.

`InteractionApproachResolver` owns collision-valid perimeter use points and bounded route selection for every interaction candidate. `InteractionTimelineRuntime` owns transient enter/active/exit phases and pose interpolation. `ToiletAccidentTimelineRuntime` owns the unskippable shake/recovery sequence and puddle hook. `NeedsInteractionCoordinator` binds these phases to facility, sleep and protected-need outputs. `NeedsFlowRuntime` measures actual N/E/S/T/L/D value deltas for HUD direction and tier without action labels. These owners are not serialized; `WorldScene` only constructs them, delegates update and routes callbacks.

### World interaction execution

`InteractionRuntime` владеет candidate targeting, facing/approach selection, dialogue lifecycle и presenter protocol. `WorldInteractionCoordinator` агрегирует static world definitions, применяет общие availability gates и детерминированно исполняет недиалоговые действия в порядке merchant, farming, tavern sign, facility, bed, busy gate, exhausted wake, resource.

Координатор хранит только transient resource cooldown/activity state и делегирует мутации существующим merchant, farming, kitchen, needs, facility, debris и tavern-sign owners. Location lifecycle явно rebind-ит эти owners после mount и отвязывает до teardown. `WorldScene` создаёт coordinator один раз на scene/session, передаёт ограниченные callbacks, подключает его к `InteractionRuntime` и читает cooldown/activity snapshots.

### Локации мира

`worldLocationConfig.js` задаёт постоянные ID, capabilities, транспорты и spawn-контракты. `WorldLocationCoordinator` выбирает активный layout, синхронизирует `sessionState.currentWorldId`, управляет transition lock и вызывает location lifecycle. `worldLocationLifecycle.js` монтирует и уничтожает домашние runtime-системы по capability активной локации. `WorldScene` создаёт эти owners и делегирует им порядок переключения.

Геометрия Гнезда формируется в `nestWorldLayout.js` из одной модели острова для terrain render и collision. Домашний authoring остаётся привязан к capability `buildMode` локации `village`.

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
