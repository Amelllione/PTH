# ChangeSet, согласованность и импорт

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 7. ChangeSet, согласованность и автономность

### 7.1. Состав ChangeSet

Изменение включает title/reason, base_graph_revision, actor, on_behalf_of, channel, context_bundle_uid, source refs, operations, expected_revisions, draft_revision и policy_mode.

Операции: create_artifact, revise_artifact, transition_artifact, archive_artifact, create/revise/archive_relation, bind_source, resolve_finding, resolve_review, grant_waiver, register/link_commit, attach_evidence, create_baseline, update_project_policy. Строгие сущности Commit/Evidence/Source имеют специализированные операции; сервер не допускает изменения их прошлого содержимого.

CRUD — это доменные команды. «Любые изменения модели через API» не означает произвольную запись в таблицы или отключение invariant checks.

### 7.2. Состояния

draft → validating → ready → applied; отдельно blocked, cancelled. awaiting_review применяется только при configured policy. Failed job не переводит применённый ChangeSet обратно в draft.

Изменение operations увеличивает draft_revision и инвалидирует validation, impact и review decisions прежней редакции. Apply допускается только для exact hash проверенного набора.

### 7.3. Транзакция apply

В одной DB-транзакции:

1. Проверить authorization и Idempotency-Key.
2. Заблокировать строку проекта и проверить base_graph_revision/expected revisions.
3. Проверить schema, relation constraints, policy и действительность review decisions.
4. Создать revisions, current pointers, mappings и необходимые conservative invalidation markers.
5. Записать AuditEvent и OutboxEvent.
6. Увеличить graph_revision; mark ChangeSet applied.
7. Commit; вернуть result manifest.

Модель graph_revision проекта в v1 оптимистично сериализует apply и может давать конфликт даже при независимых правках. Это сознательный компромисс первого релиза. Rebase API обновляет base и повторяет проверки; auto-merge допускается только для непересекающихся полей без изменения смыслового контекста и с повторным impact.

External Git, LLM и object storage не включаются в DB-транзакцию. Bytes предварительно загружаются и проверяются; операция ссылается на durable object. Недопривязанные uploads удаляются по retention. Git links принимаются verified либо явно pending; pending не считается подтверждённой трассировкой.

### 7.4. Policy автономности

| Класс операции | Предлагаемый режим по умолчанию |
| --- | --- |
| Read/search/context/impact | Без дополнительного согласования в пределах доступа |
| Черновики, findings, proposed links | Разрешены сервисному аккаунту |
| Точная раскладка принятой спеки | Разрешена в импортном scope; acceptance_basis сохранён |
| Изменения реализации в пределах согласованной задачи | Разрешены delegated capability, с тестами/аудитом |
| Новое бизнес-требование, изменение принятых ограничений, принятие ADR | Требуют полномочия человека либо явной заранее заданной делегации |
| Результат CI | Разрешён trusted integration principal |
| Baseline/release acceptance/waiver | По capability, не автоматически для любого ИИ |
| Права, токены, retention | Только admin |

Человек может разрешить автономное выполнение заранее по проекту, типу операции, объектам и сроку. Система не требует повторного подтверждения каждого API-вызова. Подтверждение в чате записывается как указание владельца с происхождением; его нельзя выдавать за криптографически доказанную подпись человека.

### 7.5. Идемпотентность и компенсация

Idempotency-Key scoped к principal/project/operation. Для одинакового key+payload hash возвращается исходный результат. Другой payload с тем же key → 409 IDEMPOTENCY_CONFLICT. Хранятся результат и status; retry после network timeout безопасен.

Компенсация создаёт новые revisions с restore content; если затронутый объект изменён позже, сервер требует rebase/resolve. Исторический commit, Evidence и audit не переписываются.

## 8. Импорт принятой спецификации

### 8.1. Разделение ответственности

Сервер не обязан иметь собственную LLM: Claude выполняет extraction/reasoning через скилл; сервер хранит, валидирует, рассчитывает явные связи и применяет изменения. Это позволяет использовать другие модели без замены ядра.

Задачи сервера: ingestion, fragment manifest, schemas, candidate API, idempotency, deterministic validation, mapping IDs, coverage report, apply.

Задачи Claude: выделить сущности, сформулировать extraction candidates, предложить связи и semantic findings. Предложение новых требований выходит за «точную раскладку».

### 8.2. ImportSession

P0 принимает UTF-8 text/Markdown, JSON interchange и bundle с attachments. DOCX/PDF extraction — P1 отдельный адаптер; их не следует молча включать в стоимость первой версии.

Chunk manifest строится сервером по структуре; locator хранит section path и offsets в каноническом extracted text плюс exact_quote/hash. Для исходного Markdown сохраняются bytes и соответствие offsets. Размеры определяются в Unicode code points с явной convention, не «символами» неопределённой кодировки.

Для повторяемости extraction chunk_id стабилен для source_revision. Candidate key включает session_uid, chunk_uid и client_ref. Пересекающиеся chunks дедуплицируются по source_binding и явному resolution, а не только title.

### 8.3. Последовательность

1. source upload → hash verification → record accepted instruction.
2. create ImportSession → получить schema/rules/chunks/existing alias mappings.
3. По частям: extract entities/relations/issues → stage candidates.
4. Установить disposition фрагментов: extracted, supporting_context, open_issue, excluded_with_reason.
5. Validate IDs/schemas/links/coverage → вернуть findings и temporary→canonical reservations.
6. Resolve blocking ambiguities; scope accepted source и inferred additions отображаются отдельно.
7. Preview source map, registry delta и impact.
8. Apply accepted extraction ChangeSet согласно import capability.
9. Создать initial baseline если actor имеет отдельное право; иначе показать возможность.
10. Выдать отчёт: counts, mappings, unresolved items, invented candidates, source gaps.

Система допускает частично импортированный большой документ, но не маркирует весь источник как fully imported, пока manifest не закрыт. Применение небольших batches явно отражается в отчёте; исходная baseline первого импорта создаётся после завершения согласованного объёма.

### 8.4. Повторный импорт и расхождение

Match precedence: explicit canonical ID → existing namespaced alias → explicit user mapping → candidate fuzzy matches. Удаление пункта из документа не означает автоматическое архивирование: сначала проверяется scope импорта и полнота нового документа.

Если документ экспортирован раньше текущего graph_revision, сервер показывает three-way comparison: export baseline, current registry, imported revision. Молчаливый last-write-wins запрещён.

Метрика «доля обработанных фрагментов» измеряет техническое покрытие источника, не семантическую полноту требований. Параграф может получить disposition и всё ещё содержать пропущенное обязательство; это проверяется дополнительным semantic review.
