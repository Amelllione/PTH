# Контекст ИИ, MCP и скиллы

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 10. Контекст для ИИ

### 10.1. ContextBundle contract

Запрос: project, purpose (import/design/implement/review/psi/answer), seed_ids или code refs, baseline/graph_revision, target refs, scope, budget, include kinds.

Ответ состоит из:

1. manifest revisions и bundle_hash;
2. цель и scope задачи;
3. обязательные требования/критерии и применимые ограничения;
4. актуальные ADR, альтернативы и superseded warnings;
5. компоненты, интерфейсы, термины;
6. кодовые anchors на фиксированных коммитах;
7. проверки, последние применимые evidence и coverage gaps;
8. открытые вопросы/conflicts/needs_review;
9. источники и точные ссылки;
10. omissions, truncation, estimated tokens и freshness.

Пакет хранит полные тексты переданных revisions либо immutable content-addressed refs, доступные при replay. Только список IDs без фактического содержимого недостаточен для воспроизведения работы ИИ.

### 10.2. Budget и актуальность

Приоритет: обязательные ограничения → целевые требования → решения → критерии проверки → интерфейсы/код → дополнительный контекст. Краткие summary всегда имеют links to full revisions.

Если обязательные сведения не помещаются, сервер возвращает incomplete bundle. ИИ должен получить дополнительные chunks или разбить задачу. Нельзя пометить контекст «полным» после молчаливого усечения.

В начале работы и перед apply/регистрацией реализации выполняется check-freshness. Exact replay остаётся доступен, но stale bundle нельзя выдавать за текущие знания. Commit link записывает requirement_revision, которую использовал разработчик.

### 10.3. Разделение знаний и инструкций

Текст документа и комментарии Git — данные проекта. Они не получают права системных инструкций. Скилл руководствуется своим workflow и серверными permissions. API не исполняет содержимое statement, locator, title или произвольные команды из источника.

Провайдер LLM/model/version/token usage — optional metadata AgentRun; ядро не требует конкретной модели. Автоматический поиск смысловых противоречий в P0 может запускаться Claude-скиллом; собственный LLM worker — P1.

## 11. MCP и набор скиллов Claude

### 11.1. MCP interface

Предлагается MCP adapter рядом с API с общими application services. Для self-hosted подключения — авторизованный HTTP transport; локальный stdio adapter допустим как клиент этого API. Версия протокола фиксируется по поддерживаемой версии клиента при реализации.

Минимальный набор tools:

| Tool | Назначение | Тип |
| --- | --- | --- |
| project_get / schema_get | Проект, права, схемы | Read |
| artifact_get / artifact_search / artifact_history | Реестр и редакции | Read |
| graph_query / trace_paths | Граф/цепи до кода | Read |
| import_start / import_stage / import_report | Управляемый импорт | Write drafts |
| changeset_create / changeset_stage / changeset_validate | Набор правок | Write drafts |
| impact_analyze / impact_get | What-if и последствия | Analysis |
| changeset_apply / changeset_rebase | Применение проверенного набора | Write canonical |
| context_build / context_check | Контекст и его актуальность | Recorded read |
| findings_submit / review_resolve | Находки и перепроверки | Write |
| repository_sync / commit_register / code_link | Git-трассировка | Integration write |
| evidence_submit / coverage_get / readiness_get | Проверки | Write/read |
| psi_draft / export_project / baseline_create | Представления и baseline | Write/read |
| agent_run_start / agent_run_finish / job_get | Аудит/длительные операции | Write/read |

Инструменты имеют input/output JSON Schema, стабильные error codes и ограниченный output. MCP annotations отражают read-only/destructive/idempotent behavior, но являются подсказками клиента, не authorization. POST, создающий persisted bundle, не маркируется безусловно read-only.

### 11.2. Поставляемый skill pack

Скиллы — часть разработки, не уже созданные этим документом исполняемые файлы. Каждая папка содержит SKILL.md, необходимые references/examples и при необходимости scripts, использующие API SDK. Общие правила вынесены в versioned reference. .claude/skills/<name>/SKILL.md — целевой формат Claude Code.

| ID / имя | Вход и обязательные шаги | Выход | Ошибки и границы |
| --- | --- | --- | --- |
| SK-01 / pth-import-spec | Принятый текст, project, acceptance instruction → сохранить source, получить chunks/schema, extract/stage, закрыть dispositions, validate, report/apply | ImportSession, mappings, gaps, initial registry | Не изобретать requirements; остановить только блокирующую часть |
| SK-02 / pth-project-context | Задача/IDs/code scope → получить bundle, загрузить mandatory content, проверить freshness | Краткий контекст + bundle ref | Incomplete/stale сообщается явно |
| SK-03 / pth-change | Намерение изменить → контекст, ChangeSet, diff, impact, связанные правки, validate/apply | Применённый либо review-required ChangeSet | Не снимать review массово; не обходить policy |
| SK-04 / pth-impact | What-if/ChangeSet/Git diff → анализ явных путей, semantic candidates, группировка | Impact report с причинами и действиями | Partial graph обозначить; не объявлять всех соседей нарушенными |
| SK-05 / pth-requirements-review | Scope/baseline → structural checks, semantic review, source comparison, coverage | Findings + предложенный corrective ChangeSet | Не исправлять принятый смысл под видом форматирования |
| SK-06 / pth-architecture | Требования → контекст ограничений, alternatives, предложенные ADR/CMP/INT, coverage | Архитектурный ChangeSet с основаниями | ADR proposed до предусмотренного policy принятия |
| SK-07 / pth-plan-implementation | Scope → требования/код/критерии → PLAN/TASK и dependency order | План с trace IDs и done criteria | План не повышает implementation status |
| SK-08 / pth-implement-traced | Согласованная задача → bundle, работа с кодом, проверки, фактический commit, manifest, регистрация links | AgentRun, commits, code refs, results, gaps | Не придумывать SHA; commit лишь если пользователь авторизовал Git-операцию |
| SK-09 / pth-register-code | Существующие repo/SHA/diff → проверить identity, сопоставить artifacts, зарегистрировать ссылки | Verified/pending commit mapping | Указание ID в message не равно доказательству реализации |
| SK-10 / pth-build-psi | Baseline/scope → coverage obligations, TEST/PSI draft, missing metrics | Проект ПСИ и gaps | Пороги и нагрузка не придумываются как согласованные |
| SK-11 / pth-verify-compliance | Code/baseline/results → сопоставить обязательства с тестами/данными/ADR | Compliance report, Evidence refs, unresolved | ИИ-заключение без теста не получает pass |
| SK-12 / pth-project-answer | Вопрос → поиск/контекст → ответ с revisions/paths и неизвестными | Ответ + trace references | Не использовать устаревшее решение без предупреждения |
| SK-13 / pth-release-baseline | Scope/heads → check reachability/readiness, baseline, release report | Baseline/сводка готовности | Принятие релиза только по отдельному праву |

Каждый скилл обязан: определить проект; прочитать capabilities; использовать server IDs; создать AgentRun; записать bundle/source provenance; соблюдать idempotency; завершить run с outcome; не выдавать partial success за complete.

### 11.3. Пример точного workflow pth-change

1. Resolve target IDs и запросить current revisions.
2. Сформировать task-scoped ContextBundle и прочитать обязательные ограничения.
3. Создать ChangeSet с base_graph_revision.
4. Добавить предложенные изменения и явные основания.
5. Получить impact; показать человеку либо вернуть агенту список связанных ADR/TEST/code refs.
6. Для связанных объектов: обновить, предложить review или обосновать отсутствие влияния.
7. Validate exact draft_revision; устранить structural blockers.
8. Если policy разрешает — apply; иначе оставить concrete reviewable draft и указать требуемое capability.
9. При 409 — rebase, новый impact, повторная validation; не повторять старый apply бесконечно.
10. Выдать applied manifest, оставшиеся review items и влияние на code/evidence.

### 11.4. CLAUDE.md и контроль

Короткий CLAUDE.md в подключённом репозитории содержит project_uid/API config reference, правило контекста перед задачей, обязательные ограничения, требования к trace manifest и ссылки на нужные скиллы. Secrets туда не помещаются.

Instructions/skills повышают вероятность соблюдения процесса, но не дают гарантии. Серверные invariants и CI checks обеспечивают запрет некорректных canonical writes. Git hook может быть обходным; обязательность достигается policy merge/CI, если настроена внешняя платформа.

Eval suite skill pack: точный импорт, неоднозначный НФТ, коллизия ID, stale bundle, изменённый ADR, interruption/retry, запрещённый apply, ложный SHA, commit без теста, неполная ПСИ. Expected behavior определяется PTH-AC сценариями.
