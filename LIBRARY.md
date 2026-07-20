# Library: карта NestledBurrow

Этот файл помогает найти нужную область проекта, не загружая в контекст всё подряд.

## Как пользоваться картой

- Основной чат сначала читает `PROJECT.md`, затем `REVIEW.md` перед проверкой pull request.
- Codex сначала читает `AGENTS.md`, затем эту карту и только после этого открывает адреса, необходимые для задачи.

## Управление проектом

### `PROJECT.md`

Текущее положение проекта, цель, следующий шаг, блокеры и действующие решения.

### `REVIEW.md`

Канонический протокол проверки, исправления, merge и публикации pull request.

### `AGENTS.md`

Обязательные правила работы Codex: подготовка, self-test, runtime-проверка, работа с ассетами и формат отчёта.

### `ASSETS.md`

Канонический список внешних ассетов. Basic Village зафиксирован здесь как приоритетный набор окружения.

## Runtime

### `src/main.js`

Phaser-сцена непрерывного мира: Basic Village, игрок, камера, анимации, клавиатура, джойстик и debug-панель движения по `?movementDebug=1`.

### `src/input.js`

Каноническая логика клавиатурного и мобильного ввода: joystick dead zone, аналоговая сила и ограничение длины входного вектора.

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

Проверки ввода и мобильного джойстика.

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

### `scripts/audit-spritesheet.py`

Инструмент аудита новых spritesheet: геометрия, кадры, CSV, SHA-256 и contact sheets.

### `requirements-dev.txt`

Python-зависимости визуальных проверок.

### `package.json`

Команды запуска, сборки и полного набора input/movement/visual/world/preview проверок.

## Инфраструктура

### `.github/workflows/pr-check.yml`

Проверяет финальный PR и загружает world preview. PR открывается только после завершения работы в ветке, чтобы не создавать промежуточные CI-письма.

### `.github/workflows/deploy-pages.yml`

Публикует GitHub Pages, создаёт `/version.json` и выставляет `pages/live`.

## Legacy

`src/kenneyRoomConfig.json`, `src/roomLayout.js` и старые Kenney environment atlases относятся к предыдущей реализации окружения.

## Правила развития карты

- Новая самостоятельная область знаний получает один канонический адрес.
- Факты не дублируются между документами.
- Пустые разделы «на будущее» не создаются.
- При добавлении, переименовании или удалении адреса обновляется эта карта.
