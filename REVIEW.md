<!-- audience: integrator-chat -->
# Integrator protocol for NestledBurrow

## Когда нужен Интегратор

Обычную задачу Codex завершает сам. Интегратор нужен по прямой просьбе пользователя для независимой приёмки, нескольких открытых PR, конфликтов, зависимостей, сложного repair или после `codex-delivery-escalation:v1`.

Пользователь не обслуживает ветки, SHA, CI или merge.

## Минимальный контекст

Интегратор читает `PROJECT.md`, `REVIEW.md`, получает все применимые PR и их final-head CI. Затем через `LIBRARY.md` открывает только system-документы, затронутые diff.

Не читать заранее весь `GAME.md`, `ROADMAP.md`, все system-документы, старые tasks или историю репозитория.

Команда `проверь все PR` означает обработать все открытые non-draft PR в `main`; Draft включаются, когда пользователь явно просит полный список.

## Task-first адрес

```text
Task #001 — Первая расчистка участка (PR #81)
```

Task identity первична и сохраняется при repair/rebase.

## Один review-pass

1. Получить metadata, diff, mergeability и final-head CI.
2. Проверить observable result и critical invariants затронутых систем.
3. Использовать уже существующее сильное evidence.
4. Дочитать surrounding code только для рискованных мест.
5. Merge либо выдать один полный repair contract.

Не требовать одновременно screenshots, local full suite, удалённый E2E и ручной smoke для одного риска.

## Codex delivery escalation

Блок, начинающийся с `codex-delivery-escalation:v1`, является прямой просьбой пользователя переключить чат в роль Интегратора и продолжить уже принятую публикацию. Его полей достаточно; не просить пользователя приносить логи, diff, SHA или CI-результаты сверх блока.

Интегратор самостоятельно получает PR либо указанную task-ветку, current/accepted head, все terminal CI failures и нужный diff. С этого момента repair, CI и merge принадлежат Интегратору. Не отправлять работу обратно Codex и не просить пользователя снова запускать Codex, если пользователь явно этого не потребовал.

Пользовательское `принято` сохраняет силу. Повторная visual acceptance нужна только если repair меняет player-visible поведение принятого результата; чистая детерминизация теста, CI или невидимый repair её не отменяет.

Если handoff произошёл до создания PR, Интегратор использует опубликованную task-ветку, диагностирует известный failure и создаёт один Ready PR только после получения пригодного candidate head. Не создавать отдельную process-ветку или issue только ради repair.

## Failure и repair

- дождаться terminal-состояния всех jobs текущего SHA;
- собрать deterministic failures одним пакетом;
- base failure не приписывать feature PR;
- transient failure перезапускать только при инфраструктурном признаке;
- содержательный repair остаётся в той же ветке и PR;
- новый issue, Task, branch или replacement PR не создаются.

Canonical command для явного возврата repair в Codex:

```text
Task #001 — Почини «Первую расчистку участка» в существующем PR #81 по последнему repair-комментарию.
```

После `codex-delivery-escalation:v1` эта команда не используется без прямой просьбы пользователя.

## Merge

После зелёного final-head CI и чистого review Интегратор сливает PR и проверяет итоговый `main`. Отдельный Codex review, reaction, Pages wait и documentation follow-up не нужны без конкретной причины.

Продуктовый verdict принадлежит пользователю.
