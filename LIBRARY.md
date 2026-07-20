# Library: карта NestledBurrow

Этот файл помогает найти нужную область проекта, не загружая в контекст всё подряд.

## Как пользоваться картой

- Основной чат сначала читает `PROJECT.md`, затем `REVIEW.md` перед проверкой pull request.
- Codex сначала читает `AGENTS.md`, затем эту карту и только после этого открывает адреса, необходимые для задачи.

## Управление проектом

### `PROJECT.md`

Текущее положение проекта, цель, следующий шаг, блокеры и действующие решения.

Читать перед планированием следующей задачи или после долгого перерыва.

### `REVIEW.md`

Канонический протокол проверки, исправления, merge и публикации pull request. Содержит правила CI, визуального review, asset approval и ожидания `pages/live`.

Читать перед каждой проверкой PR.

### `AGENTS.md`

Обязательные правила работы Codex: подготовка, self-test, runtime-проверка, работа с ассетами и формат отчёта.

Читать в начале каждой задачи Codex.

### `ASSETS.md`

Канонический список внешних ассетов, их источников, лицензий, ролей и итоговых путей. Basic Village зафиксирован здесь как приоритетный набор окружения.

Читать при добавлении, удалении или замене сторонней графики.

## Runtime

### `src/main.js`

Точка входа и Phaser-сцена непрерывного мира: загрузка Basic Village sheets, рендер мира, игрок, камера, анимации, клавиатура, джойстик и HUD.

### `src/input.js`

Каноническая логика ввода: мобильный джойстик, dead zone, ограничение длины вектора и определение touch/coarse-pointer устройств.

### `src/visualConfig.js`

Кадры персонажа, foot box, facing hysteresis и скорость анимации.

### `src/worldConfig.js`

Размеры экрана, мира и тайла; параметры дома и двери; скорость игрока; пути и frame-индексы активных Basic Village sheets.

### `src/worldLayout.js`

Чистая сборка мира: травяной фон, дорожка, интерьер и стены дома, деревья, spawn, outdoor target и blocked cells.

### `src/movement.js`

Чистая логика foot-box collision, world bounds и axis-separated movement без Phaser Physics.

## Проверки и инструменты

### `scripts/check-input.mjs`

Автоматические проверки ввода и связанных расчётов.

### `scripts/check-visual.mjs`

Проверяет логическую pixel grid, Basic Village asset root, геометрию source sheets, загрузку spritesheet и кадры персонажа.

### `scripts/check-world.mjs`

Проверяет размеры мира, doorway, blocked cells, маршрут indoor→outdoor и collision.

### `scripts/check-room-preview.py`

Генерирует фактические preview текущего Basic Village мира:

- `artifacts/world-overview.png`
- `artifacts/camera-indoor.png`
- `artifacts/camera-outdoor.png`
- `artifacts/top-wall-detail.png`

Запускается через `npm run check` и предоставляет изображения для обязательного визуального review.

### `scripts/audit-spritesheet.py`

Инструмент первичного аудита новых spritesheet: проверяет геометрию, нарезает кадры, создаёт CSV, SHA-256 и подписанные contact sheets.

### `requirements-dev.txt`

Python-зависимости визуальных проверок и генерации preview.

### `package.json`

Команды запуска, сборки и проверок. `npm run check` объединяет input, visual, world, preview и production build.

## Инфраструктура

### `.github/workflows/pr-check.yml`

Проверяет pull request и загружает `world-previews-pr-<номер>` с визуальными артефактами. Чтобы не создавать россыпь CI-писем, PR открывается только после завершения работы и успешных локальных проверок ветки.

### `.github/workflows/deploy-pages.yml`

Собирает и публикует GitHub Pages, создаёт `/version.json`, проверяет живую версию и выставляет `pages/live`.

## Legacy

`src/kenneyRoomConfig.json`, `src/roomLayout.js` и старые Kenney environment atlases относятся к предыдущей реализации окружения. Они не являются источником по умолчанию для новых world-art задач после перехода на Basic Village.

## Правила развития карты

- Новая самостоятельная область знаний получает один канонический адрес.
- Факты не дублируются между документами.
- Пустые разделы «на будущее» не создаются.
- При добавлении, переименовании или удалении адреса обновляется эта карта.
