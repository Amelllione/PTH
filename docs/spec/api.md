# API-сервер

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 9. API-сервер

### 9.1. Общий контракт

REST base: /api/v1. UTF-8 JSON; OpenAPI и JSON Schema входят в поставку. MCP — второй transport того же доменного контракта.

- Auth: user session для UI; scoped bearer token для сервисов. Tokens не передаются в URL.
- Все mutation commands: Idempotency-Key; actor определяется auth, а не произвольным полем тела.
- Редактирование drafts: If-Match draft ETag; apply: expected project/subject revisions.
- POST job/analysis/context creation: 201 для малого синхронного результата или 202 с job_uid/location.
- Чтение: cursor pagination, limit ≤200; graph endpoints имеют отдельные nodes/edges/path budgets.
- Read snapshot задаётся baseline_uid или graph_revision. Нельзя смешивать разные revisions без явного comparison mode.
- Query graph_revision обеспечивается snapshot manifest/consistent DB read; current не меняется посреди ответа.
- Response: data, meta {request_id, graph_revision, schema_version, completeness, next_cursor}; ошибки — problem details.
- UI, CLI, MCP не обращаются к БД напрямую. Worker использует application services с system principal; изменения имеют audit.
- Изменения проекта/ключей/интеграций тоже доступны через API, но имеют отдельные management commands.

### 9.2. Endpoint catalogue

В таблице read endpoints не изменяют проектное знание. POST convenience write endpoints создают ChangeSet и выполняют тот же workflow. Режим draft/apply задан явно; сервер не угадывает его.

| Группа | Чтение | Создание / изменение |
| --- | --- | --- |
| Projects | GET /projects; GET /projects/{p} | POST /projects; PATCH /projects/{p}; POST /projects/{p}/archive |
| Access | GET /projects/{p}/memberships; GET /tokens | POST/PATCH/DELETE memberships; POST /tokens; POST /tokens/{id}/revoke |
| Schemas | GET /projects/{p}/schemas; GET /relation-types | P1: POST /schemas/change-proposals; POST /schema-migrations |
| Artifacts | GET /projects/{p}/artifacts; GET /artifacts/{id}; GET /artifacts/{id}/revisions/{r} | POST /projects/{p}/artifacts; POST /artifacts/{id}/revisions; POST /artifacts/{id}/transitions |
| Aliases | GET /artifacts/{id}/aliases | POST alias commands; POST /aliases/{id}/retire |
| Relations | GET /artifacts/{id}/relations; GET /relations/{id}/revisions | POST /projects/{p}/relations; POST /relations/{id}/revisions; POST /relations/{id}/archive |
| Graph | GET /projects/{p}/graph; GET /projects/{p}/paths | POST /projects/{p}/graph/queries для больших structured queries |
| Search | GET /projects/{p}/search | POST /projects/{p}/search/query |
| Sources | GET /sources/{id}; GET /sources/{id}/fragments | POST /projects/{p}/sources; POST /sources/{id}/acceptance-records |
| Import | GET /imports/{id}; GET /imports/{id}/report | POST /projects/{p}/imports; POST /imports/{id}/candidates; POST /imports/{id}/dispositions; POST /imports/{id}/resume/cancel |
| ChangeSet | GET /changesets/{id}; GET /changesets/{id}/diff | POST /projects/{p}/changesets; PATCH /changesets/{id}; POST /changesets/{id}/validate/analyze/apply/rebase/cancel/compensate |
| Impact | GET /impact-analyses/{id}; GET /impact-analyses/{id}/items | POST /projects/{p}/impact-analyses для what-if; POST review resolutions |
| Findings | GET /projects/{p}/findings; GET /projects/{p}/reviews | POST /findings/{id}/resolutions; POST /projects/{p}/waivers; POST /waivers/{id}/revoke |
| Context | GET /context-bundles/{id}; GET /context-bundles/{id}/manifest | POST /projects/{p}/context-bundles; POST /context-bundles/{id}/check-freshness |
| Agent runs | GET /agent-runs/{id} | POST /projects/{p}/agent-runs; POST /agent-runs/{id}/events; POST /agent-runs/{id}/finish |
| Git | GET /repositories/{id}/commits; GET /commits/{id}; GET /artifacts/{id}/trace/code | POST /projects/{p}/repositories; PATCH repository config; POST /repositories/{id}/sync; POST /repositories/{id}/commits/register; POST commit/code links |
| Git impact | GET /git-analyses/{id} | POST /repositories/{id}/diff-analyses; POST /repositories/{id}/rewrite-mappings |
| CI | GET /test-runs/{id}; GET /evidence/{id} | POST /projects/{p}/ci-manifests; POST /test-runs; POST /test-runs/{id}/results |
| Checks | GET /validation-runs/{id}; GET /projects/{p}/coverage | POST /projects/{p}/validation-runs; POST semantic findings через ChangeSet |
| PSI/reports | GET /reports/{id}; GET /projects/{p}/readiness | POST /projects/{p}/psi-drafts; POST /projects/{p}/exports |
| Baselines | GET /projects/{p}/baselines; GET /baselines/{id}/manifest; GET /baselines/compare | POST /projects/{p}/baselines; POST /releases/{id}/acceptance |
| Jobs/events | GET /jobs/{id}; GET /projects/{p}/events; GET /audit | POST /jobs/{id}/cancel/retry; POST/PATCH subscriptions |
| Lifecycle | GET /projects/{p}/retention-policy | POST /projects/{p}/export-package; POST archive/purge requests по admin policy |

Формы /.../validate/analyze в таблице обозначают отдельные endpoint paths, например /changesets/{id}/validate и /changesets/{id}/analyze, а не literal path со slash alternatives.

Обязательный артефакт реализации: машинный OpenAPI с полными request/response schemas для каждой P0 операции. Таблица спецификации задаёт группы; реализация уточняет единообразные paths без изменения семантики.

### 9.3. Пример ChangeSet request

~~~json
{
  "title": "Уточнить порог производительности",
  "reason": "Изменён целевой пользовательский сценарий",
  "base_graph_revision": 125,
  "context_bundle_uid": "bundle-example",
  "operations": [
    {
      "op": "revise_artifact",
      "artifact_id": "DEMO-NFR-000008",
      "expected_revision_number": 2,
      "patch": {
        "attributes.threshold": {"operator": "<=", "value": 2, "unit": "s"}
      }
    },
    {
      "op": "create_artifact",
      "client_ref": "tmp:issue:load",
      "type": "ISSUE",
      "lifecycle": "draft",
      "statement": "Уточнить профиль нагрузки для измерения порога"
    }
  ],
  "execution_mode": "draft"
}
~~~

Patch paths проверяются по schema; arbitrary JSON path исполнение запрещено. Пример использует symbolic refs для читаемости. На сервере persistent uid имеют UUID, display_id может служить resolve input.

### 9.4. Пример ImpactItem

~~~json
{
  "subject_id": "DEMO-ADR-000012",
  "against_revision_number": 1,
  "level": "direct",
  "certainty": "explicit",
  "rule_id": "impact.constrains.metric-change.v1",
  "path": ["DEMO-NFR-000008", "DEMO-ADR-000012"],
  "reason": "ADR обоснован прежним порогом времени ответа",
  "suggested_action": "review_decision",
  "status": "needs_review",
  "analysis_completeness": "complete"
}
~~~

### 9.5. Ошибки

| HTTP / code | Значение и действие клиента |
| --- | --- |
| 400 INVALID_COMMAND | Некорректная форма запроса |
| 401 AUTH_REQUIRED | Обновить auth; не повторять mutation без idempotency |
| 403 CAPABILITY_DENIED | Прав нет; скилл не обходит запрет |
| 404 NOT_FOUND | Объект отсутствует или недоступен; не раскрывать чужой проект |
| 409 REVISION_CONFLICT | Получить текущие revisions, rebase и повторно проанализировать |
| 409 IDENTITY_COLLISION | Разрешить mapping; не придумать новый alias молча |
| 409 IDEMPOTENCY_CONFLICT | Тот же key с иным payload |
| 409 ANALYSIS_OUTDATED | Обновить validation/impact для нового draft |
| 422 DOMAIN_VALIDATION | Показать field/operation findings |
| 422 MANDATORY_CONTEXT_INCOMPLETE | Расширить budget или разбить задачу |
| 423 REVIEW_REQUIRED | Политика требует решения уполномоченного principal |
| 429 RATE_LIMITED | Retry-After, bounded retry |
| 503 INTEGRATION_UNAVAILABLE | Job retry; не объявлять SHA verified |

Ответ ошибки содержит request_id, error code, message, subject refs и safe details; не включает token или полный confidential prompt.

### 9.6. Jobs и события

Job имеет input_hash/checkpoint. Retry допускается только для resumable job или создаёт новую попытку того же idempotent operation. Частично записанные extraction candidates сохраняются; apply не может быть «частично успешным».

Outbox delivery at-least-once; consumer дедуплицирует event_uid. Event payload содержит project, graph_revision, changed IDs, ChangeSet и job, не весь документ. Клиент запрашивает данные после уведомления.
