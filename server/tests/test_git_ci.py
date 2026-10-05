"""Git и CI: подключение репозитория, проверка коммита, прогоны от CI, правило соответствия."""
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pth.api import create_app
from pth.auth import issue_key


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()


@pytest.fixture()
def repo(tmp_path):
    path = tmp_path / "repo"
    path.mkdir()
    _git(path, "init", "-q")
    _git(path, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init")
    (path / "check.py").write_text("import sys\nsys.exit(0)\n", encoding="utf-8")
    _git(path, "add", "check.py")
    _git(path, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "add check")
    return path


@pytest.fixture()
def env(tmp_path):
    app = create_app(f"sqlite:///{tmp_path / 'g.db'}")
    with app.state.session_factory() as s:
        admin = issue_key(s, name="admin", kind="admin")
        ci = issue_key(s, name="ci", kind="service", project_key="PTH", role="writer")
        s.commit()
    return app, admin, ci


def client_for(app, token):
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})


def seed(c):
    c.post("/v1/projects", json={"key": "PTH", "name": "PTH"})
    c.post("/v1/projects/PTH/artifacts", json={"type": "FR", "title": "Вход"})
    c.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "тест входа"})
    c.post("/v1/projects/PTH/relations", json={"type": "verifies", "source": "PTH-TEST-001", "target": "PTH-FR-001"})


def test_connect_repo_is_admin_only_and_validates_git(env, repo):
    app, admin, ci = env
    with client_for(app, admin) as a:
        a.post("/v1/projects", json={"key": "PTH", "name": "PTH"})
        ok = a.put("/v1/projects/PTH/repo", json={"path": str(repo)})
        assert ok.status_code == 200 and ok.json()["head"]
        bad = a.put("/v1/projects/PTH/repo", json={"path": str(repo.parent)})
        assert bad.status_code == 422 and bad.json()["error"]["code"] == "REPO_INVALID"
        assert a.get("/v1/projects/PTH/repo").json()["available"] is True
    with client_for(app, ci) as c:
        assert c.put("/v1/projects/PTH/repo", json={"path": str(repo)}).status_code == 403


def test_ci_run_on_real_commit_is_verified_and_counts_for_compliance(env, repo):
    app, admin, ci = env
    head = _git(repo, "rev-parse", "HEAD")
    with client_for(app, admin) as a:
        seed(a)
        a.put("/v1/projects/PTH/repo", json={"path": str(repo)})
    with client_for(app, ci) as c:
        short = head[:10]
        r = c.post("/v1/projects/PTH/ci/runs", json={"commit": short, "results": [{"test": "PTH-TEST-001", "result": "pass"}]})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["commit_oid"] == head and body["verified"] is True and body["trust_level"] == "trusted_ci"
    with client_for(app, admin) as a:
        ev = a.get("/v1/projects/PTH/evidence").json()[0]
        assert ev["verified"] is True and ev["issuer"] == "ci" and ev["commit_oid"] == head
        comp = a.get("/v1/projects/PTH/compliance").json()
        assert comp["items"][0]["status"] == "verified"


def test_ci_run_on_unknown_commit_is_rejected(env, repo):
    app, admin, ci = env
    with client_for(app, admin) as a:
        seed(a)
        a.put("/v1/projects/PTH/repo", json={"path": str(repo)})
    with client_for(app, ci) as c:
        r = c.post("/v1/projects/PTH/ci/runs", json={"commit": "deadbeef12", "results": [{"test": "PTH-TEST-001", "result": "pass"}]})
        assert r.status_code == 422 and r.json()["error"]["code"] == "COMMIT_NOT_FOUND"


def test_ci_run_without_repo_stays_pending_and_is_not_counted(env):
    app, admin, ci = env
    with client_for(app, admin) as a:
        seed(a)
    with client_for(app, ci) as c:
        r = c.post("/v1/projects/PTH/ci/runs", json={"commit": "abcdef1234", "results": [{"test": "PTH-TEST-001", "result": "pass"}]})
        assert r.status_code == 201 and r.json()["verified"] is False
    with client_for(app, admin) as a:
        assert a.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "not_verified"
        assert a.get("/v1/projects/PTH/repo").json()["connected"] is False


def test_ci_result_must_target_a_test(env, repo):
    app, admin, ci = env
    with client_for(app, admin) as a:
        seed(a)
        a.put("/v1/projects/PTH/repo", json={"path": str(repo)})
    with client_for(app, ci) as c:
        r = c.post("/v1/projects/PTH/ci/runs", json={"commit": _git(repo, "rev-parse", "HEAD"),
                                                     "results": [{"test": "PTH-FR-001", "result": "pass"}]})
        assert r.status_code == 422 and r.json()["error"]["code"] == "NOT_A_TEST"


def test_evidence_for_old_commit_is_stale_and_test_status_shows_it(env, repo):
    app, admin, ci = env
    head = _git(repo, "rev-parse", "HEAD")
    with client_for(app, admin) as a:
        seed(a)
        a.post("/v1/projects/PTH/artifacts", json={"type": "TEST", "title": "без запуска", "attributes": {"command": "pytest"}})
        a.put("/v1/projects/PTH/repo", json={"path": str(repo)})
    with client_for(app, ci) as c:
        c.post("/v1/projects/PTH/ci/runs", json={"commit": head, "results": [{"test": "PTH-TEST-001", "result": "pass"}]})
    with client_for(app, admin) as a:
        assert a.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "verified"
        st = a.get("/v1/projects/PTH/tests").json()
        assert st["head"] == head and st["counts"] == {"passed_current": 1, "not_run": 1}
        assert st["requirements_without_test"] == []
        # новый коммит: старое свидетельство больше не действует для HEAD
        (repo / "more.txt").write_text("x", encoding="utf-8")
        _git(repo, "add", "more.txt")
        _git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "next")
        assert a.get("/v1/projects/PTH/compliance").json()["items"][0]["status"] == "stale"
        st2 = a.get("/v1/projects/PTH/tests").json()
        assert st2["tests"][0]["state"] == "passed_old_commit"
