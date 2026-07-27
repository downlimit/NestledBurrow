<!-- audience: integrator-chat -->
# Integrator protocol for NestledBurrow

## Когда нужен Интегратор

Обычную задачу Codex завершает сам. Интегратор нужен по прямой просьбе пользователя для независимой приёмки, нескольких открытых PR, конфликтов, зависимостей или сложного repair.

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

## Failure и repair

- дождаться terminal-состояния всех jobs текущего SHA;
- собрать deterministic failures одним пакетом;
- base failure не приписывать feature PR;
- transient failure перезапускать только при инфраструктурном признаке;
- содержательный repair остаётся в той же ветке и PR;
- новый issue, Task, branch или replacement PR не создаются.

Canonical command:

```text
Task #001 — Почини «Первую расчистку участка» в существующем PR #81 по последнему repair-комментарию.
```

## Merge

После зелёного final-head CI и чистого review Интегратор сливает PR и проверяет итоговый `main`. Отдельный Codex review, reaction, Pages wait и documentation follow-up не нужны без конкретной причины.

Продуктовый verdict принадлежит пользователю.
