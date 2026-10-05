"""Сквозные проверки API: инварианты ревизий, связи, потерянные элементы, граф."""
import pytest
from fastapi.testclient import TestClient

from pth.api import create_app

SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"


@pytest.fixture()
def app(tmp_path):
    return create_app(f"sqlite:///{tmp_path / 'test.db'}")


def issue(app, **kwargs) -> str:
    from pth.auth import issue_key
    with app.state.session_factory() as s:
        token = issue_key(s, **kwargs)
        s.commit()
    return token


@pytest.fixture()
def client(app):
    admin = issue(app, name="test-admin", kind="admin")
    with TestClient(app, headers={"Authorization": f"Bearer {admin}"}) as c:
        assert c.post("/v1/projects", json={"key": "PTH", "name": "Traceability"}).status_code == 201
        yield c


def make(client, type_, title, **extra):
    body = {"type": type_, "title": title, **extra}
    r = client.post("/v1/projects/PTH/artifacts", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def rel(client, type_, source, target):
    return client.post("/v1/projects/PTH/relations", json={"type": type_, "source": source, "target": target})


def test_project_duplicate_and_validation(client):
    assert client.post("/v1/projects", json={"key": "PTH", "name": "x"}).json()["error"]["code"] == "PROJECT_EXISTS"
    assert client.post("/v1/projects", json={"key": "bad key", "name": "x"}).status_code == 422
    assert client.get("/v1/projects/NOPE").json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_display_ids_are_sequential_per_type(client):
    assert make(client, "FR", "a")["display_id"] == "PTH-FR-001"
    assert make(client, "FR", "b")["display_id"] == "PTH-FR-002"
    assert make(client, "US", "c")["display_id"] == "PTH-US-001"


def test_revisions_are_append_only_and_checked(client):
    make(client, "FR", "old title", text="v1")
    r = client.post("/v1/projects/PTH/artifacts/PTH-FR-001/revisions",
                    json={"title": "new title", "text": "v2", "expected_revision": 1})
    assert r.status_code == 201 and r.json()["revision"] == 2
    stale = client.post("/v1/projects/PTH/artifacts/PTH-FR-001/revisions",
                        json={"title": "stale", "expected_revision": 1})
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "REVISION_CONFLICT"
    history = client.get("/v1/projects/PTH/artifacts/PTH-FR-001/revisions").json()
    assert [h["title"] for h in history] == ["old title", "new title"]


def test_relation_catalog_rules(client):
    make(client, "US", "user story")
    make(client, "FR", "requirement")
    assert rel(client, "refines", "PTH-FR-001", "PTH-US-001").status_code == 201
    assert rel(client, "refines", "PTH-US-001", "PTH-FR-001").status_code == 201  # US уточняет ФТ по каталогу
    wrong = rel(client, "implements", "PTH-FR-001", "PTH-US-001")
    assert wrong.status_code == 422 and wrong.json()["error"]["code"] == "INVALID_RELATION"
    assert rel(client, "refines", "PTH-FR-001", "PTH-US-001").json()["error"]["code"] == "DUPLICATE_RELATION"
    assert rel(client, "refines", "PTH-FR-001", "PTH-FR-001").status_code == 422


def test_commit_implements_requirement(client):
    make(client, "FR", "req")
    r = client.post("/v1/projects/PTH/commits", json={"sha": SHA, "title": "feat: req", "implements": ["PTH-FR-001"]})
    assert r.status_code == 201
    assert client.post("/v1/projects/PTH/commits", json={"sha": SHA, "title": "dup"}).json()["error"]["code"] == "COMMIT_EXISTS"


def test_lost_requirements_and_user_stories(client):
    make(client, "US", "US without ref", attributes={"priority": "P0"})
    make(client, "US", "US with FR")
    make(client, "FR", "FR without code", attributes={"priority": "P1"})
    make(client, "FR", "FR with code")
    make(client, "FR", "FR exempt", exemption_reason="вне scope первого релиза")
    make(client, "ADR", "ADR for US2")
    rel(client, "refines", "PTH-FR-002", "PTH-US-002")
    client.post("/v1/projects/PTH/commits", json={"sha": SHA, "title": "c", "implements": ["PTH-FR-002"]})

    lost = client.get("/v1/projects/PTH/lost").json()
    ids = {i["display_id"]: i for i in lost["items"]}
    assert set(ids) == {"PTH-US-001", "PTH-FR-001"}          # FR-002 и FR-003 не потеряны
    assert ids["PTH-US-001"]["reasons"] == ["no_reflection"]
    assert ids["PTH-FR-001"]["reasons"] == ["no_code_link"]
    assert ids["PTH-FR-001"]["priority"] == "P1"

    # US-002 отражена ФТ, поэтому в списке её нет
    assert "PTH-US-002" not in ids


@pytest.mark.covers("lost.type")
def test_user_story_reflected_by_adr_is_not_lost(client):
    make(client, "US", "US")
    make(client, "ADR", "ADR")
    assert rel(client, "motivates", "PTH-US-001", "PTH-ADR-001").status_code == 201
    assert client.get("/v1/projects/PTH/lost?type=US").json()["total"] == 0


def test_lost_becomes_resolved_after_commit(client):
    make(client, "FR", "req")
    assert client.get("/v1/projects/PTH/lost").json()["total"] == 1
    client.post("/v1/projects/PTH/commits", json={"sha": SHA, "title": "c", "implements": ["PTH-FR-001"]})
    assert client.get("/v1/projects/PTH/lost").json()["total"] == 0


def test_graph_neighbourhood_and_truncation(client):
    make(client, "US", "root")
    for i in range(4):
        make(client, "FR", f"fr {i}")
        rel(client, "refines", f"PTH-FR-{i+1:03d}", "PTH-US-001")
    g = client.get("/v1/projects/PTH/graph", params={"focus": "PTH-US-001", "depth": 1}).json()
    assert len(g["nodes"]) == 5 and len(g["edges"]) == 4 and g["truncated"] is False
    assert any(n["display_id"] == "PTH-FR-001" and n["lost"] for n in g["nodes"])

    small = client.get("/v1/projects/PTH/graph", params={"focus": "PTH-US-001", "limit": 3}).json()
    assert len(small["nodes"]) == 3 and small["truncated"] is True


@pytest.mark.covers("lost.priority")
def test_lost_filters_by_priority_and_reports_exclusions(client):
    make(client, "FR", "P0 without code", attributes={"priority": "P0"})
    make(client, "FR", "P1 without code", attributes={"priority": "P1"})
    make(client, "FR", "exempt", attributes={"priority": "P0"}, exemption_reason="вне первого релиза")
    p0 = client.get("/v1/projects/PTH/lost?priority=P0").json()
    assert [i["display_id"] for i in p0["items"]] == ["PTH-FR-001"]
    full = client.get("/v1/projects/PTH/lost").json()
    assert full["excluded"] == ["PTH-FR-003"]
    assert "PTH-FR-003" not in [i["display_id"] for i in full["items"]]
    assert client.get("/v1/projects/PTH/lost?priority=P9").status_code == 422


def test_graph_filters_by_relation_type(client):
    make(client, "US", "root")
    make(client, "FR", "refining")
    make(client, "ADR", "decision")
    rel(client, "refines", "PTH-FR-001", "PTH-US-001")
    rel(client, "motivates", "PTH-US-001", "PTH-ADR-001")
    only = client.get("/v1/projects/PTH/graph", params={"focus": "PTH-US-001", "relation_types": "motivates"}).json()
    assert [e["type"] for e in only["edges"]] == ["motivates"]
    assert "PTH-FR-001" not in [n["display_id"] for n in only["nodes"]]
    bad = client.get("/v1/projects/PTH/graph", params={"focus": "PTH-US-001", "relation_types": "satisfies"})
    assert bad.status_code == 422


def test_graph_missing_focus(client):
    assert client.get("/v1/projects/PTH/graph", params={"focus": "PTH-FR-999"}).status_code == 404


SPEC_SNIPPET = """# Спека

| ID | Роль и User Story | Проверяемый результат | Приоритет |
| --- | --- | --- | --- |
| PTH-US-001 | Как владелец, хочу проект | Есть ключ | P0 |
| PTH-US-002 | Как владелец, хочу импорт | Есть hash | P0 |

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-001 | Проекты | PTH-US-001 |
| PTH-FR-002 | Импорт | PTH-US-001 |

| User Story | ФТ | Приёмочные сценарии |
| --- | --- | --- |
| PTH-US-001 | PTH-FR-001 | PTH-AC-001 |
"""


def test_import_creates_artifacts_and_relations(client):
    r = client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET})
    assert r.status_code == 201, r.text
    report = r.json()
    assert (report["created"], report["revised"], report["unchanged"]) == (4, 0, 0)
    assert report["relations_created"] == 2  # FR-001 и FR-002 уточняют US-001
    assert client.get("/v1/projects/PTH/artifacts/PTH-FR-001").json()["title"] == "Проекты"
    # US-002 без ФТ-уточнения и без ADR — потерянная user story
    lost = client.get("/v1/projects/PTH/lost?type=US").json()
    assert [i["display_id"] for i in lost["items"]] == ["PTH-US-002"]


def test_reimport_is_idempotent_and_changes_become_revisions(client):
    client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET})
    again = client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET}).json()
    assert (again["created"], again["revised"], again["unchanged"], again["relations_created"]) == (0, 0, 4, 0)
    edited = SPEC_SNIPPET.replace("| Проекты |", "| Проекты и ключи |")
    changed = client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": edited}).json()
    assert changed["revised"] == 1 and changed["created"] == 0
    revs = client.get("/v1/projects/PTH/artifacts/PTH-FR-001/revisions").json()
    assert [r["title"] for r in revs] == ["Проекты", "Проекты и ключи"]


def test_import_links_to_artifacts_from_earlier_imports(client):
    client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET})
    later = "| ID | Требование | Основание |\n| --- | --- | --- |\n| PTH-FR-010 | Новое | PTH-US-001 |\n"
    r = client.post("/v1/projects/PTH/imports", json={"source_name": "later.md", "text": later}).json()
    assert r["relations_created"] == 1  # PTH-US-001 уже в проекте, хотя не в этом файле


def test_dry_run_changes_nothing(client):

    r = client.post("/v1/projects/PTH/imports", params={"dry_run": True},
                    json={"source_name": "spec.md", "text": SPEC_SNIPPET}).json()
    assert r["dry_run"] is True and r["uid"] is None
    assert r["created"] == 4
    assert {c["display_id"] for c in r["changes"]} == {"PTH-US-001", "PTH-US-002", "PTH-FR-001", "PTH-FR-002"}
    assert client.get("/v1/projects/PTH/artifacts").json() == []
    assert client.get("/v1/projects/PTH/imports").json() == []


def test_import_reports_changes_per_item(client):
    client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET})
    edited = SPEC_SNIPPET.replace("| Проекты |", "| Проекты и ключи |")
    r = client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": edited}).json()
    assert r["changes"] == [{"display_id": "PTH-FR-001", "action": "revised"}]


def test_import_keeps_source_text_and_hash(client):
    report = client.post("/v1/projects/PTH/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET}).json()
    detail = client.get(f"/v1/projects/PTH/imports/{report['uid']}").json()
    assert detail["source_text"] == SPEC_SNIPPET
    assert len(detail["source_sha256"]) == 64
    assert client.get("/v1/projects/PTH/imports").json()[0]["uid"] == report["uid"]
    assert client.get("/v1/projects/PTH/imports/nope").status_code == 404


def test_import_of_repository_spec_matches_registry(client):
    """Реальная спека: число созданных элементов совпадает с реестром, повтор ничего не меняет."""
    from pathlib import Path

    spec = Path(__file__).resolve().parents[2] / "Project_Traceability_System_Spec_v0.1.md"
    if not spec.exists():
        pytest.skip("спецификация не найдена рядом с сервером")
    text = spec.read_text(encoding="utf-8")
    first = client.post("/v1/projects/PTH/imports", json={"source_name": spec.name, "text": text}).json()
    assert first["created"] == 56 + 84 + 21 + 35
    assert first["unparsed"] == []
    assert first["relations_created"] > 0
    counts = client.get("/v1/projects/PTH/artifacts", params={"type": "US", "limit": 500}).json()
    assert len(counts) == 56
    second = client.post("/v1/projects/PTH/imports", json={"source_name": spec.name, "text": text}).json()
    assert (second["created"], second["revised"], second["unchanged"]) == (0, 0, 196)


def test_import_as_changeset_changes_nothing_until_applied(client):
    r = client.post("/v1/projects/PTH/imports", params={"as_changeset": True},
                    json={"source_name": "spec.md", "text": SPEC_SNIPPET}).json()
    assert r["changeset_uid"] and r["uid"] is None and r["created"] == 4
    assert client.get("/v1/projects/PTH/artifacts").json() == []
    cs = client.get(f"/v1/projects/PTH/changesets/{r['changeset_uid']}").json()
    assert cs["state"] == "draft" and cs["operation_count"] == 6  # 4 создания + 2 связи

    applied = client.post(f"/v1/projects/PTH/changesets/{r['changeset_uid']}/apply")
    assert applied.status_code == 200 and applied.json()["state"] == "applied"
    assert client.get("/v1/projects/PTH/artifacts/PTH-FR-001").json()["title"] == "Проекты"
    assert len(client.get("/v1/projects/PTH/imports").json()) == 1  # журнал пишется при применении
    assert client.get("/v1/projects/PTH/lost?type=US").json()["total"] == 1


def test_failed_changeset_writes_nothing_and_keeps_draft(client):
    ops = [
        {"op": "create_artifact", "display_id": "PTH-FR-050", "type": "FR", "number": 50, "title": "ok"},
        {"op": "create_relation", "type": "refines", "source": "PTH-FR-050", "target": "PTH-FR-999"},
    ]
    uid = client.post("/v1/projects/PTH/changesets", json={"title": "bad", "operations": ops}).json()["uid"]
    r = client.post(f"/v1/projects/PTH/changesets/{uid}/apply")
    assert r.status_code == 404  # цель связи не существует
    assert client.get("/v1/projects/PTH/artifacts/PTH-FR-050").status_code == 404  # первая операция откатилась
    cs = client.get(f"/v1/projects/PTH/changesets/{uid}").json()
    assert cs["state"] == "draft" and cs["last_error"]


def test_applied_changeset_cannot_be_applied_twice(client):
    uid = client.post("/v1/projects/PTH/changesets", json={"title": "one", "operations": [
        {"op": "create_artifact", "display_id": "PTH-FR-060", "type": "FR", "number": 60, "title": "x"}]}).json()["uid"]
    assert client.post(f"/v1/projects/PTH/changesets/{uid}/apply").status_code == 200
    again = client.post(f"/v1/projects/PTH/changesets/{uid}/apply")
    assert again.status_code == 409 and again.json()["error"]["code"] == "CHANGESET_NOT_DRAFT"


def test_unknown_operation_is_rejected_on_apply(client):
    uid = client.post("/v1/projects/PTH/changesets", json={"title": "x", "operations": [{"op": "drop_all"}]}).json()["uid"]
    assert client.post(f"/v1/projects/PTH/changesets/{uid}/apply").status_code == 422


def test_requests_without_token_get_401(app):
    with TestClient(app) as anon:
        assert anon.get("/v1/projects").status_code == 401
        assert anon.post("/v1/projects", json={"key": "XYZ", "name": "x"}).status_code == 401


def test_reader_can_read_but_not_write(app, client):
    reader = issue(app, name="viewer", kind="service", project_key="PTH", role="reader")
    with TestClient(app, headers={"Authorization": f"Bearer {reader}"}) as r:
        assert r.get("/v1/projects/PTH/lost").status_code == 200
        denied = r.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "x"})
        assert denied.status_code == 403 and denied.json()["error"]["code"] == "FORBIDDEN"


def test_writer_is_isolated_to_its_project(app, client):
    client.post("/v1/projects", json={"key": "OTHER", "name": "other"})
    writer = issue(app, name="pth-writer", kind="service", project_key="PTH", role="writer")
    with TestClient(app, headers={"Authorization": f"Bearer {writer}"}) as w:
        assert w.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "ok"}).status_code == 201
        assert w.get("/v1/projects/OTHER/lost").status_code == 403  # NFR-019: чужой проект закрыт
        assert w.post("/v1/projects", json={"key": "NEW", "name": "n"}).status_code == 403  # создавать может только admin
        assert w.get("/v1/projects").status_code == 403


def test_revoked_key_stops_working(app, client):
    from pth.auth import revoke
    from pth.models import ApiKey
    from sqlalchemy import select
    token = issue(app, name="temp", kind="service", project_key="PTH", role="writer")
    with app.state.session_factory() as s:
        uid = s.scalar(select(ApiKey.uid).where(ApiKey.name == "temp"))
        revoke(s, uid)
        s.commit()
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as t:
        assert t.get("/v1/projects/PTH/lost").status_code == 401


def test_tokens_are_stored_only_as_hashes(app, client):
    from pth.models import ApiKey
    from sqlalchemy import select
    token = issue(app, name="hashed", kind="service", project_key="PTH", role="reader")
    with app.state.session_factory() as s:
        stored = s.scalar(select(ApiKey.token_hash).where(ApiKey.name == "hashed"))
    assert stored != token and token not in stored and len(stored) == 64


def test_imported_project_gets_its_own_display_ids(client):
    """По спеке §1.5: импорт в проект SHOP даёт SHOP-*, исходный ID остаётся внешним ключом."""
    client.post("/v1/projects", json={"key": "SHOP", "name": "Shop"})
    r = client.post("/v1/projects/SHOP/imports", json={"source_name": "spec.md", "text": SPEC_SNIPPET})
    assert r.status_code == 201, r.text
    assert client.get("/v1/projects/SHOP/artifacts/SHOP-FR-001").json()["title"] == "Проекты"
    assert client.get("/v1/projects/SHOP/artifacts/PTH-FR-001").status_code == 404
    assert client.get("/v1/projects/SHOP/artifacts/SHOP-FR-001").json()["external_key"] == "PTH-FR-001"
    assert client.get("/v1/projects/SHOP/lost?type=US").json()["items"][0]["display_id"] == "SHOP-US-002"
    graph = client.get("/v1/projects/SHOP/graph", params={"focus": "SHOP-US-001", "depth": 1}).json()
    assert {e["source"] for e in graph["edges"]} == {"SHOP-FR-001", "SHOP-FR-002"}


SOURCE = "Пользователь выбирает товары. Система считает итог с учётом скидки."


def fake_lm(app, answer: str | None = None, models=("qwen-local",), fail=False):
    """Имитация LM Studio: /models и /chat/completions. fail — сеть недоступна."""
    import httpx

    def handler(request: httpx.Request) -> httpx.Response:
        if fail:
            raise httpx.ConnectError("refused", request=request)
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": [{"id": m} for m in models]})
        return httpx.Response(200, json={"choices": [{"message": {"content": answer}}]})

    app.state.llm_transport = httpx.MockTransport(handler)


def test_extraction_marks_verified_quotes_and_writes_nothing(app, client):
    import json
    answer = "```json\n" + json.dumps([
        {"type": "FR", "title": "Выбор товаров", "text": "Пользователь выбирает товары",
         "quote": "Пользователь выбирает товары."},
        {"type": "NFR", "title": "Скидка", "text": "Итог с учётом скидки", "quote": "придуманная фраза"},
        {"type": "XX", "title": "Неверный тип", "quote": ""},
    ]) + "\n```"
    fake_lm(app, answer=answer)
    r = client.post("/v1/projects/PTH/extractions", json={"model": "qwen-local", "text": SOURCE})
    assert r.status_code == 200, r.text
    body = r.json()
    assert [p["quote_verified"] for p in body["proposals"]] == [True, False]
    assert body["skipped"] == 1 and body["proposals"][0]["model"] == "qwen-local"
    assert client.get("/v1/projects/PTH/artifacts").json() == []  # модель ничего не записывает


def test_proposals_become_draft_with_provenance_and_apply(client, app):
    fake_lm(app, answer='[{"type": "FR", "title": "Итог", "text": "Считать итог", "quote": "считает итог"}]')
    proposals = client.post("/v1/projects/PTH/extractions", json={"model": "m", "text": SOURCE}).json()["proposals"]
    cs = client.post("/v1/projects/PTH/extractions/changesets",
                     json={"title": "из модели", "proposals": proposals}).json()
    assert cs["state"] == "draft" and cs["operations"][0]["display_id"] == "PTH-FR-001"
    assert cs["operations"][0]["attributes"]["provenance"]["quote_verified"] is True
    assert client.post(f"/v1/projects/PTH/changesets/{cs['uid']}/apply").status_code == 200
    stored = client.get("/v1/projects/PTH/artifacts/PTH-FR-001").json()
    assert stored["attributes"]["provenance"]["model"] == "m"


def test_lm_studio_unavailable_is_503(client, app):
    fake_lm(app, fail=True)
    r = client.post("/v1/projects/PTH/extractions", json={"model": "m", "text": SOURCE})
    assert r.status_code == 503 and r.json()["error"]["code"] == "LLM_UNAVAILABLE"


def test_bad_model_output_is_422(client, app):
    fake_lm(app, answer="Я думаю, что требований нет.")
    r = client.post("/v1/projects/PTH/extractions", json={"model": "m", "text": SOURCE})
    assert r.status_code == 422 and r.json()["error"]["code"] == "LLM_BAD_OUTPUT"


def test_models_list_is_admin_only(app, client):
    fake_lm(app, models=("a", "b"))
    assert client.get("/v1/llm/models").json() == ["a", "b"]
    reader = issue(app, name="r", kind="service", project_key="PTH", role="reader")
    with TestClient(app, headers={"Authorization": f"Bearer {reader}"}) as r:
        assert r.get("/v1/llm/models").status_code == 403


def wait_job(client, key, uid, timeout=10.0):
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/v1/projects/{key}/extractions/jobs/{uid}").json()
        if job["state"] in {"succeeded", "failed"}:
            return job
        time.sleep(0.05)
    raise AssertionError("задача не завершилась")


BIG_SPEC = "# Раздел А\n\n" + "Пользователь может создать проект. " * 40 + "\n\n## Раздел Б\n\nСистема отвечает за 500 мс.\n"


def test_chunking_splits_by_headings_and_size():
    from pth.chunking import split_spec
    chunks = split_spec(BIG_SPEC, max_chars=300)
    assert len(chunks) >= 3
    assert {title for title, _ in chunks} == {"Раздел А", "Раздел Б"}
    assert all(len(text) <= 300 or "\n" not in text for _, text in chunks)


def test_extraction_job_collects_dedupes_and_reports_progress(app, client):
    fake_lm(app, answer='[{"type": "FR", "title": "Создать проект", "text": "x", "quote": "Пользователь может создать проект."}]')
    job = client.post("/v1/projects/PTH/extractions/jobs",
                      json={"model": "m", "source_name": "big.md", "text": BIG_SPEC}).json()
    assert job["state"] in {"queued", "running", "succeeded"}
    done = wait_job(client, "PTH", job["uid"])
    assert done["state"] == "succeeded"
    assert done["chunks_done"] == done["chunks_total"] >= 2
    assert len(done["proposals"]) == 1  # одинаковые названия из разных фрагментов схлопнуты
    assert client.get("/v1/projects/PTH/artifacts").json() == []  # задача ничего не пишет в проект


def test_extraction_job_stops_when_model_unavailable(app, client):
    fake_lm(app, fail=True)
    job = client.post("/v1/projects/PTH/extractions/jobs",
                      json={"model": "m", "source_name": "s.md", "text": BIG_SPEC}).json()
    done = wait_job(client, "PTH", job["uid"])
    assert done["state"] == "failed" and done["errors"]
    assert client.get("/v1/projects/PTH/extractions/jobs/nope").status_code == 404


def test_me_works_for_any_valid_key_and_reports_rights(app, client):
    reader = issue(app, name="viewer", kind="service", project_key="PTH", role="reader")
    with TestClient(app, headers={"Authorization": f"Bearer {reader}"}) as r:
        me = r.get("/v1/me").json()
        assert me == {"name": "viewer", "kind": "service", "project_key": "PTH", "role": "reader"}
    assert client.get("/v1/me").json()["kind"] == "admin"


def test_search_matches_id_title_and_text(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Корзина покупателя", "text": "Товары в корзине"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "NFR", "title": "Скорость поиска", "text": "p95 до 500 мс"})
    assert [a["display_id"] for a in client.get("/v1/projects/PTH/search", params={"q": "корзин"}).json()] == ["PTH-FR-001"]
    assert [a["display_id"] for a in client.get("/v1/projects/PTH/search", params={"q": "500 мс"}).json()] == ["PTH-NFR-001"]
    assert [a["display_id"] for a in client.get("/v1/projects/PTH/search", params={"q": "pth-nfr"}).json()] == ["PTH-NFR-001"]
    assert client.get("/v1/projects/PTH/search", params={"q": "корзин", "type": "NFR"}).json() == []


def test_context_bundle_contains_card_graph_lost_and_drafts(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "US", "title": "Пользователь"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Вход"})
    client.post("/v1/projects/PTH/relations", json={"type": "refines", "source": "PTH-FR-001", "target": "PTH-US-001"})
    client.post("/v1/projects/PTH/changesets", json={"title": "черновик", "operations": [{"op": "drop"}]})
    ctx = client.get("/v1/projects/PTH/context", params={"focus": "PTH-US-001"}).json()
    assert ctx["focus"]["display_id"] == "PTH-US-001" and ctx["focus"]["revision"] == 1
    assert [n["display_id"] for n in ctx["graph"]["nodes"]] == ["PTH-US-001", "PTH-FR-001"]
    assert ctx["lost"] is None  # US отражена ФТ
    assert ctx["completeness"] == "complete" and len(ctx["draft_changesets"]) == 1
    fr = client.get("/v1/projects/PTH/context", params={"focus": "PTH-FR-001"}).json()
    assert fr["lost"]["reasons"] == ["no_code_link"]


def test_status_summarizes_project(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "a"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "b", "exemption_reason": "вне scope"})
    s = client.get("/v1/projects/PTH/status").json()
    assert s["artifacts"] == {"FR": 2} and s["lost"] == 1 and s["excluded"] == 1


def test_review_reports_rule_based_findings(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "NFR", "title": "Поиск быстрый", "text": "работает быстро"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Дубль", "attributes": {"priority": "P0"}})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "дубль", "attributes": {"priority": "P0"}})
    client.post("/v1/projects/PTH/artifacts", json={"type": "US", "title": "Пользователь"})
    r = client.get("/v1/projects/PTH/review").json()
    rules = {f["rule"] for f in r["findings"]}
    assert {"NFR_NO_CRITERION", "VAGUE_WORDING", "NO_PRIORITY", "DUPLICATE_TITLE", "LOST_USER_STORY", "FR_NOT_LINKED"} <= rules
    assert r["counts"]["error"] >= 1
    assert client.get("/v1/projects/PTH/review", params={"severity": "error"}).json()["findings"][0]["severity"] == "error"


def test_changeset_revision_is_stamped_by_server_and_conflicts_are_detected(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "v1"})
    # клиентский номер игнорируется: сервер ставит текущую ревизию (1)
    draft = client.post("/v1/projects/PTH/changesets", json={"title": "правка", "operations": [
        {"op": "add_revision", "display_id": "PTH-FR-001", "title": "v2", "expected_revision": 5}]}).json()
    assert draft["operations"][0]["expected_revision"] == 1
    # кто-то правит элемент раньше: черновик устаревает и применение даёт 409
    client.post("/v1/projects/PTH/artifacts/PTH-FR-001/revisions", json={"title": "другая правка"})
    assert client.post(f"/v1/projects/PTH/changesets/{draft['uid']}/apply").status_code == 409
    fresh = client.post("/v1/projects/PTH/changesets", json={"title": "правка", "operations": [
        {"op": "add_revision", "display_id": "PTH-FR-001", "title": "v3"}]}).json()["uid"]
    assert client.post(f"/v1/projects/PTH/changesets/{fresh}/apply").status_code == 200
    assert client.get("/v1/projects/PTH/artifacts/PTH-FR-001").json()["revision"] == 3


def test_impact_follows_catalog_rules_with_paths(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "US", "title": "Пользователь"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Вход"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "AC", "title": "Проверка входа"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "ADR", "title": "Решение"})
    client.post("/v1/projects/PTH/relations", json={"type": "refines", "source": "PTH-FR-001", "target": "PTH-US-001"})
    client.post("/v1/projects/PTH/relations", json={"type": "refines", "source": "PTH-AC-001", "target": "PTH-FR-001"})
    client.post("/v1/projects/PTH/relations", json={"type": "motivates", "source": "PTH-US-001", "target": "PTH-ADR-001"})
    r = client.get("/v1/projects/PTH/impact", params={"focus": "PTH-US-001", "depth": 2}).json()
    by_id = {i["display_id"]: i for i in r["items"]}
    assert by_id["PTH-FR-001"]["rule_id"] == "IMP-REFINES-CHILD" and by_id["PTH-FR-001"]["certainty"] == "explicit"
    assert by_id["PTH-AC-001"]["depth"] == 2 and by_id["PTH-AC-001"]["path"] == ["PTH-US-001", "PTH-FR-001", "PTH-AC-001"]
    assert by_id["PTH-ADR-001"]["rule_id"] == "IMP-MOTIVATES"
    up = client.get("/v1/projects/PTH/impact", params={"focus": "PTH-FR-001", "depth": 1}).json()
    parent = next(i for i in up["items"] if i["display_id"] == "PTH-US-001")
    assert parent["rule_id"] == "IMP-REFINES-PARENT" and parent["certainty"] == "candidate"


def test_jobs_left_running_are_marked_failed_on_restart(tmp_path):
    """Перезапуск не оставляет задачу в running: она становится failed, найденное сохраняется."""
    from pth import domain
    from pth.models import ExtractionJob
    url = f"sqlite:///{tmp_path / 'r.db'}"
    app = create_app(url)
    with app.state.session_factory() as s:
        domain.create_project(s, "PTH", "PTH")
        s.add(ExtractionJob(uid="job-1", project_key="PTH", model="m", source_name="s", state="running",
                            chunks_total=10, chunks_done=4, proposals=[], errors=[]))
        s.commit()
    app2 = create_app(url)  # перезапуск процесса
    token = issue(app2, name="b", kind="admin")
    with TestClient(app2, headers={"Authorization": f"Bearer {token}"}) as c:
        job = c.get("/v1/projects/PTH/extractions/jobs/job-1").json()
        assert job["state"] == "failed" and job["chunks_done"] == 4
        assert "перезапуском" in job["errors"][0]


def _verified_fr(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Вход"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "тест входа"})
    client.post("/v1/projects/PTH/relations", json={"type": "verifies", "source": "PTH-TEST-001", "target": "PTH-FR-001"})


def test_compliance_requires_fresh_passing_evidence(client):
    _verified_fr(client)
    assert client.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "not_verified"
    client.post("/v1/projects/PTH/evidence", json={"test": "PTH-TEST-001", "result": "pass", "commit_sha": "abc1234"})
    assert client.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "verified"
    client.post("/v1/projects/PTH/artifacts/PTH-FR-001/revisions", json={"title": "Вход v2"})
    assert client.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "stale"
    client.post("/v1/projects/PTH/evidence", json={"test": "PTH-TEST-001", "result": "fail"})
    assert client.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "failed"


def test_requirement_without_test_and_readiness(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "NFR", "title": "p95 ≤ 500 мс"})
    assert client.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "no_test"
    assert client.get("/v1/projects/PTH/readiness").json()["verdict"] == "not_ready"


def test_readiness_insufficient_without_requirements(client):
    assert client.get("/v1/projects/PTH/readiness").json()["verdict"] == "insufficient_data"


def test_psi_draft_lists_tests_and_gaps(client):
    _verified_fr(client)
    client.post("/v1/projects/PTH/evidence", json={"test": "PTH-TEST-001", "result": "pass"})
    text = client.get("/v1/projects/PTH/psi").text
    assert "| PTH-FR-001 | Вход | PTH-TEST-001 | verified |" in text and "## Пробелы" in text


def test_baseline_snapshot_and_listing(client):
    _verified_fr(client)
    b = client.post("/v1/projects/PTH/baselines", json={"name": "rc1"}).json()
    assert b["artifacts"] == 2 and b["relations"] == 1
    assert client.get("/v1/projects/PTH/baselines").json()[0]["name"] == "rc1"


def test_evidence_rejects_non_test_and_bad_result(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "x"})
    assert client.post("/v1/projects/PTH/evidence", json={"test": "PTH-FR-001", "result": "pass"}).status_code == 422
    client.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "t"})
    assert client.post("/v1/projects/PTH/evidence", json={"test": "PTH-TEST-001", "result": "ok"}).status_code == 422


def test_migrations_are_applied_once(tmp_path):
    from pth.db import make_engine
    from pth.migrations import MIGRATIONS, current_version, migrate
    engine = make_engine(f"sqlite:///{tmp_path / 'm.db'}")
    assert migrate(engine) == MIGRATIONS[-1][0]
    assert migrate(engine) == MIGRATIONS[-1][0]
    assert current_version(engine) == MIGRATIONS[-1][0] == 4


def test_commits_evidence_and_key_management_endpoints(app, client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Вход"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "тест входа"})
    client.post("/v1/projects/PTH/relations", json={"type": "verifies", "source": "PTH-TEST-001", "target": "PTH-FR-001"})
    client.post("/v1/projects/PTH/commits", json={"sha": "abc1234", "title": "feat: вход", "implements": ["PTH-FR-001"]})
    commits = client.get("/v1/projects/PTH/commits").json()
    assert commits[0]["sha"] == "abc1234" and commits[0]["implements"] == ["PTH-FR-001"]
    client.post("/v1/projects/PTH/evidence", json={"test": "PTH-TEST-001", "result": "pass"})
    ev = client.get("/v1/projects/PTH/evidence").json()
    assert ev[0]["test"] == "PTH-TEST-001" and ev[0]["result"] == "pass"
    b = client.post("/v1/projects/PTH/baselines", json={"name": "rc"}).json()
    assert client.get(f"/v1/projects/PTH/baselines/{b['uid']}").json()["artifacts"]["PTH-FR-001"] == 1
    created = client.post("/v1/keys", json={"name": "ci", "kind": "service", "project_key": "PTH", "role": "writer"}).json()
    assert created["token"].startswith("pth_")
    listed = client.get("/v1/keys").json()
    assert all("token" not in k and "token_hash" not in k for k in listed)
    uid = next(k["uid"] for k in listed if k["name"] == "ci")
    assert client.post(f"/v1/keys/{uid}/revoke").json()["revoked"] is True
    reader = issue(app, name="r", kind="service", project_key="PTH", role="reader")
    with TestClient(app, headers={"Authorization": f"Bearer {reader}"}) as r:
        assert r.get("/v1/keys").status_code == 403  # ключи управляет только admin


def test_changeset_draft_can_be_edited_until_applied(client):
    uid = client.post("/v1/projects/PTH/changesets", json={"title": "черновик", "operations": [
        {"op": "create_artifact", "display_id": "PTH-FR-070", "type": "FR", "number": 70, "title": "a"}]}).json()["uid"]
    edited = client.put(f"/v1/projects/PTH/changesets/{uid}", json={"title": "новое", "operations": [
        {"op": "create_artifact", "display_id": "PTH-FR-071", "type": "FR", "number": 71, "title": "b"}]}).json()
    assert edited["title"] == "новое" and edited["operation_count"] == 1
    client.post(f"/v1/projects/PTH/changesets/{uid}/apply")
    assert client.put(f"/v1/projects/PTH/changesets/{uid}", json={"title": "x"}).status_code == 409


def test_review_decision_needs_reason_and_reopens_after_change(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Поиск"})
    no_reason = client.post("/v1/projects/PTH/review/decisions",
                            json={"rule": "NO_PRIORITY", "display_id": "PTH-FR-001", "state": "dismissed", "reason": " "})
    assert no_reason.status_code == 422
    client.post("/v1/projects/PTH/review/decisions",
                json={"rule": "NO_PRIORITY", "display_id": "PTH-FR-001", "state": "dismissed", "reason": "уточним в E3"})
    f = next(x for x in client.get("/v1/projects/PTH/review").json()["findings"]
             if x["display_id"] == "PTH-FR-001" and x["rule"] == "NO_PRIORITY")
    assert f["state"] == "dismissed" and f["decision"]["reason"] == "уточним в E3"
    client.post("/v1/projects/PTH/artifacts/PTH-FR-001/revisions", json={"title": "Поиск v2"})
    f2 = next(x for x in client.get("/v1/projects/PTH/review").json()["findings"]
              if x["display_id"] == "PTH-FR-001" and x["rule"] == "NO_PRIORITY")
    assert f2["state"] == "reopened"


def test_audit_records_writes(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "t"})
    client.post("/v1/projects/PTH/evidence", json={"test": "PTH-TEST-001", "result": "pass"})
    events = client.get("/v1/projects/PTH/audit").json()
    assert events[0]["action"] == "evidence.record" and events[0]["target"] == "PTH-TEST-001"


def test_artifacts_are_paged_with_total_header(client):
    for i in range(5):
        client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": f"fr {i}"})
    r = client.get("/v1/projects/PTH/artifacts", params={"offset": 2, "limit": 2})
    assert r.headers["X-Total-Count"] == "5"
    assert [a["display_id"] for a in r.json()] == ["PTH-FR-003", "PTH-FR-004"]


def test_project_rename_is_admin_only_and_audited(app, client):
    assert client.patch("/v1/projects/PTH", json={"name": "Трассировка"}).json()["name"] == "Трассировка"
    writer = issue(app, name="w", kind="service", project_key="PTH", role="writer")
    with TestClient(app, headers={"Authorization": f"Bearer {writer}"}) as w:
        assert w.patch("/v1/projects/PTH", json={"name": "x"}).status_code == 403


def test_baseline_comparison_shows_changes(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "a"})
    a = client.post("/v1/projects/PTH/baselines", json={"name": "A"}).json()["uid"]
    client.post("/v1/projects/PTH/artifacts/PTH-FR-001/revisions", json={"title": "a2"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "b"})
    b = client.post("/v1/projects/PTH/baselines", json={"name": "B"}).json()["uid"]
    cmp = client.get("/v1/projects/PTH/baselines/compare", params={"a": a, "b": b}).json()
    assert cmp["added"] == ["PTH-FR-002"] and cmp["changed"] == ["PTH-FR-001"]


def test_source_view_links_lines_to_requirements(client):
    text = "# Спека\n\n| ID | Требование | Основание |\n| --- | --- | --- |\n| PTH-FR-001 | Вход | |\n"
    report = client.post("/v1/projects/PTH/imports", json={"source_name": "s.md", "text": text}).json()
    src = client.get(f"/v1/projects/PTH/sources/{report['uid']}").json()
    linked = [l for l in src["lines"] if l["display_id"]]
    assert linked and linked[0]["no"] == 5 and linked[0]["display_id"] == "PTH-FR-001"


def test_delete_relation_operation_in_changeset(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "a"})
    client.post("/v1/projects/PTH/artifacts", json={"type": "US", "title": "b"})
    client.post("/v1/projects/PTH/relations", json={"type": "refines", "source": "PTH-FR-001", "target": "PTH-US-001"})
    uid = client.post("/v1/projects/PTH/changesets", json={"title": "снять", "operations": [
        {"op": "delete_relation", "type": "refines", "source": "PTH-FR-001", "target": "PTH-US-001"}]}).json()["uid"]
    assert client.post(f"/v1/projects/PTH/changesets/{uid}/apply").status_code == 200
    assert client.get("/v1/projects/PTH/relations").json() == []


def test_long_lists_are_paged(client):
    for i in range(7):
        client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": f"fr {i}"})
    lost = client.get("/v1/projects/PTH/lost", params={"offset": 5, "limit": 5}).json()
    assert lost["total"] == 7 and len(lost["items"]) == 2
    review = client.get("/v1/projects/PTH/review", params={"offset": 0, "limit": 3}).json()
    assert review["total"] >= 3 and len(review["findings"]) == 3
    audit = client.get("/v1/projects/PTH/audit", params={"limit": 2})
    assert int(audit.headers["X-Total-Count"]) >= 7 and len(audit.json()) == 2
    client.post("/v1/projects/PTH/commits", json={"sha": "abcdef1", "title": "c", "implements": ["PTH-FR-001"]})
    detail = client.get("/v1/projects/PTH/commits/abcdef1")
    assert detail.status_code == 200 and detail.json()["implements"] == ["PTH-FR-001"]


@pytest.mark.covers("lost.reason")
def test_lost_reason_flag_and_code_first_order(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "US", "title": "история", "attributes": {"priority": "P0"}})
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "без кода", "attributes": {"priority": "P1"}})
    only_code = client.get("/v1/projects/PTH/lost", params={"reason": "no_code_link"}).json()
    assert [i["display_id"] for i in only_code["items"]] == ["PTH-FR-001"]
    only_refl = client.get("/v1/projects/PTH/lost", params={"reason": "no_reflection"}).json()
    assert [i["display_id"] for i in only_refl["items"]] == ["PTH-US-001"]
    everything = client.get("/v1/projects/PTH/lost").json()
    assert everything["items"][0]["display_id"] == "PTH-FR-001"  # связь с кодом — раньше user story
    assert client.get("/v1/projects/PTH/lost", params={"reason": "x"}).status_code == 422


def test_draft_edit_of_any_card_creates_new_revision_with_attributes(client):
    client.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Вход", "text": "старый текст",
                                                    "attributes": {"area": "auth"}})
    uid = client.post("/v1/projects/PTH/changesets", json={"title": "правка карточки", "operations": [
        {"op": "add_revision", "display_id": "PTH-FR-001", "title": "Вход", "text": "новый текст",
         "attributes": {"area": "auth", "priority": "P1"}, "exemption_reason": "вне первого релиза"}]}).json()["uid"]
    assert client.post(f"/v1/projects/PTH/changesets/{uid}/apply").status_code == 200
    card = client.get("/v1/projects/PTH/artifacts/PTH-FR-001").json()
    assert card["revision"] == 2 and card["text"] == "новый текст"
    assert card["attributes"] == {"area": "auth", "priority": "P1"}
    assert card["exemption_reason"] == "вне первого релиза"
    assert len(client.get("/v1/projects/PTH/artifacts/PTH-FR-001/revisions").json()) == 2  # старая ревизия сохранена
