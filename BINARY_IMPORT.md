<!-- audience: lead-chat -->
# Binary import bridge

## Назначение

Этот документ фиксирует обязательный путь доставки пользовательских бинарных attachments в `downlimit/NestledBurrow` без ручной работы пользователя и без передачи доставки Codex.

## Распределение ответственности

Пользователь только прикладывает файл к Lead-чату и описывает требуемую интеграцию.

Лид обязан:

1. прочитать точные байты реального attachment;
2. определить канонический repository path;
3. импортировать именно эти байты в GitHub;
4. считать готовый файл обратно и проверить формат, размер и SHA-256;
5. довести импорт до `main` либо до явно указанного обязательного Base SHA;
6. только после этого выдать Codex одну code-only задачу с точным путём.

Пользователь не загружает файл в GitHub вручную, не создаёт asset branch и не передаёт тот же attachment Codex.

## Источник истины

Источник истины — байты приложенного пользователем файла.

Внешняя ссылка, CDN URL, исходная страница генератора или файл с тем же названием не заменяют attachment. Их можно использовать как транспорт только по прямому разрешению пользователя либо после доказанного совпадения размера и SHA-256.

При первом несовпадении размера или SHA-256 этот транспортный путь закрывается. Запрещено менять ожидаемый hash, брать похожую версию, создавать временные workflow или выдавать Codex путь к отсутствующему файлу.

## Preflight без GitHub-записей

До первого GitHub write Лид локально:

1. читает attachment полностью;
2. вычисляет byte length и SHA-256;
3. проверяет decode и применимые метаданные;
4. выбирает target path;
5. полностью готовит payload импорта;
6. проверяет, что каждый отдельный вызов GitHub-коннектора укладывается в его лимит.

Если attachment прочитан локально, но весь base64 не помещается в один аргумент, это **не блокер**. Для этого существует chunked single-shot path ниже.

## Небольшой бинарник

Когда base64 attachment помещается в один аргумент коннектора:

```text
attachment bytes
→ create_blob(base64)
→ create_tree
→ create_commit
→ update_ref
→ read-back
```

Base64 здесь только transport encoding. В репозитории должен оказаться настоящий runtime-файл.

## Крупный бинарник: single-shot detached blobs

Когда весь base64 не помещается в один аргумент, Лид использует существующий repository-side reconstruction bridge.

### Ключевой принцип

Лимит применяется к **одному аргументу**, а не к сумме всех blob-вызовов.

`create_blob` создаёт detached Git object и сам по себе:

- не двигает branch ref;
- не запускает Actions;
- не открывает PR;
- не создаёт пользовательское письмо о push/CI.

Поэтому text-only GitHub connector не является препятствием для крупного MP3/PNG/TTF: Лид передаёт его несколькими небольшими UTF-8 base64 chunks.

### Обязательная цепочка

1. Локально преобразовать точные attachment bytes в один canonical base64 string.
2. Разбить строку на небольшие части, каждая из которых гарантированно помещается в `create_blob(content: ..., encoding: utf-8)`.
3. Для каждого chunk вызвать `create_blob` и сохранить returned blob SHA. При превышении лимита уменьшить размер chunk, а не объявлять импорт невозможным.
4. Отдельными маленькими blobs подготовить `manifest.json` и пустой `READY`.
5. Создать ветку `asset-import/<slug>` от проверенного current `main`.
6. Одним `create_tree` добавить **все** paths:

```text
.binary-import/<import-id>/0000.b64
.binary-import/<import-id>/0001.b64
...
.binary-import/<import-id>/manifest.json
.binary-import/<import-id>/READY
```

7. Одним `create_commit` создать staging commit.
8. Ровно одним `update_ref` опубликовать полный tree в ветку.
9. Этот единственный push с `READY` запускает `.github/workflows/binary-import.yml` один раз.
10. Workflow собирает настоящий бинарник, проверяет byte length и SHA-256, удаляет staging и коммитит runtime-файл в ту же ветку.
11. Лид считывает runtime-файл обратно, проверяет его и доводит подтверждённый binary commit до `main` без asset PR, когда repository protection это допускает.

Chunks, manifest и `READY` **не публикуются отдельными ref-update**. Отдельный предварительный staging commit и последующий marker commit запрещены: полный staging и marker входят в один tree/commit.

### Manifest

```json
{
  "version": 1,
  "targetPath": "public/assets/audio/music/example.mp3",
  "byteLength": 3977087,
  "sha256": "lowercase-64-character-sha256",
  "chunks": ["0000.b64", "0001.b64"]
}
```

Имена chunks идут в точном порядке сборки. Каждый chunk содержит только соответствующий contiguous fragment одного canonical base64 string.

## Антиспам-инварианты

Один attachment создаёт максимум один reconstruction run.

Разрешённый внешний lifecycle:

```text
несколько detached create_blob calls без уведомлений
→ один tree
→ один commit
→ один update_ref
→ один reconstruction run
→ один bot commit с готовым runtime-файлом
```

Запрещено:

- делать ref-update на каждый chunk;
- отдельно пушить manifest и `READY`;
- открывать PR до появления настоящего runtime-файла;
- использовать PR как диагностическую консоль;
- добавлять asset-specific jobs в общий `pr-check.yml`;
- добавлять временный workflow в `main`;
- многократно менять trigger/marker ради повторного запуска;
- создавать diagnostic artifacts как альтернативный путь доставки;
- после понятной ошибки делать серию repair-push.

Если single-shot run завершился ошибкой, Лид сначала читает полный лог и допускает не более одного консолидированного repair. При сохраняющейся неопределённости импорт прекращается без новых push и без Codex-задачи.

## Ограничения безопасности bridge

Bridge:

- разрешает target только внутри `public/assets/`;
- запрещает path traversal и ненормализованные пути;
- принимает только разрешённые binary extensions;
- выполняет strict base64 round-trip validation;
- проверяет byte length и SHA-256 до записи;
- удаляет staging только после успешной реконструкции;
- запускается только для `asset-import/**` и только при изменении `READY`.

## Codex handoff

Codex не отвечает за импорт или реконструкцию attachment.

После завершённого импорта prompt содержит только:

- Base SHA;
- repository/runtime path;
- SHA-256 и применимые метаданные;
- требуемое runtime-поведение;
- запрет изменять, скачивать, регенерировать или заменять asset.

В prompt не копируются chunks, manifest, `READY`, workflow или механика reconstruction. Если runtime-файл отсутствует в Base SHA, Лид не выдаёт задачу.