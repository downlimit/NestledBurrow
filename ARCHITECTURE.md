<!-- audience: lead-chat -->
# Архитектура NestledBurrow

## Назначение

`ARCHITECTURE.md` — канонический долгоживущий адрес для оценки runtime-архитектуры, принятых направлений её развития и очереди архитектурных улучшений.

Документ предназначен прежде всего для Lead-чата. Он описывает подтверждённое направление, но не выдаёт запланированную работу за уже опубликованную реализацию. Фактическое текущее состояние всегда проверяется по `main`, исходникам и `PROJECT.md`.

## Базовая оценка

Текущая архитектура соответствует стадии раннего игрового прототипа и не требует полной перестройки.

Удачные существующие границы:

- чистая математика velocity-based движения отделена от Phaser;
- параметры движения нормализуются централизованно;
- player и villager используют явные неизменяемые actor profiles, а runtime-конфигурации создаются отдельными mutable-копиями;
- collision resolver получает границы, cell size и blocking query через collision environment и не зависит от глобального world config;
- `CharacterMotor` владеет movement/controller/collision состоянием без Phaser, а `CharacterVisual` владеет sprite/facing/animation/depth;
- `CharacterSystem` предоставляет стабильный ID registry, ordered update и runtime-free snapshots;
- player и patrol controllers возвращают общий нормализованный `ControllerCommand`, а motor передаёт им изолированный snapshot состояния;
- NPC spawn, actor profile ID и patrol-маршруты задаются декларативно;
- минимальный `GameSessionState` сериализуется в JSON и не содержит Phaser/runtime ссылок;
- interaction targeting является чистой детерминированной функцией над snapshots и неизменяемыми descriptors;
- layout мира, fullscreen, HUD, чистая математика ввода, `MobileJoystick` и `MovementDebugPanel` имеют отдельные модули;
- основные инварианты движения, collision environment, персонажей, session state, interaction targeting, мира, ввода, runtime-компонентов и визуального контракта покрыты проверками.

Существующий movement core следует сохранять и расширять эволюционно.

## Главный архитектурный риск

`WorldScene` уже освобождена от полного pointer lifecycle мобильного джойстика, DOM debug-панели и прямого цикла update персонажей, но продолжает координировать несколько независимых областей:

- preload и world rendering;
- создание и связывание runtime-систем;
- keyboard input;
- camera follow и integer zoom;
- fullscreen;
- Phaser HUD;
- browser lifecycle listeners и cleanup.

При текущем масштабе это допустимо. Перед добавлением полноценного диалога, нескольких миров и долгоживущего игрового состояния сцену следует разгружать дальше короткими самостоятельными runtime-компонентами.

## Принятые архитектурные направления

### 1. Команда персонажа вместо одного вектора

Контроллер возвращает структурированную команду персонажа:

```js
{
  moveDirection: { x, y },
  aimDirection: { x, y } | null,
  actions: {
    interact: false,
    primary: false,
    secondary: false,
  },
}
```

Это закрепляет независимость locomotion, orientation, aim и будущих действий. Player и patrol controllers уже используют один контракт; будущие enemy controllers должны использовать его же. Контроллер получает изолированный snapshot контекста вместо mutable `Character`.

### 2. Разгрузка `WorldScene`

Из сцены уже выделены:

- `MobileJoystick` — pointer ownership, capture/fallback, Phaser-графика, direction state и cleanup;
- `MovementDebugPanel` — DOM, tuning inputs, reset/copy, persistence, status rendering и cleanup;
- `CharacterSystem` — stable-ID registry, ordered update, lookup, snapshots и lifecycle персонажей.

Следующая возможная граница:

- `GameHud` — build label, fullscreen UI, hit areas и cleanup.

`WorldScene` остаётся composition root: создаёт системы, связывает зависимости, вызывает update и уничтожает runtime-компоненты.

### 3. Явные actor profiles

Игровые параметры персонажа не выводятся скрытым делением runtime-значений игрока.

Введены именованные неизменяемые профили `player` и `villager` с явными movement и visual параметрами, стабильными ID и строгим lookup. `DEFAULT_MOVEMENT_CONFIG` ссылается на канонический player profile, а villager runtime config создаётся независимо. Будущие `guard`, `meleeEnemy` и `rangedEnemy` должны расширять тот же контракт.

### 4. Разделение locomotion, orientation и aim

Семантика состояния фиксируется так:

- `moveDirection` — команда перемещения;
- `velocity` — фактическое движение;
- `facingDirection` — continuous ориентация корпуса/визуала;
- `aimDirection` — направление целевой системы;
- преобразование continuous direction в `up/down/left/right` принадлежит visual layer.

Общий command contract уже переносит movement и aim независимо. Для разных персонажей позднее допускаются режимы ориентации `velocity`, `desired-movement`, `aim` и `locked`.

### 5. Collision environment вместо глобального world config

Collision functions получают среду через явный контракт и не импортируют размеры единственной карты:

```js
{
  bounds: { left, top, right, bottom },
  cellSize,
  isBlockedCell(x, y),
}
```

Production layout реализует этот контракт, а resolver поддерживает среды с другим origin, размером и cell size. Текущий axis-separated substep resolver сохраняется, пока реальные dash, knockback или быстрые сущности не докажут необходимость другого разрешения столкновений.

### 6. `CharacterMotor`, `CharacterVisual` и aggregate

`Character` теперь является компактным aggregate:

- `CharacterMotor` хранит position, movement state/config, controller, collision footprint и blocked axes без Phaser;
- `CharacterVisual` хранит sprite, cardinal facing, animation, idle frames и depth;
- `Character` связывает их, сохраняя совместимые getters и последовательность motor update → visual update;
- `CharacterSystem` управляет registry и общим update.

HP, диалоги, квесты, inventory, pathfinding и save logic не добавляются непосредственно в motor или visual. Они принадлежат отдельным capabilities, agents или session-модели.

### 7. Разделение определения и runtime мира

По мере роста контента текущий layout развивается в три уровня:

- `WorldDefinition` — данные слоёв, markers, spawn, collisions и zones;
- `WorldRuntime` — collision queries, triggers и entity registry;
- `WorldRenderer` — Phaser-представление и depth.

Переход на Tiled или LDtk выполняется только при подтверждённой проблеме ручного авторинга.

### 8. Сериализуемое игровое состояние

Введён минимальный JSON-сериализуемый `GameSessionState` с version, current world, player/entity IDs, global/entity flags и состоянием диалога. Он не хранит Phaser objects, functions, Maps/Sets или runtime references.

Следующий шаг — создать session state в composition root и явно синхронизировать только долгоживущие model-изменения. Position и прочее frame-level runtime состояние не копируется в session без подтверждённой необходимости сохранения.

### 9. Interaction targeting

Interaction descriptor является неизменяемым JSON-like объектом с ID, entity ID, kind, position, radius, prompt, priority, facing policy и payload.

Чистая функция выбирает лучшую доступную цель по:

1. availability и radius;
2. facing policy;
3. priority;
4. distance;
5. стабильному ID tie-break.

Runtime-интеграция должна получать source/target snapshots из registry, показывать prompt и запускать session/dialogue operation, не помещая UI или Phaser refs в interaction model.

### 10. Развитие AI

Patrol controller остаётся простым locomotion controller. Выбор цели, поведения и атаки принадлежит отдельному behavior/brain layer, который формирует общую команду персонажа.

Waypoint metadata, wait states, blocked recovery и route validation добавляются раньше полноценного pathfinding. A* не вводится без реальной необходимости сложной навигации.

### 11. Проверки архитектурных инвариантов

Чистые unit и contract tests предпочтительнее regex-проверок текста исходников. Текстовые guards допустимы как временная защита, но не должны блокировать корректную декомпозицию или фиксировать случайную форму реализации.

Встроенный `node:test` предпочтителен новой test dependency. Browser-level framework добавляется только после появления достаточного количества UI, scene transition и mobile runtime рисков.

## Реализованные шаги

1. Введён общий `ControllerCommand` с movement, aim и actions.
2. Player и patrol controllers переведены на общий command contract и изолированный snapshot контекста.
3. `MobileJoystick` выделен из `WorldScene` с полным lifecycle ownership.
4. `MovementDebugPanel` выделен из `WorldScene` с ownership DOM, persistence, clipboard и cleanup.
5. Выделенные runtime-компоненты подключены через `WorldScene` как composition root и покрыты contract checks.
6. Введены явные immutable actor profiles `player` и `villager`; production и debug movement configs больше не выводятся неявно из mutable player runtime state.
7. Collision resolver переведён на явный environment contract с bounds, cell size и blocking query; глобальные размеры мира удалены из resolver.
8. Подтверждённая legacy room-конфигурация и неиспользуемые Kenney environment atlases удалены; Basic Village остаётся каноническим окружением.
9. `Character` разделён на runtime-free `CharacterMotor` и Phaser `CharacterVisual`, сохранив aggregate compatibility layer.
10. Введён `CharacterSystem` со stable-ID registry, ordered update, lookup, snapshots и lifecycle ownership.
11. Введён минимальный JSON-сериализуемый `GameSessionState` с entity/flag/dialogue operations.
12. Введены immutable interaction descriptors и чистый детерминированный выбор лучшей цели.

## Приоритетная очередь

### Приоритет 1 — следующий вертикальный срез взаимодействия

1. Подключить `GameSessionState` к composition root и зарегистрировать текущих NPC как session entities.
2. Сформировать runtime interaction targets из NPC config или отдельного interaction config.
3. Добавить interaction input, prompt и запуск короткого диалога через существующие pure operations.
4. Ввести минимальную dialogue presentation boundary без хранения DOM/Phaser refs в session state.
5. Добавить integration checks для approach → target → prompt → dialogue lifecycle.

### Приоритет 2 — рост мира и контента

1. Разделить world definition, runtime и renderer.
2. Добавить zones/triggers и переходы между мирами.
3. Синхронизировать сериализуемое session state с сохранением/загрузкой.
4. Behavior state machines.
5. Patrol waypoint metadata и ожидания.
6. Route validation и blocked recovery.
7. Browser-level integration tests.

## Ограничения

До появления подтверждённой необходимости не вводятся:

- полноценный ECS;
- глобальный event bus для любой коммуникации;
- dependency injection framework;
- массовая миграция на TypeScript;
- Phaser Physics вместо текущего movement/collision core;
- A* pathfinding;
- Tiled или LDtk;
- крупный механический перенос всей структуры каталогов одним PR.

Архитектура развивается через короткие функциональные PR. Параллельные задачи владеют разными путями, а изменения центральных entry points выполняются отдельным fan-in integration task.

## Текущий implementation status

Общий `ControllerCommand`, изолированный controller snapshot, `MobileJoystick`, `MovementDebugPanel`, явные actor profiles, collision environment, legacy room cleanup, motor/visual split, `CharacterSystem`, минимальный `GameSessionState` и pure interaction targeting реализованы и покрыты применимыми проверками. Следующая очередь — runtime wiring interaction/dialogue и дальнейшее разделение world definition/runtime/renderer.
