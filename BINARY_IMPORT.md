<!-- audience: lead-chat -->
# Binary asset delivery

## Цель

Пользователь не устанавливает Git, не работает с CLI и не передаёт бинарник Codex. Лид обязан довести точные пользовательские байты до подтверждённого repository path до выдачи integration task.

## Источник истины

Если пользователь сказал использовать приложенный файл, источником истины являются только точные байты этого attachment.

Без прямого разрешения пользователя запрещено:

- скачивать другую копию с CDN, сайта генератора или внешней ссылки;
- брать аналог, повторный экспорт или файл с тем же названием;
- перекодировать, нормализовать, пережимать или регенерировать;
- менять ожидаемый размер или SHA-256 под найденный файл.

Первое несовпадение размера или SHA-256 немедленно закрывает транспортный путь.

## Выбор транспорта

Лид выбирает первый подтверждённо доступный вариант:

1. **Прямой connector upload** — полный binary/base64 безопасно помещается в один подтверждённый GitHub tool call.
2. **Browser asset upload** — основной fallback для крупных файлов до browser limit GitHub.
3. **File-capable action или локальный авторизованный Git** — когда такое средство реально доступно текущему runtime.
4. **Внешний URL** — только по прямому разрешению пользователя и только при совпадении byte length и SHA-256.

Наличие repository-side reconstruction bridge само по себе не является транспортом из ChatGPT в GitHub.

## Browser asset upload — штатный путь для крупных файлов

GitHub принимает через браузер файлы размером до 25 MiB. Для обычных MP3, PNG, TTF и подобных assets это основной обход ограничений строкового ChatGPT connector без установки Git.

Постоянная landing branch:

```text
asset-inbox
```

Папка загрузки:

```text
incoming/
```

Обязательный поток:

```text
пользователь прикладывает файл в Lead-чат
→ Лид проверяет attachment, вычисляет byte length и SHA-256
→ если прямой connector upload невозможен, Лид направляет пользователя в browser asset inbox
→ пользователь только перетаскивает тот же файл в GitHub browser upload и подтверждает commit
→ Лид находит uploaded file в asset-inbox/incoming
→ Лид проверяет byte length, SHA-256, decode и metadata против исходного attachment
→ Лид переиспользует уже существующий Git blob и помещает его в канонический runtime path
→ Лид доводит canonical asset commit до main без asset PR и без Actions
→ только затем Лид выдаёт одну code-only задачу Codex
```

Пользователь не выбирает архитектуру, target path или Git-процесс. Лид заранее сообщает точную landing branch/folder; действие пользователя ограничено одним drag-and-drop в браузере и подтверждением upload commit.

Если uploaded file не совпадает с attachment, Лид ничего не переносит в main и не ищет замену.

### Работа Лида после browser upload

Лид обязан:

1. проверить актуальный `main` и upload branch;
2. получить blob SHA загруженного файла;
3. доказать совпадение с attachment по byte length и SHA-256;
4. создать canonical tree/commit, ссылающийся на этот же blob SHA — без повторной передачи байтов через модель;
5. считать runtime-файл обратно из canonical base;
6. очистить или сбросить временное содержимое inbox, когда это безопасно;
7. не открывать asset PR и не запускать workflow ради переноса файла.

## Code-only означает binary-free diff

После того как нужные пользовательские assets уже находятся в Base SHA, Codex получает **code-only** задачу. Это означает, что итоговый diff задачи не должен добавлять, изменять, переименовывать или удалять никакие бинарные файлы — не только исходный attachment.

К бинарным файлам относятся, в частности:

- аудио и видео: `.mp3`, `.wav`, `.ogg`, `.mp4`, `.webm`;
- изображения и архивы: `.png`, `.jpg`, `.webp`, `.gif`, `.zip`;
- шрифты: `.ttf`, `.otf`, `.woff`, `.woff2`;
- другие непросматриваемые в обычном текстовом PR форматы.

Лид обязан проверить задачу на **скрытую потребность в новом бинарнике**. Например, просьба заменить шрифт может привести к копированию `.ttf` или `.woff2`, даже если основной пользовательский attachment — MP3.

Для code-only задачи допустима зафиксированная npm-зависимость, которая содержит собственные assets внутри устанавливаемого package и подключается через package import. Недопустимо копировать эти assets из `node_modules` в `public/`, `src/` или другой tracked path.

Если результат требует нового tracked binary-файла, Лид до выдачи ТЗ обязан выбрать одно из двух:

1. сам предварительно доставить и проверить бинарник по правилам этого документа, затем выдать code-only integration task;
2. изменить реализацию на действительно text-only dependency/runtime path без tracked binary diff.

В каждом code-only prompt должен быть явный инвариант:

```text
Итоговый diff не содержит новых или изменённых binary-файлов. Все требуемые runtime binaries уже существуют в Base SHA либо остаются внутри зафиксированной package dependency и не копируются в repository paths.
```

Перед созданием PR Codex обязан проверить changed-file list. При наличии неожиданного binary-файла он удаляет его из change set и исправляет способ поставки; нельзя создавать PR с предупреждением «бинарные файлы не поддерживаются».

## Прямой connector upload для небольших файлов

Когда весь attachment помещается в один подтверждённый вызов:

```text
attachment bytes
→ create_blob(base64)
→ create_tree
→ create_commit
→ update_ref
→ read-back
```

Base64 является только transport encoding. В репозитории должен оказаться настоящий runtime-файл.

## Repository-side reconstruction bridge

Bridge умеет собрать binary из уже доставленных chunks, но не является способом вытащить attachment из ChatGPT.

Использовать его допустимо только когда отдельный file-capable transport уже доказан. Для browser upload он не нужен: GitHub уже создал настоящий binary blob.

Запрещено проталкивать многомегабайтный base64 через десятки строковых tool calls только потому, что каждый отдельный chunk помещается в аргумент.

## Preflight до GitHub writes

До создания временной ветки, PR, workflow run или task-файла Лид подтверждает:

- attachment полностью доступен;
- вычислены byte length и SHA-256;
- формат декодируется;
- выбран canonical target path;
- выбран реальный end-to-end transport;
- ожидаемое число уведомлений не превышает бюджет;
- Codex task не будет выдан до появления файла в подтверждённом base;
- code-only task не создаст неожиданный tracked binary diff.

Если transport не доказан, GitHub остаётся неизменным.

## Антиспам

Цель Lead-owned импорта — ноль писем. Допустимый максимум на asset preparation — одно пользовательское browser-upload событие и один canonical commit.

Запрещено:

- использовать PR или Actions как диагностическую консоль;
- создавать PR только с manifest или expected path;
- запускать workflow на каждый chunk или repair;
- добавлять временные workflow/jobs в `main`;
- делать серию ref updates ради проверки возможности загрузки;
- выдавать Codex путь к отсутствующему файлу.

## Проверка готового файла

До Codex handoff Лид подтверждает:

- файл существует по точному runtime path в Base SHA;
- GitHub возвращает настоящий binary blob;
- byte length и SHA-256 совпадают с attachment;
- формат декодируется и metadata ожидаемы;
- source/license записаны, когда это требуется.

## Codex handoff

Codex не импортирует и не реконструирует пользовательский бинарник.

Prompt содержит только:

- Base SHA;
- repository/runtime path;
- SHA-256 и применимые metadata;
- требуемое runtime-поведение;
- запрет изменять, скачивать, регенерировать или заменять asset;
- запрет добавлять любые другие tracked binary-файлы в code-only diff.

В prompt не копируются transport mechanics, chunks, manifest, inbox или workflow. Если runtime-файл отсутствует в Base SHA, Лид не выдаёт задачу.