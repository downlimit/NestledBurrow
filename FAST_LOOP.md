# Скорость разработки NestledBurrow

Этот файл хранит человеческие ретроспективы. Он не читается перед обычной задачей; исполняемые правила находятся в `AGENTS.md`.

## Что оптимизируется

Уменьшаются активное время и расход лимитов на действия агента, которые не добавляют качества:

- лишнее чтение;
- повтор уже действительного proof;
- преждевременные commit/push/PR;
- disposable CI;
- частый polling;
- повторная диагностика одной и той же среды.

Не считаются потерями пользовательский feedback, тестирование ощущения и расширение связного результата прямыми комментариями.

## Целевой цикл

```text
компактное ТЗ
→ targeted implementation
→ managed preview
→ любое число feedback-итераций
→ `принято`
→ preflight current main
→ минимальная публикация
→ один Ready PR
→ один final-head CI
→ repair только при реальном failure
→ merge
```

## Подтверждённые уроки

### Задачи #030–#035

- full check/build/E2E после принятого preview часто дублировали PR CI;
- Windows/Python/permissions создавали повторные ручные обходы;
- `src/main.js` концентрировал orchestration;
- preview находил важные UX-дефекты, недоступные contract tests.

Решения: portable Python launcher, OS-temp artifacts, Fast publication и архитектурные owners.

### Публикация #035

PR был открыт на устаревшей базе, первый CI стал одноразовым, затем потребовались rebase и второй CI.

Решение: accepted commit становится потомком current `origin/main` до первого push/PR.

### Задачи #038–#044

- #038 и #039 показали нормальный маршрут: один содержательный repair и финальный CI;
- #040 использовала Draft PR как development loop, создала много отменённых CI, была преждевременно смёржена и затем полностью reverted;
- #041 получила несколько зелёных PR, потому что ранние proofs не воспроизводили полный browser lifecycle;
- #042–#044 вернулись к короткому маршруту, но снова увеличили `src/main.js`.

Решения:

1. Draft до приёмки только по прямой просьбе пользователя и никогда как default CI-gate.
2. Persistence/scene lifecycle доказывается одним end-to-end пользовательским сценарием.
3. Product, roadmap и system memory разделены; исполнители не читают весь проект.
4. `src/main.js` получил hard line budget и обязан перестать расти.

### Задачи #089–#091

- #089/#090 и особенно #091 показали повторяющийся post-acceptance bottleneck: уже принятая игровая работа превращалась в несколько CI/repair циклов;
- часть repair относилась к legacy E2E, timing assumptions и CI/test infrastructure, а не к принятому observable result;
- широкие проверки сами по себе пока не признаны лишними: проблема в расходовании ограниченного Codex-контекста на длинный integration tail.

Решение: после одного обычного publication cycle и не более одного task-local repair Codex использует `codex-delivery-escalation:v1` при повторном либо unrelated failure. ChatGPT-Интегратор принимает текущую ветку/PR и самостоятельно заканчивает repair, CI и merge. Codex quota остаётся прежде всего для реализации и feedback-итераций игры.

### Task #093

- локальный publication gate повторял `git diff --check`, а Strict route мог повторно запускать полный `npm run check`;
- Codex обязан был гонять полный Playwright локально, после чего GitHub повторял тот же broad regression;
- GitHub запускал browser shards параллельно со static validation, поэтому заведомо красный contract head всё равно расходовал browser runners и мог породить несвязанный диагностический шум;
- `check:task-091` существовал, но не входил в полный `npm run check`.

Решение: Codex publication остаётся targeted и не зеркалит full CI. GitHub сначала выполняет owner/system contracts, затем historical regressions и build; browser shards стартуют только после зелёного static gate. Полный `npm run check` сохраняет покрытие, но структурирован как owner → history → build, включая regression #091.

## Когда менять процесс снова

Новая process-задача оправдана, когда:

- один дорогой hidden-action bottleneck повторился минимум дважды;
- Fast publication регулярно не достигает Ready PR за несколько минут активной работы;
- среда требует ручного вмешательства пользователя;
- существует риск повреждения `main`, save или пользовательских assets;
- системная документация снова расходится с фактическим контрактом из-за отсутствующего owner.

Иначе приоритет принадлежит gameplay/content.
