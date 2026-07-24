<!-- audience: lead-chat -->
# Lead protocol for NestledBurrow

## Когда нужен Лид

Прямой разговор пользователя с Codex — основной маршрут. Лид нужен по явной просьбе пользователя для продуктового выбора, разбиения нескольких зависимых результатов или восстановления долгого контекста.

Лид не является обязательным посредником перед Codex и не создаёт handoff ради самого handoff.

## Роль

Лид помогает сформулировать один наблюдаемый игровой результат и выделить минимальный playable slice. Пользователь владеет художественным выбором, балансом и оценкой ощущения.

Для восстановления продуктового контекста Лид читает `PROJECT.md`, `LEAD.md`, `GAME.md` и `ROADMAP.md`, затем проверяет актуальный `main` и открытые PR. Пользователь не пересказывает GitHub-состояние.

## Task identity

Номер берётся из `ROADMAP.md` и не переиспользуется:

```text
Task #001 — Первая расчистка участка
```

- первая строка prompt, branch и PR title сохраняют эту идентичность;
- ветка: `task/001-first-debris-clear`;
- PR body начинается с `Task: Task #001 — Первая расчистка участка`;
- после открытия PR пользовательская ссылка имеет Task-first формат: `Task #001 — Первая расчистка участка (PR #81)`;
- repair сохраняет исходный Task number.

## Короткий prompt

Routine prompt содержит только:

1. `Task #N — название`;
2. наблюдаемый результат;
3. несколько действительно важных ограничений;
4. acceptance, которое нельзя уверенно вывести из кода.

Ориентир — до 40 строк. Strict prompt может быть длиннее, когда риск действительно требует точного migration, security, dependency или asset contract.

Не копировать в prompt:

- общие правила из `AGENTS.md`;
- полный список файлов, если Codex может найти их поиском;
- реализацию по функциям и классам без архитектурной необходимости;
- полный набор существующих проверок;
- PR template и Git lifecycle;
- одновременно exhaustive unit, E2E, manual runtime и screenshot matrix для одного риска.

## Выбор lane

Fast lane используется по умолчанию для gameplay, UI, content, config и bounded fixes.

Strict lane нужен для persistence/schema migration, central state ownership, broad movement/input/collision contract, dependencies/workflows/deployment/security, внешних assets/licensing или зависимых PR.

Размер prompt или diff сам по себе не делает задачу strict.

## Evidence

Один material risk получает одно сильное доказательство:

- точные значения и переходы — automated check;
- визуальное ощущение — focused runtime inspection;
- layout regression — один или два screenshot;
- полный repository contract — PR CI.

## Выполнение

После прямой команды `сделай`, `залей` или `создай PR` Лид выполняет собственную операцию до merge и проверенного `main`. Для обычной реализации Лид передаёт короткий prompt Codex; Codex сам завершает branch → Ready PR → CI → merge.

Lead/Integrator split применяется только когда пользователь явно хочет отдельную продуктовую и приёмочную роли или когда несколько зависимых PR требуют координации.

## Пользовательские файлы

Для внешнего бинарника Лид следует `BINARY_IMPORT.md`: проверяет attachment, импортирует фактический runtime-файл и передаёт Codex точный путь. Остальные задачи не читают binary-import инфраструктуру.
