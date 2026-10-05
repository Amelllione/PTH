# UI для просмотра, анализа и изменения

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 12. UI для просмотра, анализа и изменения

### 12.1. Навигация

Проект выбирается явно. Основные разделы: Overview, Registry, Sources, Graph, Changes, Reviews, Lost, Code, Verification, Baselines, Settings.

По умолчанию Overview показывает coverage gaps, needs_review и последние ChangeSet. Постоянная верхняя строка указывает project, current/baseline mode и graph_revision. Historic mode визуально отделён от текущего.

### 12.2. Экраны

| Экран | Основные данные и действия |
| --- | --- |
| Overview | Counts по типам/статусам, открытые gaps, stale evidence, последние jobs/changes; без ложного общего «всё выполнено» |
| Registry | Таблица ID/title/type/status/owner/freshness, saved filters, поиск, bulk proposal |
| Artifact detail | Текст, attributes, источник, входящие/исходящие связи, code/test/evidence, revisions и decision history |
| Source / import | Оригинальная структура + highlighting fragments/entities; unprocessed/open issues; import report и mapping |
| Local graph | Выбранный узел, связи, direction/depth/type filters; progressive expand, path selection; панель деталей выбранного узла (текущая ревизия, статус, связи, код и проверки, история); фильтр «только потерянные» |
| Lost requirements | Список потерянных с причиной, приоритетом, последним commit и рекомендуемым действием; фильтры по priority, release, owner, baseline; переход в карточку или на граф |
| Traceability matrix | Строки requirements, столбцы source/design/code/commit/test/evidence; missing/stale cells |
| ChangeSet editor | Draft text/fields/links; before/after diff, operations, conflicts, validation и impact |
| Impact view | Изменённые/прямые/транзитивные/предположительные объекты, grouped by component, explain path |
| Review inbox | Причина изменения, субъект, противоречие или gap, owner/scope, resolution action |
| Code/commit | Repo/ref/SHA/tree/parents, изменённые files, trace links, reachability, run/test results |
| Verification / PSI | TEST, coverage obligations, ПСИ draft, runs/results, missing measurement conditions |
| Baseline/release | Immutable manifest, comparison, Git heads, readiness policy и exclusions |
| Settings | Memberships, service capabilities, integrations, policies, schema version и retention |

### 12.3. Подсветка влияния

Рекомендуемые значения визуальных маркеров:

- «Изменяется»: объект входит в операции ChangeSet.
- «Требует перепроверки»: явное правило влияния или obsolete confirmation.
- «Возможно затронут»: inferred semantic candidate.
- «Нарушение»: воспроизводимая ошибка либо подтверждённое противоречие.
- «Данных недостаточно»: pending/truncated/no evidence.

Цвет всегда сопровождается текстом/иконкой. Требует перепроверки не обозначается как нарушенное требование. Sidebar причины показывает path, rule_id, affected fields и against revisions.

### 12.4. Редактирование

Autosave сохраняет только draft. Apply — отдельное действие, доступное по policy. Для небольшого изменения UI автоматически создаёт ChangeSet и запускает быстрый impact, но пользователь видит его ID.

Связь создаётся из карточки через type selector: допустимые target types, direction, scope и basis. Drag graph edge может быть альтернативным способом, но не единственным.

Разрешение review предлагает: обновить объект; проверить и подтвердить отсутствие влияния; заменить связь; принять scoped waiver. Ни одно действие не стирает историю.

409 открывает comparison current/base/proposed; введённый текст не теряется. UI не делает hidden overwrite.

### 12.5. Масштаб и доступность

Граф отображает локальное окружение, а не все тысячи узлов. Первая загрузка ≤200 nodes; дополнение по запросу. Подграф с truncation имеет явное сообщение и ссылку на полный табличный список.

Deep links: /projects/{key}/artifacts/{display_id}?revision=...; /projects/{key}/graph?focus={display_id}&depth=...; /projects/{key}/lost?priority=...; /changesets/{uid}; /commits/{uid}; /baselines/{uid}. Один и тот же ID можно копировать для Claude.

Tables virtualized, filters in URL, keyboard navigation, focus states, no color-only semantics. Источники и API-ошибки отображаются безопасно, без исполнения HTML из документа.
