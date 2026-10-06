"""Клиент sdk/pth_client.py против живого приложения (TestClient как транспорт)."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "sdk"))
from pth_client import PTHClient, PTHError  # noqa: E402

from pth.api import create_app  # noqa: E402
from pth.auth import issue_key  # noqa: E402

SNIPPET = "| ID | Требование | Основание |\n| --- | --- | --- |\n| PTH-FR-001 | Проекты | PTH-US-001 |\n"


@pytest.fixture()
def api(tmp_path):
    app = create_app(f"sqlite:///{tmp_path / 'c.db'}")
    with app.state.session_factory() as s:
        token = issue_key(s, name="sdk", kind="admin")
        s.commit()
    http = TestClient(app)
    client = PTHClient("http://test", token, http=_Prefixed(http))
    client.create_project("PTH", "PTH")
    return client


class _Prefixed:
    """Добавляет /v1 к относительным путям клиента: TestClient работает с полными URL."""
    def __init__(self, inner):
        self.inner = inner

    def request(self, method, path, **kwargs):
        return self.inner.request(method, "/v1" + path, **kwargs)


def test_import_dry_run_then_changeset_then_apply(api):
    report = api.import_spec("PTH", "spec.md", SNIPPET, mode="dry_run")
    assert report["dry_run"] and report["created"] == 1 and api.artifacts("PTH") == []
    draft = api.import_spec("PTH", "spec.md", SNIPPET, mode="changeset")
    assert draft["changeset_uid"] and api.artifacts("PTH") == []
    api.apply_changeset("PTH", draft["changeset_uid"])
    assert api.artifact("PTH", "PTH-FR-001")["title"] == "Проекты"


def test_errors_are_raised_with_codes(api):
    with pytest.raises(PTHError) as exc:
        api.artifact("PTH", "PTH-FR-999")
    assert exc.value.status == 404 and exc.value.code == "ARTIFACT_NOT_FOUND"


def test_lost_and_graph_helpers(api):
    api.import_spec("PTH", "spec.md", SNIPPET, mode="apply")
    assert api.lost("PTH", type_="FR", reason="no_code_link")["total"] == 1
    graph = api.graph("PTH", "PTH-FR-001", depth=1)
    assert graph["focus"] == "PTH-FR-001" and len(graph["nodes"]) >= 1


def test_invalid_mode_is_rejected_locally(api):
    with pytest.raises(ValueError):
        api.import_spec("PTH", "s.md", SNIPPET, mode="commit")
