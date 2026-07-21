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
- collision resolver отделён от движения и использует collision foot box;
- игрок и NPC используют общую композиционную `Character`-сущность;
- player и patrol controllers возвращают общий нормализованный `ControllerCommand`, а `Character` передаёт им изолированный snapshot состояния;
- NPC spawn и patrol-маршруты задаются декларативно;
- layout мира, fullscreen, HUD, чистая математика ввода, `MobileJoystick` и `MovementDebugPanel` имеют отдельные модули;
- основные инварианты движения, collision, персонажей, мира, ввода, runtime-компонентов и визуального контракта покрыты проверками.

Существующий movement core следует сохранять и расширять эволюционно.

## Главный архитектурный риск

`WorldScene` уже освобождена от полного pointer lifecycle мобильного джойстика и DOM debug-панели, но продолжает координировать несколько независимых областей:

- preload и world rendering;
- создание и update персонажей;
- keyboard input;
- camera follow и integer zoom;
- fullscreen;
- Phaser HUD;
- browser lifecycle listeners и cleanup.

При текущем масштабе это допустимо. Перед добавлением диалогов, взаимодействий, нескольких типов NPC, противников и долгоживущего игрового состояния сцену следует разгружать дальше короткими самостоятельными runtime-компонентами.

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
- `MovementDebugPanel` — DOM, tuning inputs, reset/copy, persistence, status rendering и cleanup.

Следующие возможные границы:

- `GameHud` — build label, fullscreen UI, hit areas и cleanup;
- позднее `CharacterSystem` — registry и единый update персонажей.

`WorldScene` остаётся composition root: создаёт системы, связывает зависимости, вызывает update и уничтожает runtime-компоненты.

### 3. Явные actor profiles

Игровые параметры персонажа не должны выводиться скрытым делением значений игрока.

Нужны именованные профили, например `player`, `villager`, `guard`, `meleeEnemy`, `rangedEnemy`, с явными motor и visual параметрами. `PLAYER_SPEED` должен принадлежать actor/movement profile, а не world config.

### 4. Разделение locomotion, orientation и aim

Семантика состояния фиксируется так:

- `moveDirection` — команда перемещения;
- `velocity` — фактическое движение;
- `facingDirection` — continuous ориентация корпуса/визуала;
- `aimDirection` — направление целевой системы;
- преобразование continuous direction в `up/down/left/right` принадлежит visual layer.

Общий command contract уже переносит movement и aim независимо. Для разных персонажей позднее допускаются режимы ориентации `velocity`, `desired-movement`, `aim` и `locked`.

### 5. Collision environment вместо глобального world config

Collision functions должны получать границы и blocking query через объект среды, а не импортировать размеры единственной карты.

Минимальный контракт:

```js
{
  bounds: { left, top, right, bottom },
  isBlockedCell(x, y),
}
```

Текущий axis-separated substep resolver сохраняется, пока реальные dash, knockback или быстрые сущности не докажут необходимость другого разрешения столкновений.

### 6. Эволюция `Character`

Текущий `Character` допустим как компактный агрегат movement, collision, facing, animation и depth.

При появлении второго существенно отличающегося visual типа либо первой крупной capability он разделяется на:

- `CharacterMotor`;
- `CharacterVisual`;
- controller;
- опциональные capabilities, например interaction, combat и dialogue agents.

HP, диалоги, квесты, inventory, pathfinding и save logic не добавляются непосредственно в базовый `Character`.

### 7. Разделение определения и runtime мира

По мере роста контента текущий layout развивается в три уровня:

- `WorldDefinition` — данные слоёв, markers, spawn, collisions и zones;
- `WorldRuntime` — collision queries, triggers и entity registry;
- `WorldRenderer` — Phaser-представление и depth.

Переход на Tiled или LDtk выполняется только при подтверждённой проблеме ручного авторинга.

### 8. Сериализуемое игровое состояние

До полноценной системы сохранений должна появиться граница между model state и Phaser representation.

Долгоживущее состояние игрока, NPC, флагов, inventory, времени и текущего мира должно храниться в сериализуемом `GameSessionState`, а Phaser objects должны оставаться runtime-представлением.

### 9. Развитие AI

Patrol controller остаётся простым locomotion controller. Выбор цели, поведения и атаки принадлежит отдельному behavior/brain layer, который формирует общую команду персонажа.

Waypoint metadata, wait states, blocked recovery и route validation добавляются раньше полноценного pathfinding. A* не вводится без реальной необходимости сложной навигации.

### 10. Проверки архитектурных инвариантов

Чистые unit и contract tests предпочтительнее regex-проверок текста исходников. Текстовые guards допустимы как временная защита, но не должны блокировать корректную декомпозицию или фиксировать случайную форму реализации.

Встроенный `node:test` предпочтителен новой test dependency. Browser-level framework добавляется только после появления достаточного количества UI, scene transition и mobile runtime рисков.

## Реализованные шаги

1. Введён общий `ControllerCommand` с movement, aim и actions.
2. Player и patrol controllers переведены на общий command contract и изолированный snapshot контекста.
3. `MobileJoystick` выделен из `WorldScene` с полным lifecycle ownership.
4. `MovementDebugPanel` выделен из `WorldScene` с ownership DOM, persistence, clipboard и cleanup.
5. Выделенные runtime-компоненты подключены через `WorldScene` как composition root и покрыты contract checks.

## Приоритетная очередь

### Приоритет 1 — перед следующим крупным gameplay-функционалом

1. Перевести player/NPC movement values на явные actor profiles.
2. Отделить collision bounds/query от глобального `worldConfig`.
3. Удалить подтверждённые legacy exports/imports и неиспользуемую старую room-конфигурацию.

### Приоритет 2 — при добавлении взаимодействий и разных персонажей

1. Разделить `CharacterMotor` и `CharacterVisual`.
2. Ввести `CharacterSystem` и registry по stable entity ID.
3. Добавить `GameSessionState`.
4. Разделить world definition, runtime и renderer.
5. Добавить interaction и trigger system.

### Приоритет 3 — при появлении реального AI и контента

1. Behavior state machines.
2. Patrol waypoint metadata и ожидания.
3. Route validation и blocked recovery.
4. Scene/world transitions.
5. Сериализация и сохранения.
6. Browser-level integration tests.

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

Общий `ControllerCommand`, изолированный controller snapshot, `MobileJoystick`, `MovementDebugPanel` и их composition-root интеграция реализованы и покрыты применимыми проверками. Actor profiles, collision environment, legacy cleanup и последующие приоритеты остаются roadmap.
