# Task #015 — Оживить сон, часы и суточный цикл

## Task identity

- Task: `Task #015 — Оживить сон, часы и суточный цикл`
- Work branch: `task/015-live-sleep-clock-cycle`
- PR title: `Task #015 — Оживить сон, часы и суточный цикл`

Task number не меняется при repair, rebase или повторной приёмке.

## Integration metadata

- Batch: `standalone`
- Base SHA: получить актуальный `main` непосредственно перед запуском
- Depends on: `Task #014 — Расширить цикл расчистки и сна`
- Merge phase: `1`
- Owned paths:
  - `src/gameClock.js`
  - `src/dayNightRuntime.js`, только если отдельный runtime упрощает код
  - `src/main.js`
  - `src/gameSessionState.js`
  - `src/debrisConfig.js`
  - `src/debrisRuntime.js`
  - `src/gameHud.js`
  - `src/interactionHud.js`
  - `src/gameplayDebugTuning.js`
  - `src/movementDebugPanel.js`
  - `public/locales/ru/hud.json`
  - `public/locales/en/hud.json`
  - релевантные `scripts/check-*.mjs`
  - `tests/e2e/localized-loop.spec.js`
- Shared files allowed only when required:
  - `src/characterSystem.js`
  - `src/character.js`
  - `src/controllers.js`
- Forbidden paths:
  - `.github/**`
  - `PROJECT.md`
  - `LEAD.md`
  - `REVIEW.md`
  - `GAME.md`
  - `ROADMAP.md`
  - другие `tasks/**`
  - pipeline/Codex auto-repair files

## Git lifecycle

- Base branch: current `main`
- Direct push to `main`: `no`
- Remote branches allowed: `1`
- Work branch: `task/015-live-sleep-clock-cycle`
- Lifecycle: `ephemeral`
- Create PR: `yes`, ровно один финальный non-draft PR
- Delete task branch after merge: `yes`

## Goal

Сон должен ощущаться как ускорение всего живого мира, а не только цифр. После пробуждения игрок сразу может двигаться. Время отображается локализованными часами, сутки длятся ровно 18 реальных минут, мир плавно темнеет и светлеет. На карте появляются две постоянные рубиновые жилы. Подписи взаимодействий становятся короткими и единообразными.

## Read before editing

Прочитать:

- прямой prompt;
- `AGENTS.md`;
- этот task file;
- только перечисленные релевантные source/test files.

Не читать процессные Markdown без отдельной технической необходимости.

## Current defects

1. `startSleeping()` помещает игрока внутрь заблокированного тайла кровати, а `wakeUp()` не переносит его на свободный тайл.
2. `sleepTimeScale` ускоряет только числовой clock. `characterSystem`, NPC patrol и walk animation продолжают жить с обычным delta.
3. HUD показывает сырые секунды и множитель времени вместо часов.
4. Подпись бревна визуально длинная и несогласованная с остальным интерфейсом.
5. Дня/ночи и рубинов в мире нет.

## Requirements

### 1. Безопасное пробуждение

- `BED_OBJECT` остаётся на тайле `32,14`.
- Ввести стабильный `BED_WAKE_TILE = { x: 32, y: 15 }` и позицию его центра.
- До использования подтвердить, что wake tile внутри дома, не заблокирован и доступен обычному движению.
- Ручное и автоматическое пробуждение используют один `wakeUp()` path.
- При пробуждении:
  - `sleeping = false`;
  - simulation scale возвращается к `1`;
  - игрок переносится на `BED_WAKE_TILE`;
  - velocity и накопленное движение сбрасываются;
  - facing получает стабильное значение;
  - interaction candidate обновляется;
  - состояние сохраняется.
- Нажатие, разбудившее игрока, не должно тут же снова уложить его спать.
- Не удалять collision кровати и не делать кровать проходимой.

### 2. Канонический игровой clock

Создать маленький чистый модуль, например `src/gameClock.js`.

Константы:

- `SECONDS_PER_DAY = 86400`;
- `DEFAULT_START_TIME_SECONDS = 21600`, то есть `06:00`;
- `DEFAULT_REAL_SECONDS_PER_GAME_DAY = 1080`, то есть 18 реальных минут;
- `DEFAULT_GAME_SECONDS_PER_REAL_SECOND = 80`;
- эквивалентно `4/3` игровой минуты за одну реальную секунду;
- `DEFAULT_SLEEP_SIMULATION_SCALE = 8`.

Точное соотношение обязательно:

```text
24 игровых часа = 18 реальных минут
1 игровой час = 45 реальных секунд
1 реальная секунда = 80 игровых секунд
```

Использовать один persistent field:

- `worldTimeSeconds` — монотонное количество игровых секунд;
- для отображения брать `worldTimeSeconds % SECONDS_PER_DAY`;
- не держать одновременно два независимых активных clock.

Backward compatibility:

- старые сохранения Task #014 содержат `elapsedGameSeconds`;
- если `worldTimeSeconds` отсутствует, мигрировать:

```text
worldTimeSeconds = DEFAULT_START_TIME_SECONDS + elapsedGameSeconds * 80
```

- энергия, древесина и прогресс всех 43 бревен сохраняются;
- старое поле можно принимать при загрузке, но новый save использует каноническую модель;
- состояние остаётся JSON-safe;
- `NEW GAME` начинает мир в `06:00`.

### 3. Согласовать расход энергии с новым темпом

Продуктовая гипотеза остаётся: полный запас в 100 энергии должен длиться примерно 16 игровых часов при обычном бодрствовании.

При скорости 80 игровых секунд за реальную секунду:

```text
16 игровых часов = 720 реальных секунд
100 энергии / 720 секунд = 1 энергия каждые 7.2 реальной секунды
```

Поэтому:

- изменить default `awakeDrainIntervalSeconds` с `5` на `7.2`;
- `awakeDrainAmount` оставить `1`;
- удар по объекту по-прежнему стоит `4` энергии;
- сон и регенерацию не ускорять второй раз;
- добавить проверку, что 100 энергии без других действий заканчиваются примерно через 16 игровых часов с допустимой погрешностью дискретного drain.

### 4. Формат часов

RU:

- `00:00`;
- `06:05`;
- `12:45`;
- `23:59`;
- всегда `HH:mm`;
- 24-часовой формат;
- часы и минуты с ведущим нулём.

EN:

- `12:00 AM`;
- `6:05 AM`;
- `12:45 PM`;
- `11:59 PM`;
- `h:mm AM/PM`;
- у часа нет ведущего нуля;
- `AM` и `PM` всегда прописными.

Пограничные переходы:

- `11:59 AM → 12:00 PM`;
- `11:59 PM → 12:00 AM`;
- `23:59 → 00:00`.

Рядом с часами запрещены:

- `T`;
- `В`;
- `Time`;
- `Время`;
- `s` или `с`;
- `x1`, `x8` и другие множители;
- количество секунд.

Переключение RU/EN немедленно меняет формат без restart сцены.

### 5. Один world simulation scale

В `WorldScene` должен существовать один владелец simulation scale.

Каждый update вычисляет:

- `realDeltaMs` — настоящий Phaser delta;
- `simulationScale = sleeping ? sleepTimeScale : 1`;
- `worldDeltaMs = realDeltaMs * simulationScale`.

Использование:

- clock advance = `realSeconds * 80 * simulationScale`;
- `characterSystem` и текущие world simulation systems получают `worldDeltaMs`;
- NPC patrol movement ускоряется x8 во сне;
- NPC walk animation playback ускоряется x8 и возвращается к x1 после пробуждения;
- игрок во сне неподвижен, потому что input заблокирован;
- awake mode работает с scale `1`.

Не использовать общий Phaser global timeScale для:

- HUD;
- pointer/keyboard input;
- localization;
- audio;
- autosave interval;
- UI messages;
- NEW GAME modal;
- sleep overlay.

Autosave считает реальные секунды. `sleepEnergyRegenPerSecond` также считается по реальному времени и не умножается на x8 второй раз.

Не разбрасывать `sleeping ? 8 : 1` по разным системам.

### 6. Единый формат interaction prompt

Текущая подпись бревна слишком длинная и визуально несобранная. Ввести единый formatter для коротких action prompts.

Desktop keyboard format:

```text
SPACE · Рубить
SPACE · Спать
SPACE · Добыть

SPACE · Chop
SPACE · Sleep
SPACE · Mine
```

Touch/coarse-pointer format:

```text
Рубить
Спать
Добыть

Chop
Sleep
Mine
```

Правила регистра:

- название клавиши/аббревиатура — только прописными: `SPACE`;
- действие — sentence case, первая буква прописная, остальные обычные;
- не использовать `Space`, `space`, `SPACE  Рубить`, квадратные скобки или длинную поясняющую фразу;
- между клавишей и действием ровно разделитель ` · `;
- RU prompt бревна изменить с `Разрубить` на короткое `Рубить`;
- EN prompt бревна оставить коротким `Chop`;
- ruby prompt: `Добыть` / `Mine`;
- bed prompt: `Спать` / `Sleep`;
- применить тот же formatter к обычным world-action prompts, чтобы формат не зависел от конкретного объекта;
- dialogue continuation не расширять без необходимости, но если он использует тот же formatter, регистр и разделитель должны быть теми же.

Layout:

- prompt panel вычисляет ширину по фактическому тексту;
- не пересекается с краями viewport;
- integer coordinates и crisp rendering сохраняются;
- RU и EN выглядят визуально компактно;
- touch prompt не резервирует пустое место под `SPACE`.

### 7. Две рубиновые жилы

Добавить:

- `yard-ruby-01` на тайле `18,35`;
- `yard-ruby-02` на тайле `45,35`.

Перед созданием подтвердить через world layout, что тайлы и соседние позиции доступны. Закрепить проверкой.

Каждая жила:

- находится снаружи;
- блокирует тайл до уничтожения;
- имеет стабильный ID;
- имеет deterministic interaction priority;
- требует facing;
- показывает простой красно-малиновый crystal visual через Phaser Graphics;
- не требует внешнего ассета;
- выдерживает пять ударов;
- расходует четыре энергии за удар;
- при нехватке энергии ничего не меняет;
- выдаёт один рубин только на пятом ударе;
- не выдаёт древесину;
- освобождает collision после уничтожения;
- имеет hit/final feedback;
- сохраняет `remainingHits` и `cleared`;
- восстанавливается через `NEW GAME`.

Добавить `gameplay.rubies`:

- non-negative integer;
- default `0`;
- backward-compatible normalization;
- persistent save;
- `+1` только после окончательного разрушения жилы.

Допустим маленький typed gatherable descriptor для бревна и рубина, если он реально уменьшает дублирование. Не строить универсальную систему инвентаря, инструментов или руды.

### 8. HUD

HUD показывает:

- текущую/максимальную энергию;
- древесину;
- рубины;
- отдельную строку часов.

Часы содержат только форматированное время.

При `320×180` не пересекаются:

- NEW GAME;
- ресурсы;
- часы;
- звук;
- язык;
- fullscreen.

Сохранить integer coordinates, pixel rendering, RU/EN glyphs, desktop/mobile, window/fullscreen.

Не показывать sleep scale в production HUD.

### 9. Плавное освещение

Реализовать screen-space overlay над игровым миром и под HUD, dialogue, prompts, sleep indicator и modal.

- светло-синий multiply color около `0xA8C4E6`;
- максимальная ночная сила `0.55`;
- multiply blend mode или визуально эквивалентное умножение;
- overlay не окрашивает HUD.

Расписание:

- `05:00–08:00`: alpha плавно `0.55 → 0`;
- `08:00–18:00`: alpha `0`;
- `18:00–21:00`: alpha плавно `0 → 0.55`;
- `21:00–05:00`: alpha `0.55`.

Для переходов использовать smoothstep:

```text
t * t * (3 - 2 * t)
```

Требования:

- нет скачков на границах и в полночь;
- ночь остаётся читаемой и не становится чёрной;
- lighting зависит от `worldTimeSeconds`;
- во сне освещение ускоряется вместе с миром;
- overlay покрывает `320×180`.

### 10. Developer tuning

Сохранить существующие настройки и добавить:

- `realSecondsPerGameDay`, default `1080`, либо математически эквивалентный один канонический параметр;
- `nightTintStrength`, default `0.55`.

Не хранить одновременно несколько независимо редактируемых параметров, способных рассинхронизировать 18-минутные сутки.

Debug tuning хранится отдельно от gameplay save.

### 11. E2E bridge

Добавить только необходимые методы под `VITE_E2E`:

- `setWorldTimeSeconds(value)`;
- `getClockText()`;
- `getDayNightState()`;
- `getResourceState()`;
- `getRubyNodeState(id)`;
- `getCharacterSnapshot(id)`;
- безопасный deterministic wake helper при необходимости.

## Critical invariants

- 24 игровых часа равны ровно 18 реальным минутам при scale `1`;
- после сна игрок не находится внутри blocked cell;
- ручное и автоматическое пробуждение идентичны;
- сон не активируется повторно тем же нажатием;
- существует один clock и один simulation scale;
- scale применяется к миру ровно один раз;
- NPC ускоряются x8, UI/autosave/regen — нет;
- 100 энергии при idle awake drain хватает примерно на 16 игровых часов;
- все 43 бревна сохраняют ID и progress;
- старые saves не теряют прогресс;
- ruby reward не увеличивает wood;
- неуспешный hit атомарен;
- lighting не влияет на HUD;
- interaction key labels uppercase, action labels sentence case;
- `NEW GAME` не сбрасывает language/audio preferences.

## Validation

Targeted checks должны проверять поведение, а не только наличие строк.

### Clock and balance

- scale `1`: за 1080 реальных секунд проходит ровно 86400 игровых секунд;
- за 45 реальных секунд проходит один игровой час;
- sleep scale `8`: clock проходит примерно в восемь раз быстрее;
- 100 энергии при idle awake drain заканчиваются примерно через 16 игровых часов;
- legacy `elapsedGameSeconds` мигрируется с коэффициентом `80`.

### Clock formatting

Проверить точные строки:

RU: `00:00`, `06:05`, `12:45`, `23:59`.

EN: `12:00 AM`, `6:05 AM`, `12:45 PM`, `11:59 PM`.

### Interaction prompts

Проверить точные строки:

- desktop RU log: `SPACE · Рубить`;
- desktop EN log: `SPACE · Chop`;
- touch RU log: `Рубить`;
- touch EN log: `Chop`;
- desktop RU ruby: `SPACE · Добыть`;
- desktop EN ruby: `SPACE · Mine`;
- desktop RU bed: `SPACE · Спать`;
- desktop EN bed: `SPACE · Sleep`.

Запретить regression-строки `Разрубить`, `Space`, `SPACE  ` и лишние подписи.

### Lighting

- `08:00 = 0`;
- `18:00 = 0`;
- `19:30` между `0` и `0.55`;
- `21:00 = 0.55`;
- `02:00 = 0.55`;
- `06:30` между `0` и `0.55`;
- до/после полуночи непрерывно.

### Ruby mining

- первые четыре удара не дают ruby;
- каждый успешный hit расходует `4` энергии;
- пятый hit даёт ровно `1` ruby;
- wood не меняется;
- cleared node повторно не мутирует;
- insufficient energy не меняет state;
- state переживает reload.

### Sleep runtime E2E

- поставить низкую энергию;
- лечь спать;
- подтвердить `sleeping = true`;
- за одинаковый real interval clock и NPC во сне продвигаются примерно x8;
- NPC animation playback ускоряется;
- игрок во сне не двигается;
- после auto wake игрок на свободном `BED_WAKE_TILE`;
- следующее movement input меняет позицию;
- manual wake даёт тот же результат.

### Visual evidence

Final-head screenshots:

- RU daytime HUD и prompt `SPACE · Рубить`;
- EN daytime HUD и prompt `SPACE · Chop`;
- touch prompt без пустого места под key;
- dusk;
- night;
- sleeping state с ускоренным NPC;
- две ruby nodes до добычи;
- повреждённая ruby node;
- cleared ruby node и обновлённый HUD.

### Commands

- `npm run check:progress`
- `npm run check:hud`
- `npm run check:movement`
- `npm run check:character`
- `npm run check:patrol`
- `npm run check:interaction`
- `npm run check:i18n`
- `npm run check:world`
- `npm run check:visual`
- `npm run build`
- `npm run check`
- `npm run check:e2e`

Финальный PR требует зелёный final-head CI и Browser E2E.

## Scope boundary

Не добавлять:

- календарные даты, недели, месяцы, сезоны;
- погоду, солнце, луну, динамические тени;
- отдельное комнатное освещение и лампы;
- полноценные инструменты, durability, inventory, item stacks;
- общую mining-систему;
- procedural resource placement;
- внешние ассеты;
- переработку карты и маршрутов NPC;
- изменения workflow/deployment/auto-repair pipeline.

## Delivery

Реализовать, выполнить self-review и применимую validation, затем открыть ровно один финальный PR из `task/015-live-sleep-clock-cycle` с title `Task #015 — Оживить сон, часы и суточный цикл`.

PR body начинается с:

```text
Task: Task #015 — Оживить сон, часы и суточный цикл
```

Не создавать foundation-задачу, второй PR, replacement PR или дополнительную remote branch.
