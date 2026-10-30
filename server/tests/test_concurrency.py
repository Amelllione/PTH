"""Параллельная запись: номера артефактов, коммиты; номера не выдаются повторно."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from pth.api import create_app
from pth.auth import issue_key


@pytest.fixture()
def env(tmp_path):
    app = create_app(f"sqlite:///{tmp_path / 'c.db'}")
    with app.state.session_factory() as s:
        token = issue_key(s, name="admin", kind="admin")
        s.commit()
    c = TestClient(app, headers={"Authorization": f"Bearer {token}"})
    c.post("/v1/projects", json={"key": "PTH", "name": "PTH"})
    return app, c, token


def _parallel(app, token, calls):
    def run(call):
        with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as cl:
            return call(cl)
    with ThreadPoolExecutor(8) as pool:
        return list(pool.map(run, calls))


def test_parallel_creation_gets_distinct_numbers(env):
    """Раньше номер считался как max+1 до записи: параллельные запросы получали один номер и 500."""
    app, c, token = env
    calls = [lambda cl, n=n: cl.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": f"t{n}"}) for n in range(24)]
    calls += [lambda cl, n=n: cl.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": f"f{n}"}) for n in range(24)]
    responses = _parallel(app, token, calls)
    assert [r.status_code for r in responses] == [201] * 48
    ids = [r.json()["display_id"] for r in responses]
    assert len(set(ids)) == 48
    assert sorted(i for i in ids if "-TEST-" in i) == [f"PTH-TEST-{n:03d}" for n in range(1, 25)]


def test_parallel_same_commit_is_registered_once(env):
    app, c, token = env
    sha = "a" * 40
    calls = [lambda cl: cl.post("/v1/projects/PTH/commits", json={"sha": sha, "title": "x", "implements": []})] * 12
    codes = [r.status_code for r in _parallel(app, token, calls)]
    assert codes.count(201) == 1 and set(codes) == {201, 409}  # ни одного 500
    assert len(c.get("/v1/projects/PTH/artifacts", params={"type": "COMMIT"}).json()) == 1


def test_numbers_continue_after_changeset_and_are_not_reused(env, tmp_path):
    """ChangeSet задаёт номер сам — счётчик его догоняет; удалённый в обход API номер повторно не выдаётся."""
    import sqlite3
    _, c, _ = env
    c.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "a"})
    uid = c.post("/v1/projects/PTH/changesets", json={"title": "imp", "operations": [
        {"op": "create_artifact", "display_id": "PTH-TEST-050", "type": "TEST", "number": 50, "title": "b"}]}).json()["uid"]
    assert c.post(f"/v1/projects/PTH/changesets/{uid}/apply").status_code == 200
    assert c.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "c"}).json()["display_id"] == "PTH-TEST-051"
    with sqlite3.connect(tmp_path / "c.db") as con:  # как скрипт удаления дублей: стираем последний
        con.execute("DELETE FROM artifact_revisions WHERE artifact_uid = (SELECT uid FROM artifacts WHERE display_id = 'PTH-TEST-051')")
        con.execute("DELETE FROM artifacts WHERE display_id = 'PTH-TEST-051'")
    assert c.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "d"}).json()["display_id"] == "PTH-TEST-052"


def test_sqlite_file_engine_does_not_pool_connections(tmp_path):
    """Пул 5 + 10 при 60 параллельных агентах заканчивался и запросы падали 500 через 30 с (живая нагрузка)."""
    from sqlalchemy.pool import NullPool
    from pth.db import make_engine
    assert isinstance(make_engine(f"sqlite:///{tmp_path / 'p.db'}").pool, NullPool)
    memory = make_engine("sqlite:///:memory:")  # база в памяти живёт в одном соединении — пул остаётся
    assert not isinstance(memory.pool, NullPool)
    with memory.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE t (x)")
    with memory.connect() as conn:
        assert conn.exec_driver_sql("SELECT count(*) FROM t").scalar() == 0
