<!-- audience: lead-chat -->
# Binary import bridge

## Назначение

Этот документ фиксирует подтверждённый путь доставки пользовательских бинарных attachments в `downlimit/NestledBurrow` без ручной работы пользователя и без передачи доставки Codex.

## Распределение ответственности

Пользователь только прикладывает файл к Lead-чату и описывает требуемую интеграцию.

Лид обязан:

1. прочитать реальный attachment;
2. определить канонический repository path;
3. импортировать настоящий бинарный файл в GitHub;
4. считать его обратно и проверить формат, размер и SHA-256;
5. довести импорт до `main` либо включить готовый бинарник в явно указанный base commit;
6. выдать Codex одну code-only задачу с точным Base SHA и путём.

Пользователь не загружает файл в GitHub вручную, не создаёт asset branch и не передаёт тот же attachment Codex.

## Два технических пути

### Небольшой бинарник

Когда attachment вместе с base64 encoding помещается в допустимый размер аргумента GitHub-коннектора, Лид использует обычную цепочку Git Data API:

```text
attachment bytes
→ create_blob(base64)
→ create_tree
→ create_commit
→ update_ref
→ PR / merge
```

### Крупный бинарник

Когда base64-представление не помещается в один аргумент коннектора, Лид использует repository-side reconstruction bridge.

1. Создать ветку только с префиксом:

```text
asset-import/<slug>
```

2. Разбить base64 attachment на небольшие UTF-8 chunks и положить их в:

```text
.binary-import/<import-id>/0000.b64
.binary-import/<import-id>/0001.b64
...
```

3. Создать manifest:

```json
{
  "version": 1,
  "targetPath": "public/assets/audio/music/example.mp3",
  "byteLength": 3977087,
  "sha256": "lowercase-64-character-sha256",
  "chunks": ["0000.b64", "0001.b64"]
}
```

4. Push staging files запускает `.github/workflows/binary-import.yml`.
5. Workflow вызывает `scripts/reconstruct-binary-import.mjs`, собирает настоящий бинарник, проверяет размер и SHA-256, удаляет staging directory и коммитит готовый файл в ту же ветку.
6. Лид проверяет final branch read-back и только затем открывает/завершает asset PR.

В конечном PR и `main` должны находиться настоящий `.mp3`, `.png`, `.ttf` и другие runtime-файлы. Временные `.b64` chunks не должны оставаться в final diff.

## Ограничения безопасности

Bridge:

- разрешает target только внутри `public/assets/`;
- запрещает path traversal и ненормализованные пути;
- принимает только разрешённые binary extensions;
- выполняет strict base64 round-trip validation;
- проверяет заявленный byte length и SHA-256 до записи файла;
- сохраняет staging при ошибке для диагностики;
- удаляет staging только после успешной реконструкции;
- не запускается для произвольных веток, только для `asset-import/**`.

## Codex handoff

Codex не отвечает за импорт пользовательского attachment.

Его prompt после завершённого импорта обязан содержать:

- точный Base SHA;
- точный repository path;
- runtime URL/path, когда отличается;
- SHA-256 и применимые метаданные;
- явный факт, что бинарник уже импортирован и проверен;
- запрет скачивать, регенерировать, переименовывать или повторно загружать файл.

Если файл отсутствует в указанном base, Codex останавливается до реализации.
