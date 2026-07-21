<!-- audience: optional-map -->
# Library: карта NestledBurrow

## Назначение

`LIBRARY.md` — необязательная карта важных адресов проекта. Она помогает найти нужную область, не читая весь репозиторий и все Markdown-файлы подряд.

Этот файл не является обязательным входом ни для основного чата, ни для Codex.

## Когда читать

- **Основной ChatGPT-чат** сначала восстанавливается через `PROJECT.md` и открывает `LIBRARY.md` только когда нужно найти конкретную область проекта.
- **Codex** сначала читает прямой промпт и `AGENTS.md`. `LIBRARY.md` открывается только когда из промпта и структуры репозитория неясно, где находится нужная система.
- Файл из `tasks/` читается только при прямой ссылке на него.

## Контракты документов

| Документ | Аудитория | Канонически владеет |
|---|---|---|
| `PROJECT.md` | основной ChatGPT-чат | опубликованное состояние, продуктовая архитектура, роли, рабочий цикл, устойчивые решения |
| `REVIEW.md` | основной ChatGPT-чат | ревью, пакетные исправления, merge, публикация, documentation drift gate |
| `AGENTS.md` | Codex | исполнение задачи, scope, проверки, ветка, delivery |
| `LIBRARY.md` | обе роли по необходимости | карта важных адресов и назначение файлов |
| `ASSETS.md` | задачи с внешними ассетами | источники, лицензии, hashes и asset policy |
| `tasks/*.md` | только явно указанная сложная задача | долговечный task-specific контракт |

Один факт должен иметь одного канонического владельца. Другие документы ссылаются на него, а не копируют полный текст.

## Управление проектом

### `PROJECT.md`

Лидовский контекст и единственная точка восстановления нового основного чата. Не является обязательным чтением Codex.

### `REVIEW.md`

Протокол основного чата для независимой проверки, ремонта, merge, публикации и поддержания документации в актуальном состоянии.

### `AGENTS.md`

Единственный обязательный репозиторный документ Codex для обычной реализации.

### `tasks/TEMPLATE.md`

Необязательный шаблон для крупных, рискованных, многоэтапных, возобновляемых или повторно используемых задач. Обычная итерация использует прямой промпт без task-файла.

### `tasks/branch-cleanup.md`

Отдельная maintenance-задача безопасного удаления старых remote-веток. Не должна запускаться как побочный эффект обычной реализации.

### `.github/pull_request_template.md`

Адаптивный отчёт финального PR: review class, scope, lifecycle, применимые проверки, runtime evidence, ограничения и documentation drift confirmation.

### `ASSETS.md`

Канонический список внешних ассетов. Basic Village зафиксирован как основной набор окружения.

## Runtime

### `src/main.js`

Phaser-сцена непрерывного мира: создание мира и игрока, камера, клавиатура, мобильный джойстик, screen-space HUD и debug-панель движения по `?movementDebug=1`.

### `src/input.js`

Чистая логика мобильного ввода: touch/coarse-pointer detection, зона активации, runtime-центр джойстика, clamp, dead zone, аналоговая сила и ограничение входного вектора.

Native event ownership, глобальный fallback после выхода за canvas и lifecycle listeners пока координируются в `src/main.js`.

### `src/fullscreen.js`

Helper стандартного Fullscreen API: поддержка, active state, безопасный вход/выход и rejected Promise.

### `src/hud.js`

Переиспользуемый Phaser screen-space HUD: 5×7 bitmap glyphs, compact build label, fullscreen-иконка, pixel-aligned placement и hit areas.

### `src/movementConfig.js`

Production defaults, диапазоны runtime-тюнинга и нормализация конфигурации движения.

### `src/characterMovement.js`

Переиспользуемое состояние и интегратор движения: desired direction, velocity, разгон, торможение, разворот, facing/aim и delta cap.

### `src/movement.js`

Foot-box collision, world bounds и axis-separated sliding без Phaser Physics.

### `src/visualConfig.js`

Кадры персонажа, foot box, facing hysteresis и скорость анимации.

### `src/worldConfig.js`

Размеры экрана, мира и тайла; параметры дома и двери; пути и frame-индексы Basic Village.

### `src/worldLayout.js`

Сборка мира: ground, path, интерьер, стены, деревья, spawn, outdoor target и blocked cells.

## Проверки и инструменты

### `scripts/check-doc-contracts.mjs`

Проверяет audience markers, разделение контекста основного чата и Codex, стандартную recovery-фразу и отсутствие возврата к обязательному чтению лидовских документов исполнителем.

### `scripts/check-input.mjs`

Проверки dynamic joystick: activation, clamp, dead zone, analog strength, one-pointer ownership, HUD exclusion, drag за пределами canvas, lost-capture fallback и reset states.

### `scripts/check-fullscreen.mjs`

Mock-проверки Fullscreen API helper.

### `scripts/check-hud.mjs`

Bitmap glyph coverage, build label, pixel placement, fullscreen hit area и отделение HUD input от джойстика.

### `scripts/check-movement.mjs`

Max speed, diagonal normalization, acceleration, braking, reverse, turn, blocked axes, aim, tuning limits и delta cap.

### `scripts/check-visual.mjs`

Pixel grid, Basic Village hashes, spritesheet loading, integer zoom, camera и character frames.

### `scripts/check-world.mjs`

World layout, doorway, collision, sliding, anti-tunneling и bounds.

### `scripts/check-room-preview.py`

Генерирует:

- `artifacts/world-overview.png`
- `artifacts/camera-indoor.png`
- `artifacts/camera-outdoor.png`
- `artifacts/top-wall-detail.png`

Использует зависимости из `requirements-dev.txt`; локальная ошибка установки не разрешает самодельную замену Pillow.

### `scripts/audit-spritesheet.py`

Аудит spritesheet: геометрия, кадры, CSV, SHA-256 и contact sheets.

### `requirements-dev.txt`

Канонические Python-зависимости визуальных проверок.

### `package.json`

Команды запуска, сборки и полного набора documentation/input/fullscreen/HUD/movement/visual/world/preview проверок.

## Инфраструктура

### `.github/workflows/pr-check.yml`

Проверяет финальный PR и загружает world previews.

### `.github/workflows/deploy-pages.yml`

Публикует GitHub Pages, создаёт `/version.json`, проверяет опубликованный SHA и выставляет `pages/live`.

### Настройки GitHub

- `main` защищён от удаления и force-push.
- Automatic head-branch deletion удаляет обычные merged ветки.
- Persistent `release/*`, `archive/*` и `keep/*` требуют отдельной repository-side protection.

## Legacy

`src/kenneyRoomConfig.json`, `src/roomLayout.js` и старые Kenney environment atlases относятся к предыдущей реализации окружения.

## Правила развития карты

- Добавлять адрес только для самостоятельной и реально используемой области.
- Обновлять карту при добавлении, удалении, переименовании или существенной смене ответственности файла.
- Не обновлять карту ради каждой мелкой поведенческой правки.
- Не дублировать подробные правила из `PROJECT.md`, `AGENTS.md`, `REVIEW.md` или `ASSETS.md`.
- Не создавать пустые разделы «на будущее».