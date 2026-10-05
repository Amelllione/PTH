# Архитектура и реализация

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 15. Архитектура и реализация

### 15.1. Предлагаемый стек

| Слой | Рабочий вариант | Причина |
| --- | --- | --- |
| API/application | Python + FastAPI + Pydantic | Типизированный JSON/OpenAPI, удобные адаптеры для ИИ |
| Persistence | PostgreSQL + SQLAlchemy/Alembic | Транзакции, immutable revisions, relational graph и индексы |
| Jobs | Worker с durable PostgreSQL queue/outbox | Первый релиз без отдельного orchestration cluster |
| UI | React + TypeScript | Типизированные формы, client state и анализ |
| UI styles | Tailwind и согласованная component library | Единообразные карточки/таблицы/формы |
| Graph UI | React Flow либо эквивалент после spike | Локальный граф и взаимодействие с узлами |
| Files | S3-compatible или local object store с backup | Immutable sources/attachments и hash checking |
| Git | Provider-neutral git adapter/CLI в worker | Проверяемые objects, refs, diffs, reachability |
| AI access | REST SDK + MCP adapter + Claude skill pack | Общая доменная логика для разных клиентов |
| Delivery | Docker Compose | Простое локальное/self-hosted развёртывание |

Конкретные версии фиксируются lockfiles при начале реализации. Это предлагаемый стек, не пользовательское обязательное ограничение. Neo4j, vector DB, Temporal, Kafka и собственный LLM gateway не требуются для первого релиза.

### 15.2. Границы модулей

- project-access: Project, memberships, tokens, capabilities.
- knowledge-registry: Artifact, Revision, Schema, aliases, sources.
- traceability: Relation, paths, obligations, coverage.
- change-control: ChangeSet, validation, impact, review, policy.
- ai-context: bundles, AgentRun, MCP/SDK contracts.
- repository-integration: Git, code refs, commits, CI manifests.
- verification: TEST, PSI, TestRun, Evidence, readiness.
- snapshots-reporting: Baseline, exports, assessments.
- operations: jobs, outbox, audit, retention, backup.

Это модульный монолит: один API-процесс и worker, одна транзакционная БД. Наличие модулей не означает отдельные микросервисы.

### 15.3. Поток команды

UI/MCP/CLI → authentication → command schema → authorization/policy → application service → transaction/revisions/audit/outbox → worker analysis/integrations → results/notifications.

Сервер не обращается к LLM внутри apply-транзакции. Semantic analysis — отдельный job либо findings от внешнего агента. В API response видно, какие проверки уже выполнены и какие pending.

### 15.4. Индексы и выборки

Индексы: artifact(project,type,status), unique display_id; alias namespace+external_id; relation(from/to,type,status); source(hash); commit(repo,format,oid); code_ref(repo,oid,path); findings(project,status,subject); jobs(state,available_at).

Graph traversal: adjacency в PostgreSQL, bounded recursive queries или traversal worker. Arbitrary unbounded paths запрещены. Векторный поиск можно добавить в P1 как индекс, не источник canonical links.

### 15.5. Baseline snapshot

Baseline manifest хранит выбранные artifact revision IDs, relation revision IDs, schemas/policies/rule versions, source refs, repo commit OIDs и scope. Snapshot создаётся из consistent graph_revision.

К baseline можно позднее прикреплять assessments/runs отдельными append-only записями; её manifest/hash не меняется. Для исторического просмотра relation confirmation берётся из pinned revision, а актуальность отображается относительно выбранного assessment mode.

### 15.6. Безопасность и isolation

Project-level access применяется к search, paths, exports, source bytes и Git refs. Отсутствие доступа не должно раскрывать title закрытого узла через path.

Uploaded bytes имеют limits и MIME validation. Connector запускает фиксированные Git операции без shell interpolation полей. В credentials storage secrets шифруются; responses/logs их исключают.

API keys ограничены project/capability и сроком, отзыв немедленный. UI auth использует защищённую session; request IDs и on_behalf_of сохраняются. Агент не может присвоить себе human issuer.

Произвольное исполнение проверок и кода на сервере не входит в P0. CI выполняет тесты во внешней среде и передаёт results.
