# Модель данных и правила связей

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 5. Модель данных и неизменяемая идентичность

### 5.1. Идентификаторы

- entity_uid: непрозрачный UUID, глобально уникальный.
- display_id: например DEMO-FR-000042; уникален в системе благодаря неизменяемому project_key.
- revision_uid: отдельный UUID конкретной редакции; revision_number монотонен в пределах сущности.
- relation_uid и relation_revision_uid: аналогичная модель для связи.
- revision не включается в постоянный display_id; deep link может явно фиксировать revision.
- seq выдаётся транзакционно; пропуски допустимы. Зарезервированный или удалённый ID не используется повторно.
- project_key нельзя менять после создания. display_name проекта и title сущности менять можно.
- Тип сущности после создания неизменяем. Исправление типа: новая сущность + replaces + mapping, чтобы префикс и история не расходились.
- Один Artifact может находиться в нескольких документах/представлениях; location не участвует в identity.
- Дубликаты display_id и alias namespace сервер отклоняет; одинаковые title допустимы.

При импорте временные client_ref, например tmp:fr:section-4.2:01, действуют только внутри ImportSession/ChangeSet. Apply возвращает client_ref→entity_uid/display_id. Temp ref не является каноническим ID.

### 5.2. Базовые типы артефактов P0

| Код | Содержание и обязательные специализированные поля |
| --- | --- |
| BR | Бизнес-потребность: statement, expected_outcome, source |
| US | role, need, benefit, acceptance_criteria, scope |
| FR | statement, behavior, preconditions, acceptance_criteria, scope |
| NFR | statement, quality_attribute, metric, threshold, measurement_conditions |
| CON | Ограничение: statement, applicability, enforcement_method |
| ADR | context, decision, alternatives, consequences, decision_status |
| CMP | Компонент: responsibilities, boundaries, interfaces |
| INT | Интеграция: parties, protocol, contract, failure_behavior |
| TERM | Термин: definition, synonyms, bounded_context |
| PLAN | План реализации: steps, target_refs, readiness_conditions |
| TASK | Задача: objective, target_requirements, done_criteria |
| TEST | Проверка: method, preconditions, inputs, steps, expected, automation |
| PSI | Программа испытаний: scope, baseline, ordered test refs, execution_rules |
| RISK | Риск: description, likelihood, consequence, mitigation, owner |
| ISSUE | Неоднозначность/вопрос: source, question, resolution |
| RELEASE | Релиз: baseline, target repos/commits, readiness_policy |
| CODE | Ссылка на код: code_reference_uid; содержимое кода не редактируется как требование |
| COMMIT | Проекция проверенного Commit; служебный тип, управляется Git-командами |

Не каждое поле известно при импорте. Объект с отсутствующим обязательным смысловым полем может быть draft с Finding. Переход к agreed требует выполнения правил полноты либо явного исключения. Принятая пользователем спека может содержать незавершённый НФТ: факт принятия источника сохраняется, измеримость требования не выдумывается.

### 5.3. Основные записи хранения

| Запись | Основные поля и ограничения |
| --- | --- |
| Project | uid, key, name, current_graph_revision, policy_revision, archived_at |
| Principal / Membership | user/service, project, capabilities, actor attribution |
| Artifact | uid, project_uid, display_id, type, current_revision_uid, tombstone |
| ArtifactRevision | uid, artifact_uid, number, schema_version, title, statement, attributes, lifecycle, provenance, hash, changeset_uid |
| ExternalAlias | project_uid, source_namespace, external_id, artifact_uid; unique namespace+external_id |
| Relation | uid, project_uid, current_revision_uid |
| RelationRevision | from_uid, to_uid, type, status, scope, basis, confirmed_against, lifecycle |
| SourceDocumentRevision | bytes/text hash, MIME, title, immutable URI, accepted_by/at, acceptance_basis |
| SourceFragment | source_revision_uid, locator, exact_quote, quote_hash, disposition |
| SourceBinding | fragment_uid, artifact_revision_uid, extraction_kind, provenance |
| ImportSession | source_revision_uid, chunk manifest, extracted candidates, issues, changeset_uid, status |
| ChangeSet | base_graph_revision, operations, operation hashes, draft_revision, validation_revision, impact_uid, policy decisions |
| ImpactAnalysis / ImpactItem | base/proposed revision, rule_set_version, paths, reasons, certainty, completeness |
| ReviewResolution | relation/finding uid, against revisions, action, reason, evidence, actor |
| Baseline | project, immutable manifest, manifest_hash, pinned policies, Git heads, created_by |
| ContextBundle | baseline/graph revision, purpose, manifest, omissions, budget, hash, freshness |
| AgentRun | principal, skill/version, model metadata, bundle, sources, operations, commits |
| Repository / RefObservation | provider identity, URL, object_format, ref, observed_oid/time |
| Commit | repository_uid, full_oid, tree_oid, parent_oids, verified_state, observed_at |
| CodeReference | repository_uid, commit_oid, path, blob_oid, optional symbol/range |
| TestRun / Evidence | test revision, baseline, tested repo_oids, env hash, result, artifact hashes, issuer |
| Finding / Waiver | rule, severity, subject revisions, evidence, resolution, expiry/applicability |
| AuditEvent / OutboxEvent | immutable operation log и события, записанные в транзакции |
| Job | operation, input_hash, attempt, state, progress, checkpoint, result/error |

Текущие указатели Artifact/Relation изменяемы транзакционно; содержимое Revision неизменяемо. Состояния jobs и delivery — операционные, не являются редактированием прошлого проектного знания.

### 5.4. Независимые состояния

**Artifact lifecycle:** draft → proposed → agreed → deprecated → archived. allowed transitions заданы типом. Архивирование не стирает данные; восстановление создаёт новую revision.

**ADR decision_status:** proposed, accepted, rejected, superseded. Связь supersedes обязательна для замещённого решения; old ADR сохраняется.

**Relation status:** proposed, confirmed, rejected; freshness отдельно: current, needs_review, orphaned. Не следует кодировать все сочетания в один enum.

**Реализация и проверка:** specified, designed, implementation_claimed, implementation_observed, verified, accepted — вычисляемые аспекты, а не линейный статус Artifact. Требование может иметь проектирование, но не иметь актуальной проверки; accepted на старой baseline не переносится на новую.

**Finding:** open, acknowledged, resolved, dismissed. Dismissal требует причины и прав; при изменении проверяемого основания finding может открыться заново.

**Evidence:** immutable result: pass, fail, blocked, inconclusive; актуальность и доверие — отдельные вычисляемые атрибуты. ИИ-резюме не заменяет raw result.

### 5.5. Пример редакции ФТ

~~~json
{
  "display_id": "DEMO-FR-000042",
  "revision_number": 3,
  "type": "FR",
  "lifecycle": "agreed",
  "title": "Изоляция документов организаций",
  "statement": "Пользователь получает документы только своей организации.",
  "attributes": {
    "scope": {"component_ids": ["DEMO-CMP-000003"]},
    "acceptance_criteria": [
      {
        "key": "cross-tenant-read",
        "given": "Документ принадлежит другой организации",
        "when": "Пользователь запрашивает документ",
        "then": "Доступ запрещён, содержимое документа не раскрывается"
      }
    ]
  },
  "provenance": {
    "kind": "source_extraction",
    "source_fragment_refs": ["fragment-example"],
    "agent_run_ref": "run-example"
  }
}
~~~

uid в примере опущены для читаемости; реальные API возвращают UUID. Acceptance criterion key постоянен в пределах требования; изменение формулировки имеет revision, удаление критерия отражается в истории и покрытии.

## 6. Семантика связей и правила влияния

### 6.1. Каталог связей

Направление в таблице каноническое. Обратный label вычисляется для отображения, вторая зеркальная запись не создаётся.

| Тип | Направление | Смысл | Изменение какого конца требует пересмотра |
| --- | --- | --- | --- |
| refines | Детальное требование/US → исходное BR/US/требование | Декомпозиция/уточнение | Изменение исходного → детальные; изменение детального → кандидат проверки покрытия исходного |
| satisfies | Детальное требование/решение → требование | Заявленное покрытие | Изменение требования → покрывающее; изменение покрывающего → повторная оценка покрытия |
| motivates | Требование/риск → ADR | Основание решения | Изменение основания → ADR |
| constrains | НФТ/CON → CMP/INT/ADR/TASK | Ограничивает допустимые решения | Изменение ограничения → ограничиваемые |
| implements | CMP/CODE/COMMIT → FR/NFR/US/TASK | Область реализации | Изменение требования → реализация требует review; изменение кода → проверки требования |
| realizes | CODE → CMP/INT | Реализация компонента | Изменение кода → возможное изменение описания компонента |
| verifies | TEST → требование/критерий | Способ проверки | Изменение требования/критерия → TEST; изменение TEST → оценка покрытия |
| depends_on | Любой допустимый Artifact → зависимость | Семантическая зависимость | Изменение зависимости → зависимые |
| supersedes | Новый объект → старый | Замещение | Не распространяет функциональное влияние без дополнительной смысловой связи |
| derived_from | Производный объект → источник/основание | Происхождение | Изменение основания → кандидат review производного |
| includes | PSI/PLAN/RELEASE → включённый объект | Состав | Изменение включённого → обновление представления/проверка состава |
| addresses | TASK/PLAN → требование/ISSUE/RISK | Область работы | Изменение адресуемого → план/задача |
| conflicts_with | Artifact → Artifact | Зафиксированное противоречие | Обе стороны; отображается симметрично, хранится с нормализованным порядком uid |
| related_to | Artifact → Artifact | Навигационная связь | По умолчанию влияние не распространяет |

Links Evidence→TEST/revisions, AgentRun→ContextBundle и Commit→CodeReference реализуются строгими отдельными FK/manifest-полями, а не произвольными семантическими связями. В графе они отображаются как технические рёбра.

### 6.2. Валидация графа

- dangling links, чужой проект, недоступный объект и self-link отклоняются.
- Для refines и supersedes запрещены циклы. Для depends_on цикл — finding, если policy не запрещает его; произвольный граф не обязан быть DAG.
- По паре endpoints/type/scope запрещены дубли активной confirmed-связи.
- Proposed-связь может сосуществовать с альтернативной proposed; подтверждение требует разрешения коллизии.
- У refines/satisfies могут быть несколько родителей. Один НФТ может ограничивать множество компонентов.
- Relation basis содержит явную ссылку/цитату либо объяснение человека. ИИ confidence не является основанием сам по себе.
- Coverage учитывает direction, scope, accepted endpoint revisions и freshness.

### 6.3. Applicability ограничений

Ограничение имеет applicability: project-wide, component set, bounded_context, artifact types, environment, release scope. Scope задан структурированно; v1 поддерживает AND/OR по разрешённым атрибутам без исполнения пользовательского кода.

Для нового компонента контекст включает project-wide ограничения и ограничения подходящего bounded_context даже при отсутствии constrains. Система предлагает недостающие явные связи. Удаление constrains не отменяет применимость project-wide ограничения.

### 6.4. Алгоритм ImpactAnalysis

1. Зафиксировать base snapshot, proposed ChangeSet и rule_set_version.
2. Вычислить field-level diff и классифицировать изменения: text/editorial, behavior, metric/threshold, scope, lifecycle, relation, code.
3. Собрать direct impacts по правилам. Редакторский diff снижает severity только при детерминированно безопасных изменениях; смысловая классификация ИИ — рекомендация.
4. Обойти разрешённые правилами направления до budget. visited key включает node, rule и direction; графовые циклы не зацикливают расчёт.
5. Добавить применимые ограничения и obligations; не ограничиваться соседями изменённого узла.
6. Сформировать ImpactItem для каждой затронутой revision со всеми существенными путями, certainty и action.
7. Рассчитать coverage delta, новые gaps и возможные conflicts.
8. Вернуть complete/truncated/pending и точные лимиты. Частичный анализ не отображается как полный.
9. При apply записать invalidation markers/события в той же транзакции, что новые revisions. Полный обход может выполняться worker.
10. До завершения worker все потенциально затронутые derived confirmations имеют conservative pending status. Зелёный readiness не возвращается на непроанализированном новом graph_revision.

Выделяются certainty: explicit (явная структурная связь), inferred (предложение ИИ), unknown. Direct/transitive — отдельный атрибут, не степень уверенности.

Пример: изменение порога NFR → constrains CMP → realizes CODE → связанные commits/test obligations. Коммит прошлого кода immutable; меняется актуальность заявления, что этот код выполняет текущую редакцию НФТ.

### 6.5. Перепроверка и распространение

ReviewResolution хранит against_artifact_revisions и against_relation_revision. Снятие needs_review на одной связи не очищает весь граф. По ветви можно остановить дальнейший review только явным обоснованием «изменение не влияет» с фиксированными редакциями.

Большой проект требует server pagination и группировки по компоненту/роли. Уведомление по каждой транзитивной связи отдельно не обязательно; inbox агрегирует одну причину изменения с её объектами.
