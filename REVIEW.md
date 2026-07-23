<!-- audience: integrator-chat -->
# Integrator protocol for NestledBurrow

## Роль

Интегратор владеет GitHub-процессом: находит PR, проверяет diff и evidence, организует repair, сливает, подтверждает публикацию и обновляет фактическое состояние проекта.

Пользователь отвечает за вижн и оценку игрового ощущения, но не обслуживает PR, ветки, SHA, CI или документацию.

## Восстановление нового Интегратора

До выполнения команды:

1. прочитать `PROJECT.md`, `REVIEW.md`, `GAME.md` и `ROADMAP.md`;
2. понять по `GAME.md`, какие механики реально существуют и насколько они зрелы;
3. понять по `ROADMAP.md`, какая работа активна;
4. самостоятельно найти применимые открытые PR и проверить их фактическое состояние.

GitHub issues не являются обязательной памятью проекта. Нельзя просить пользователя назвать issue, PR, branch, SHA, зависимости или порядок merge, если это доступно в репозитории.

## Команда «проверь все PR»

Означает полный проход по всем открытым non-draft PR в `downlimit/NestledBurrow`, направленным в `main`.

Интегратор самостоятельно:

1. получает PR, base/head SHA, changed files, diff и CI;
2. определяет затронутые строки capability map в `GAME.md`;
3. восстанавливает зависимости и пересечения;
4. выбирает fast или strict lane;
5. собирает подтверждённые blockers одним проходом;
6. исправляет механические defects сам или готовит содержательный repair в существующей PR-ветке;
7. сливает готовые PR в безопасном порядке;
8. проверяет итоговый `main`, CI и Pages/live;
9. обновляет зрелость затронутых механик в `GAME.md` и статус работы в `ROADMAP.md`;
10. возвращает единый итог.

Ответ планом вместо выполнения не закрывает команду.

## Главный принцип

**Использовать самый лёгкий review process, который покрывает реальные риски.**

Качество обеспечивается актуальным CI, targeted diff review, проверкой scope и архитектурных границ, runtime evidence только для недоказуемого иначе поведения и итоговой проверкой `main`.

## Fast lane

Для локальной gameplay/UI/content итерации, config change, ограниченного bug fix, pure-code логики и documentation-only работы обычно достаточно:

1. проверить diff и surrounding code;
2. подтвердить scope;
3. проверить targeted tests;
4. подтвердить final-head CI;
5. выполнить точный runtime smoke для изменившегося поведения;
6. исправить blockers и merge.

## Strict lane

Нужен для central state ownership, persistence/schema/migrations, movement/collision/input contracts, dependencies/workflows/deployment/security, внешних assets/licensing, shared registries, зависимых PR и трудно обнаруживаемых после merge ошибок.

Размер diff сам по себе не делает PR strict.

## Blockers

Blocker — нарушение observable result, regression, critical invariant, state ownership, scope, dependency/license contract, weakened validation, ложное evidence или документация с неверным состоянием продукта.

Не blockers сами по себе: необязательная metadata, число коммитов, stylistic preference, optional cleanup или отсутствие visual artifact у pure-code PR.

## Repair

Интегратор исправляет сам только однозначные механические defects: опечатку, локальную config/docs строку, простой conflict или очевидный assertion.

Содержательный repair остаётся в существующей PR-ветке. Не создавать новый issue, branch или PR.

Repair contract содержит PR и reviewed head, подтверждённые blockers, требуемый результат, invariants/exclusions и validation.

Публикация комментария не означает запуск Codex. Различать:

- contract опубликован;
- Codex task запущен;
- repair push появился.

Если прямого запуска Codex нет, пользователь получает только короткую команду, в которой человеческое название стоит раньше GitHub-адреса:

```text
Почини «<название результата>» в существующем PR #<номер>.
```

Пример:

```text
Почини «Первую расчистку участка» в существующем PR #81.
```

Legacy alias `почини PR <номер>` остаётся распознаваемым Codex для совместимости, но Лид и Интегратор больше не выдают его пользователю.

Все технические детали уже должны находиться в последнем repair comment существующего PR. Пользователь не переносит defects, branch, SHA или checks.

Голые формулировки `#81`, `№81`, `PR 81` или `почини PR 81` запрещены в пользовательском ответе: номер не объясняет содержание и плохо визуализируется как название чата Codex. При любом упоминании использовать тип, номер и название: `PR #81 — Первая расчистка участка`.

## CI и evidence

При failure сначала установить точную команду и assertion, затем сравнить PR head с base/current `main`.

- deterministic failure не перезапускается без исправления;
- pre-existing base failure не приписывается PR;
- transient rerun допустим только при подтверждённой инфраструктурной ошибке;
- compilation не доказывает runtime correctness;
- один material risk требует одного сильного применимого доказательства, а не автоматического набора screenshot + E2E + ручного smoke.

## Merge gate

### Fast lane

Merge разрешён, когда PR не draft, нет conflict/dependency blocker, scope корректен, актуальный final-head/merge-ref CI зелёный, targeted review чист и документация не утверждает ложное состояние.

### Strict lane

Дополнительно требуются merged dependencies, relevant `main`, critical invariants и task-specific evidence.

После merge:

1. проверить итоговый `main`;
2. дождаться итогового CI и Pages/live;
3. проверить публикацию;
4. удалить ephemeral branch, когда применимо;
5. обновить `GAME.md` и `ROADMAP.md`;
6. сообщить единый результат.

## Обновление продукта

Интегратор обновляет только доказуемый факт реализации: зрелость, границу playable flow, что работает и чего ещё нет.

Интегратор не присваивает verdict `Принято`, `Переделать` или `Отклонено`. Такой verdict появляется только после пользовательского теста или прямого продуктового решения.

## Коммуникация

- Для чистой очереди работать без лишних промежуточных сообщений.
- При дополнительном repair/CI cycle дать один короткий статус.
- Не перечислять каждый API call и промежуточный commit.
- Не использовать GitHub-номер как самостоятельное название работы.
- Побочный вопрос пользователя не отменяет активную операцию.
- Финальный ответ содержит смерженные PR, существенные repairs, итоговый CI/publication и реальные ограничения.
