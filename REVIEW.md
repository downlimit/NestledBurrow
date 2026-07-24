<!-- audience: integrator-chat -->
# Integrator protocol for NestledBurrow

## Когда нужен Интегратор

Codex сам завершает обычную задачу через Ready PR, CI и merge. Интегратор нужен по явной просьбе пользователя для независимой приёмки, нескольких открытых PR, конфликтов, зависимостей или сложного repair.

Пользователь не обслуживает PR, ветки, SHA, CI или merge.

## Восстановление

Новый Интегратор читает `PROJECT.md`, `REVIEW.md`, `GAME.md` и `ROADMAP.md`, затем одним проходом получает применимые PR, Task identity, base/head SHA, changed files, mergeability и final-head CI.

Команда `проверь все PR` означает обработать все открытые PR в `main`, включая Draft, если пользователь явно просит полный список.

## Task-first ссылка

Пользовательский формат:

```text
Task #001 — Первая расчистка участка (PR #81)
```

Task number и название первичны. PR number является вторичным GitHub-адресом. Repair, rebase и повторная приёмка сохраняют исходный Task number.

## Один review-pass

1. Получить PR metadata и final-head CI.
2. Читать diff и surrounding code только для изменённых и реально рискованных мест.
3. Проверить observable result, scope и critical invariants.
4. Использовать уже существующее сильное evidence; не требовать автоматический набор screenshot + E2E + manual smoke.
5. Как только доказательств достаточно, merge или выдать один полный repair contract.

Не исследовать issues, несвязанные ветки, всю историю проекта или процессные документы без конкретного blocker.

## Fast и strict

Fast lane: корректный scope, targeted review и зелёный final-head CI обычно достаточны для merge.

Strict lane дополнительно проверяет конкретный migration/state/dependency/workflow/security/asset risk. Strict не означает повторение всей suite локально и удалённо несколько раз.

## Failure и repair

- Сначала найти точную failing-команду и assertion.
- Один раз сравнить её с current `main`.
- Base failure не приписывать feature PR.
- Transient failure перезапускать только при реальном инфраструктурном признаке.
- Механическую опечатку или очевидный conflict Интегратор может исправить сам.
- Содержательный repair остаётся в существующей PR-ветке.
- Не создавать новый issue, branch, PR или Task number для repair.

Canonical repair command:

```text
Task #001 — Почини «Первую расчистку участка» в существующем PR #81 по последнему repair-комментарию.
```

Repair comment содержит маркер `integrator-codex-repair:v1`, current head SHA, blockers и точные проверки. Публикация комментария не означает запуск Codex; команда пользователя запускает repair.

## Merge

После зелёного final-head CI и чистого review Интегратор сливает PR, проверяет итоговый `main` и сообщает Task-first результат. Отдельный Codex review, reaction, auto-merge workflow, Pages wait и документационный follow-up не требуются по умолчанию.

Проверять deployment или давать cache-busting Pages link нужно только для задачи, которая меняет публикацию, или по прямой просьбе пользователя.

Интегратор не присваивает продуктовый verdict `Принято`, `Переделать` или `Отклонено`; это решение пользователя после игрового теста.
