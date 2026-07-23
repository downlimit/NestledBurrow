<!-- audience: lead-chat -->
# Binary import bridge

## Назначение

Этот документ фиксирует честный контракт доставки пользовательских бинарных attachments в `downlimit/NestledBurrow`.

Главное ограничение: repository-side reconstruction умеет **собрать** бинарник из уже доставленных chunks, но сам по себе не создаёт канал передачи байтов из ChatGPT в GitHub.

Пользователь не обслуживает GitHub вручную. Лид либо самостоятельно выполняет подтверждённый импорт, либо останавливается до любых GitHub-записей и кратко сообщает реальный capability blocker. Запрещено маскировать отсутствие канала доставки временными ветками, workflow или нерабочим ТЗ Codex.

## Источник истины

Источник истины — точные байты приложенного пользователем файла.

Внешняя ссылка, CDN URL, исходная страница генератора или файл с тем же названием не заменяют attachment. Их можно использовать только по прямому разрешению пользователя либо после заранее доказанного совпадения размера и SHA-256.

При первом несовпадении размера или SHA-256 этот транспортный путь закрывается. Запрещено менять ожидаемый hash, брать похожую версию, создавать временные workflow или выдавать Codex путь к отсутствующему файлу.

## Capability preflight до первого GitHub write

До создания branch, commit, PR, workflow run, artifact или task-файла Лид обязан локально:

1. полностью прочитать attachment;
2. вычислить byte length и SHA-256;
3. проверить decode и применимые метаданные;
4. определить канонический target path;
5. открыть актуальную схему доступных GitHub tools;
6. доказать полный end-to-end transport точных байтов, а не только формат будущей реконструкции;
7. оценить суммарный payload, число внешних событий и время операции.

Импорт разрешён только когда выполняется хотя бы одно условие:

- GitHub action принимает настоящий file parameter или mounted/local file reference;
- локальная среда имеет рабочие Git credentials и может выполнить обычный binary commit/push;
- пользователь прямо разрешил внешний URL, и получаемые байты совпадают по размеру и SHA-256;
- полный base64 attachment безопасно помещается в один подтверждённый `create_blob(..., encoding: base64)` вызов.

Если ни одно условие не выполнено, импорт в текущем tool runtime считается **технически недоступным**. GitHub остаётся неизменным, Codex-задача не выдаётся.

## Важное ограничение строкового create_blob

Текущий GitHub `create_blob` принимает буквальное строковое поле `content`; он не читает локальный путь и не преобразует mounted file автоматически.

Разбиение base64 на маленькие chunks решает только лимит **одного аргумента**. Оно не устраняет необходимость передать весь aggregate payload через контекст модели и последовательность tool calls.

Поэтому запрещено считать крупный attachment доставляемым только на основании того, что каждый отдельный chunk помещается в `create_blob`.

В частности:

- наличие локально подготовленных `.b64` файлов не означает, что connector может их загрузить;
- repository-side bridge не обходит aggregate context/tool-payload budget;
- нельзя начинать многодесятковую цепочку строковых blob-вызовов без заранее доказанного полного бюджета;
- отсутствие file parameter является реальным capability blocker для крупного attachment, а не поводом экспериментировать через GitHub.

До появления file-capable GitHub action или локального авторизованного Git пути Lead-chat поддерживает через строковый connector только бинарники, которые целиком проходят подтверждённым single-call transport.

## Поддерживаемый небольшой бинарник

Когда полный base64 attachment помещается в один подтверждённый вызов:

```text
attachment bytes
→ create_blob(base64)
→ create_tree
→ create_commit
→ update_ref
→ read-back
```

Base64 здесь только transport encoding. В репозитории должен оказаться настоящий runtime-файл.

## Repository-side reconstruction bridge

Bridge остаётся допустимым инфраструктурным форматом только для среды, которая **уже имеет доказанный способ доставить все chunks в GitHub**: file-capable connector, локальный Git push или другой явно разрешённый точный transport.

Bridge не является самостоятельным способом вытащить attachment из ChatGPT.

Когда доказанный транспорт существует:

1. точные attachment bytes преобразуются в один canonical base64 string;
2. строка делится на ordered chunks;
3. создаётся manifest с target path, byte length, SHA-256 и порядком chunks;
4. chunks, `manifest.json` и `READY` входят в один tree/commit;
5. выполняется один ref update в `asset-import/**`;
6. `.github/workflows/binary-import.yml` один раз реконструирует runtime-файл;
7. staging удаляется только после успешных byte-length и SHA-256 checks;
8. Лид считывает runtime-файл обратно до Codex handoff.

Manifest:

```json
{
  "version": 1,
  "targetPath": "public/assets/audio/music/example.mp3",
  "byteLength": 3977087,
  "sha256": "lowercase-64-character-sha256",
  "chunks": ["0000.b64", "0001.b64"]
}
```

## Антиспам-инварианты

Цель Lead-owned подготовки — ноль писем. Допустим максимум один заранее доказанный reconstruction run, когда без него технически нельзя.

Запрещено:

- делать GitHub write до capability preflight;
- создавать branch только для проверки, получится ли загрузка;
- делать ref-update на каждый chunk;
- отдельно пушить manifest и `READY`;
- открывать PR до появления настоящего runtime-файла;
- использовать PR или Actions как диагностическую консоль;
- добавлять asset-specific jobs в общий `pr-check.yml`;
- добавлять временный workflow в `main`;
- многократно менять trigger/marker ради повторного запуска;
- создавать diagnostic artifacts как альтернативный путь доставки;
- после понятного capability blocker продолжать repair-push;
- выдавать Codex expected path вместо существующего файла.

Если transport не доказан, операция прекращается без единого GitHub event. Если единственный заранее доказанный run завершился ошибкой, разрешён максимум один консолидированный repair после чтения полного лога.

## Проверка готового файла

До Codex handoff Лид подтверждает:

- runtime-файл существует по точному пути в Base SHA;
- GitHub возвращает настоящий binary blob;
- byte length и SHA-256 совпадают с attachment;
- формат декодируется;
- применимые metadata ожидаемы;
- source/license записаны, когда это требуется.

## Codex handoff

Codex не отвечает за импорт или реконструкцию attachment.

После завершённого импорта prompt содержит только:

- Base SHA;
- repository/runtime path;
- SHA-256 и применимые метаданные;
- требуемое runtime-поведение;
- запрет изменять, скачивать, регенерировать или заменять asset.

В prompt не копируются chunks, manifest, `READY`, workflow или механика reconstruction. Если runtime-файл отсутствует в Base SHA, Лид не выдаёт задачу.
