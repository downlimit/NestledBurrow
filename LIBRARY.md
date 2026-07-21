# Library: карта NestledBurrow

Этот файл помогает найти нужную область проекта, не загружая в контекст всё подряд.

## Как пользоваться картой

- Основной чат сначала читает `PROJECT.md`, затем `REVIEW.md` перед проверкой pull request.
- Codex сначала читает задачу, `AGENTS.md`, затем эту карту и только после этого открывает адреса, необходимые для работы.

## Управление проектом

### `PROJECT.md`

Текущее положение проекта, цель, следующий шаг, блокеры, рабочий цикл и действующие решения.

### `REVIEW.md`

Канонический протокол проверки, пакетного исправления, merge, публикации и проверки удаления временной ветки pull request.

### `AGENTS.md`

Обязательные правила работы Codex: одна удалённая ветка, self-test, runtime-проверка, контроль зависимостей, работа с ассетами и формат отчёта.

### `tasks/TEMPLATE.md`

Канонический шаблон новых задач: Git lifecycle, цель, требования, validation, границы scope и финальная доставка.

### `tasks/branch-cleanup.md`

Отдельная maintenance-задача безопасного удаления старых remote-веток. Не создаёт ветку, не изменяет файлы и сохраняет защищённые, активные, persistent, deployment-related и неоднозначные ветки.

### `.github/pull_request_template.md`

Стандартный доказательный отчёт финального PR: review class, Git lifecycle, команды, runtime-состояния, артефакты, ограничения и подтверждение отсутствия несвязанного scope creep.

### `ASSETS.md`

Канонический список внешних ассетов. Basic Village зафиксирован здесь как приоритетный набор окружения.

## Runtime

### `src/main.js`

Phaser-сцена непрерывного мира: Basic Village, игрок, камера, анимации, клавиатура, динамический мобильный джойстик, fullscreen-кнопка и debug-панель движения по `?movementDebug=1`.

### `src/input.js`

Каноническая логика мобильного ввода: поддержка touch/coarse pointer, активация в левой половине, runtime-центр динамического джойстика, clamp базы, dead zone, аналоговая сила и ограничение длины входного вектора.

### `src/fullscreen.js`

Чистый helper стандартного Fullscreen API: проверка поддержки, определение состояния по `document.fullscreenElement`, безопасный вход/выход и обработка rejected Promise.

### `src/movementConfig.js`

Production defaults, допустимые диапазоны runtime-тюнинга и нормализация конфигурации движения.

### `src/characterMovement.js`

Переиспользуемое состояние и интегратор движения персонажей: желаемое направление, фактическая velocity, разгон, торможение, разворот, подавление поперечной скорости, continuous facing/aim и ограничение frame delta.

### `src/movement.js`

Foot-box collision, world bounds и axis-separated sliding без Phaser Physics. `moveWithCollision()` возвращает итоговую позицию и заблокированные оси для синхронизации velocity.

### `src/visualConfig.js`

Кадры персонажа, foot box, facing hysteresis и скорость анимации.

### `src/worldConfig.js`

Размеры экрана, мира и тайла; параметры дома и двери; базовая скорость; пути и frame-индексы Basic Village.

### `src/worldLayout.js`

Сборка мира: трава, дорожка, интерьер, стены, деревья, spawn, outdoor target и blocked cells.

## Проверки и инструменты

### `scripts/check-input.mjs`

Проверки dynamic-center джойстика: левая/правая половина, clamp центра, dead zone, аналоговая сила, ownership одного pointer и reset-состояния.

### `scripts/check-fullscreen.mjs`

Mock-проверки Fullscreen API helper: supported state, вход, выход, active state и безопасное отклонение запроса.

### `scripts/check-movement.mjs`

Проверки max speed, диагонали, разгона, торможения, разворота через ноль, поворота на 90°, аналоговой силы, blocked axes, независимого aim, tuning limits и frame-delta cap.

### `scripts/check-visual.mjs`

Проверяет pixel grid, официальные Basic Village hashes, загрузку spritesheet, integer zoom, камеру и кадры персонажа.

### `scripts/check-world.mjs`

Проверяет Basic Village layout, doorway, collision, blocked-axis reporting, sliding, anti-tunneling и world bounds.

### `scripts/check-room-preview.py`

Генерирует preview текущего мира:

- `artifacts/world-overview.png`
- `artifacts/camera-indoor.png`
- `artifacts/camera-outdoor.png`
- `artifacts/top-wall-detail.png`

Использует канонические Python-зависимости из `requirements-dev.txt`. Локальная ошибка установки не должна приводить к добавлению самодельной замены Pillow или другого пакета.

### `scripts/audit-spritesheet.py`

Инструмент аудита новых spritesheet: геометрия, кадры, CSV, SHA-256 и contact sheets.

### `requirements-dev.txt`

Канонические Python-зависимости визуальных проверок.

### `package.json`

Команды запуска, сборки и полного набора input/fullscreen/movement/visual/world/preview проверок.

## Инфраструктура

### `.github/workflows/pr-check.yml`

Проверяет финальный PR и загружает world preview. PR открывается только после завершения работы в одной временной ветке, чтобы не создавать промежуточные CI-письма.

### `.github/workflows/deploy-pages.yml`

Публикует GitHub Pages через Actions artifact, создаёт `/version.json`, проверяет фактически опубликованный SHA и выставляет `pages/live`. Отдельная `gh-pages` deployment-ветка сейчас не используется.

### Настройки GitHub

- `main` защищён от удаления и force-push.
- Automatic head-branch deletion удаляет обычные временные ветки после merge.
- Persistent `release/*`, `archive/*` и `keep/*` должны дополнительно получить repository-side deletion protection до использования.

## Legacy

`src/kenneyRoomConfig.json`, `src/roomLayout.js` и старые Kenney environment atlases относятся к предыдущей реализации окружения.

## Правила развития карты

- Новая самостоятельная область знаний получает один канонический адрес.
- Факты не дублируются без необходимости между документами.
- Пустые разделы «на будущее» не создаются.
- При добавлении, переименовании или удалении адреса обновляется эта карта.
