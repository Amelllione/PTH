# Нефункциональные требования

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 16. Нефункциональные требования

Все численные значения ниже — предлагаемые цели для приёмки, их нужно утвердить. Референс: 4 vCPU, 16 GiB RAM, SSD, API+worker+PostgreSQL; 10 000 текущих артефактов, 50 000 активных связей, 100 000 revisions; 5 активных клиентов. Измерения без задержки внешних LLM/Git provider и без крупной загрузки файла.

| ID | Требование / критерий | Основание |
| --- | --- | --- |
| PTH-NFR-001 | Ни одного частично применённого ChangeSet в failure/concurrency tests | PTH-FR-024 |
| PTH-NFR-002 | Revision/source/commit/baseline identity неизменяема штатным API; invariant tests обязательны | PTH-FR-002, PTH-FR-003, PTH-FR-062 |
| PTH-NFR-003 | GET entity/search p95 ≤500 ms; structured search с filters измеряется отдельно | PTH-FR-008, PTH-FR-065 |
| PTH-NFR-004 | Локальный graph до 200 nodes p95 ≤2 s; larger graph progressive/job | PTH-FR-019, PTH-FR-033 |
| PTH-NFR-005 | Явный impact до 2000 visited nodes p95 ≤5 s; больше — 202 и progress | PTH-FR-027, PTH-FR-073 |
| PTH-NFR-006 | Context manifest без semantic generation p95 ≤3 s в оговорённом budget | PTH-FR-035, PTH-FR-038 |
| PTH-NFR-007 | Rate limits и resource budgets защищают API; операции не имеют unbounded traversal/output | PTH-FR-033, PTH-FR-069 |
| PTH-NFR-008 | Transport TLS при нелокальном доступе; secrets не попадают в bundles/logs/export | PTH-FR-070, PTH-FR-071 |
| PTH-NFR-009 | Все canonical mutations имеют AuditEvent; missing audit — ошибка транзакции | PTH-FR-072 |
| PTH-NFR-010 | Повтор запроса/CI event не создаёт повторный эффект в retention window ≥30 дней; source/commit uniqueness постоянна | PTH-FR-026, PTH-FR-049 |
| PTH-NFR-011 | Один query/bundle использует consistent snapshot; derived pending не выглядит completed | PTH-FR-029, PTH-FR-037 |
| PTH-NFR-012 | Proposed RPO ≤24 h, RTO ≤2 h для reference deployment; квартальный restore exercise | PTH-FR-074 |
| PTH-NFR-013 | Docker Compose запускает demo project/API/UI/worker; smoke workflow описан в README | PTH-FR-069, PTH-FR-073 |
| PTH-NFR-014 | JSON export содержит revisions, links, hashes и mappings для переноса без зависимости от UI | PTH-FR-063 |
| PTH-NFR-015 | API contract tests и backward compatibility в пределах /v1; breaking change — новая версия | PTH-FR-069 |
| PTH-NFR-016 | UI доступен с клавиатуры; цвета не единственный сигнал; long forms/diff не теряют input на conflict | PTH-FR-065, PTH-FR-066 |
| PTH-NFR-017 | Метрики jobs/latency/conflicts/stale counts/outbox backlog и correlated request traces | PTH-FR-073, PTH-FR-076 |
| PTH-NFR-018 | Historical replay bundle/baseline даёт те же тексты и hashes; результаты нового LLM-вызова не обязаны совпадать | PTH-FR-037, PTH-FR-062 |
| PTH-NFR-019 | Project access isolation проверяется negative API tests по чтению/графу/export/write | PTH-FR-070, PTH-FR-078 |
| PTH-NFR-020 | Сервер масштабируется без sticky memory state; durable drafts/jobs переживают restart | PTH-FR-016, PTH-FR-073 |
| PTH-NFR-021 | Статус трассировки и список потерянных для референса §16 отдаются за p95 ≤1 s; пересчёт после ChangeSet инкрементальный, не полный | PTH-FR-079, PTH-FR-080 |

Пример limits P0: source text ≤10 MiB; attachment ≤50 MiB; ChangeSet ≤1000 operations и ≤5 MiB JSON; graph response ≤200 nodes по умолчанию; context budget задаётся явно. Превышение допускается через chunking/jobs или отдельную настройку администратора, а не скрытое усечение.

SLA промышленной доступности и горизонтальная многорегиональная репликация не обещаются в P0.
