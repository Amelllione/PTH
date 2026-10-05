# Порядок разработки и метрики

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 18. Порядок разработки и блокирующие зависимости

### 18.1. Этапы

| Этап | Содержание | Зависимости | Результат выхода |
| --- | --- | --- | --- |
| E0: model/contracts spike | Схемы Artifact/Relation, IDs, lifecycle, ChangeSet contract; sample source и Git repo | Принятие ключевых решений раздела 20 | Через API воспроизводится небольшой демонстрационный граф |
| E1: canonical API | Projects/auth, immutable revisions, aliases, relations, ChangeSet transaction, audit/idempotency | E0 | Автоматические API сценарии identity/concurrency/atomicity |
| E2: import + AI entry | Sources/fragments/import sessions, context basics, MCP, SK-01/02, source UI | E1 | Принятый текст раскладывается без дублей и потери происхождения |
| E3: changes + analysis UI | Impact rules, freshness/review, ChangeSet UI, graph/matrix, SK-03/04/05 | E1; E2 для realistic sources | Правка NFR показывает последствия и нужные review |
| E4: code trace | Repo adapter, commit/code refs, CI manifest, reachability/rewrite handling, SK-07/08/09 | E1, E2; E3 для обратного влияния | Путь US→commit и commit→requirement с pinned versions |
| E5: verification/baselines | TEST/Evidence, obligations, PSI, readiness, baseline/export, SK-10/11/13 | E3, E4 | ПСИ и готовность релиза основаны на актуальных свидетельствах |
| E6: hardening | Restore, performance/isolation/eval tests, deployment/SDK docs, job monitoring | E1–E5 | Первый пригодный сквозной релиз P0 |
| E7: расширения | DOCX/PDF, схемы/шаблоны API, vector search, provider PR connectors, LLM worker | P0 | P1 без изменения canonical identity |

UI присутствует с E2 и развивается вместе с API. Скиллы создаются вместе со своими server operations; не откладываются «после всего backend».

### 18.2. Что блокирует ключевые функции

| Функция | Обязательные prerequisites |
| --- | --- |
| Import accepted spec | Source identity, schema, temp refs, idempotency, aliases, ChangeSet |
| Impact highlighting | Typed relations, revisions, field diff, applicability, bounded traversal |
| Работа Claude с текущими знаниями | Context manifest, source refs, freshness, capabilities, MCP |
| Canonical apply | Transaction, expected revisions, policy, validation, audit/outbox |
| Trace до commit | Repo identity, full OID verification, code refs, pinned requirement versions |
| Verification/readiness | Obligations, TEST revisions, evidence identity, baseline target code |
| ПСИ | Проверяемые criteria/НФТ и coverage gaps; LLM не исправляет отсутствие данных автоматически |
| Исторический replay | Immutable sources/revisions/manifests и backup объектов |

Не следует начинать с графического графа, embeddings или автоматической генерации ADR до принятия семантики сущностей и связей. Они опираются на canonical model.

### 18.3. Минимальный пилот

Один пример проекта с 2 BR, 3 US, 6 FR, 2 NFR, 2 CON, 3 ADR, 3 CMP, 5 TASK, 8 TEST и настоящим demo Git repo.

Пилот включает импорт → UI review → изменение NFR → impact/review → Claude context → code commit → CI evidence → baseline → PSI export. Первый удобный прототип E2/E3 не называется завершённым P0 до Git/verification частей.

### 18.4. Definition of Done для фичи сервиса

Связаны PTH-US/PTH-FR; реализован API контракт и authorization; есть UI/skill path где применимо; change/history/provenance сохранены; meaningful negative/acceptance tests выполнены; документация обновлена; implementation commits связаны с IDs этой спеки.

Сервис должен демонстрировать собственную трассировку на своём проекте после достижения E4. До E4 применяется временный manifest в репозитории, затем импортируется без потери исходных SHA.

## 19. Метрики продукта и качества

### 19.1. Продуктовые

- Время от принятого текста до первого проверенного реестра.
- Доля импортов, завершённых без ручного исправления ID/связей.
- Время выявления и закрытия последствий изменения.
- Доля задач ИИ с записанным актуальным ContextBundle.
- Доля implementation commits с проверенной трассировкой и pinned requirement revision.
- Время подготовки проекта ПСИ и число оставшихся неизвестных условий.
- Число обнаруженных расхождений до merge/приёмки.

### 19.2. Качество реестра

- Source disposition coverage и отдельно human-reviewed extraction recall на sample.
- Доля confirmed связей с проверяемым основанием.
- Coverage ratios по obligation type; denominator и unknown applicability видны.
- Needs_review/stale age и время их разрешения.
- Precision impact: доля действительно требовавших действий объектов среди отмеченных. Recall оценивается на размеченных сценариях, а не из production counts.
- Доля false semantic findings и accepted/rejected proposed links.
- Orphan/unreachable code references, incomplete manifests, revision mismatch.
- Evidence freshness и доля agent_claimed против trusted_ci.

### 19.3. Эксплуатационные

Latency/error rate, conflicts, job duration/retries, queue/outbox backlog, failed Git sync, restore success, storage growth, bytes/tokens per bundle и LLM cost metadata при наличии.

Нельзя оптимизировать «количество созданных требований», «количество связей» или общий coverage % без качества и scope: ИИ может искусственно увеличить их, не улучшая проверяемость.
