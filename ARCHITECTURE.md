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
- interaction selection остаётся детерминированным контрактом.
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

Для `src/main.js` действует жёсткий предел `2900` строк, который устанавливает `scripts/check-architecture-boundaries.mjs`. Текущий файл остаётся ниже него. Это предохранитель: следующая содержательная функция должна сопровождаться локальным выделением, чтобы composition root не рос дальше.

## Следующие подтверждённые выделения

### Build и authoring

Следующая задача, добавляющая build/authoring behavior, должна вынести соответствующую world-facing orchestration из `WorldScene` в отдельный coordinator/runtime. Предпочтительный owner связывает:

- world sprites и topology;
- placement/move/demolition;
- profile collider и drag anchor;
- facilities/resources/build objects;
- authoring callbacks.

`BuildModeRuntime` продолжает владеть UI/input state. `WorldScene` только создаёт coordinator и вызывает его update/cleanup.

### Tavern service

`TavernServiceRuntime` координирует persisted multi-guest service и value-bearing coin runtime. `KitchenInteractionRuntime` делегирует fixed-facility mutations соответствующим domain/runtime owners. Расписание волн принадлежит `tavernServiceDomain.js`, маршруты и состояние визита — `guestRuntime.js`, рецепты/stock/reservations — `cookingDomain.js`, а `WorldScene` только связывает owners и callbacks.

Следующее расширение очереди, меню, staff или нескольких service stations развивает эти owners и не возвращает orchestration в `WorldScene`.

### Facilities и presentation

Facility runtime владеет объектом, collider и use lifecycle. Presentation pose не мутирует безопасную motor position. Camera получает presentation target через явный adapter. Sleep/wake и interaction candidate остаются отдельными контрактами.

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
