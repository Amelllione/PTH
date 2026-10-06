"""Сканирует тесты в коммите и находит аспекты, которые они проверяют (маркер @pytest.mark.covers("..."))."""
import re
import subprocess

COVERS = re.compile(r"@pytest\.mark\.covers\(\s*[\"']([^\"']+)[\"']\s*\)")


def declared_aspects(repo: str, oid: str, files: list[str]) -> dict[str, list[str]]:
    """Аспект -> имена тестов, которые его объявляют. Читает файлы из коммита, рабочую копию не трогает."""
    found: dict[str, list[str]] = {}
    for path in files:
        proc = subprocess.run(["git", "-C", repo, "show", f"{oid}:{path}"], capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            continue
        pending: list[str] = []
        for line in proc.stdout.splitlines():
            stripped = line.strip()
            m = COVERS.search(stripped)
            if m:
                pending.append(m.group(1))
                continue
            if stripped.startswith("def test_") and pending:
                name = stripped[len("def "):].split("(")[0]
                for aspect in pending:
                    found.setdefault(aspect, []).append(f"{path}::{name}")
                pending = []
    return found
