# Трассировка до Git-коммитов

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 13. Трассировка до Git-коммитов

### 13.1. Обязательная цепочка

Целевая трасса: BR/US → FR/NFR → ADR/CMP/INT → TASK/PLAN → CODE/COMMIT → TEST/Evidence. Не каждый проект требует каждое звено; required obligations определяет policy.

Минимум для commit link: repository_uid, full_oid, requirement/task IDs и pinned revision, link_role, basis, issuer. Commit без pinned requirement revision считается неполной трассировкой.

Link roles: implements, refactors, fixes, tests, documents, reverts. Любое упоминание requirement ID не превращается в implements.

### 13.2. Способы подключения P0

1. Provider-neutral read-only Git adapter к настроенному remote.
2. CLI/CI передаёт SHA и signed/authenticated manifest; сервер проверяет объект при доступном adapter.
3. Без доступа к remote manifest получает pending verification. В UI это явно видно; readiness не считает его verified.

Полный Git hosting продукт не создаётся. Provider-specific PR UI/webhooks — P1; базовый sync и manifest API обязательны в P0. Доступ к remote ограничен заранее настроенным repository; arbitrary URL из запроса не скачивается.

### 13.3. Manifest

~~~json
{
  "repository_id": "repo-example",
  "object_format": "sha1",
  "commit_oid": "0123456789abcdef0123456789abcdef01234567",
  "change_set_id": "changeset-example",
  "context_bundle_id": "bundle-example",
  "links": [
    {
      "artifact_id": "DEMO-FR-000042",
      "artifact_revision_number": 3,
      "role": "implements",
      "code_refs": [
        {"path": "src/documents/access.py", "symbol": "get_document"}
      ]
    }
  ],
  "ci_run_ref": "provider-run-example"
}
~~~

SHA в примере фиктивный и не считается существующим. В реальном запросе Git-коннектор проверяет commit, tree, path и symbol/range. Symbol в P0 может быть advisory, если parser языка отсутствует; точная проверка path/blob обязательна. Line ranges относятся только к закреплённому commit.

### 13.4. Git trailers

Вариант сообщений коммита:

~~~text
Restrict document reads to the current tenant

Project-Artifact: DEMO-FR-000042@3
Project-Task: DEMO-TASK-000017
Project-Change: change-set-uuid
Project-Context: context-bundle-uuid
~~~

Парсер использует структурированные trailers. Они удобны для начального сопоставления, но являются claims автора. Сервер проверяет repo, IDs, revisions и присваивает trust/provenance; не извлекает доказательство корректности из commit message.

### 13.5. Изменения истории и актуальность

- Squash: итоговый SHA новый; links создаются заново с mapping source commits. Сопоставление по PR/manifest можно подтвердить; patch similarity только candidate.
- Rebase/cherry-pick: новый commit сохраняет explicit rewritten_from/cherry_picked_from; старый не заменяется.
- Revert: reverse change связывается с original commit; статус requirement implementation требует пересмотра.
- Rename/move: новая code ref на новом commit, old ref сохраняется.
- Deleted file: old anchor остаётся доступен на old commit; current code coverage получает gap.
- Force-push: ref observation меняется; baseline остаётся pinned. Artifact указывает, что коммит не reachable из текущего target.
- Несколько repo: baseline хранит exact oid каждого обязательного репозитория.

Сервис получает достижимость коммита из графа Git, не из времени коммита. Reachable original commit после revert не доказывает наличие его поведения: readiness учитывает linked reversal/change findings и актуальное Evidence.

### 13.6. Рабочий цикл разработки через Claude

1. Получить TASK + bundle и зафиксировать starting code heads.
2. Прочитать linked code; выполнить локальные изменения.
3. Подготовить tests/result manifest и зарегистрировать semantic/doc changes.
4. Перед commit повторно проверить bundle freshness. Если требования изменились, пересмотреть работу.
5. Создать commit только в рамках полученного разрешения на Git-работу; иначе показать diff и оставить prepared manifest.
6. После фактического commit зарегистрировать SHA, code refs и links через API.
7. CI/коннектор проверяет commit и results; unresolved discrepancies попадают в inbox.
8. При merge/squash повторно зарегистрировать фактический target commit и applicable results.

Если код принят, а регистрация сервиса временно недоступна, локальный manifest сохраняется в репозитории/CI artifact и повторяется с тем же idempotency key. Сервис показывает backlog; нельзя утверждать, что trace завершена.
