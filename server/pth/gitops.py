"""Read-only Git-адаптер (спека, §13.2): проверяет коммит в заранее настроенном репозитории.

Только чтение: rev-parse, cat-file, rev-parse --is-bare/--git-dir. Команды передаются списком,
без shell. Произвольные URL не открываются: путь задаёт администратор проекта.
"""
import re
import subprocess
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{7,40}$")
TIMEOUT = 15


class GitError(Exception):
    pass


def _run(repo: str, *args: str) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True,
                              timeout=TIMEOUT, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise GitError(f"git недоступен: {exc.__class__.__name__}") from exc


def validate_repo(path: str) -> dict:
    """Проверяет, что путь — существующий git-репозиторий. Возвращает абсолютный путь и HEAD."""
    p = Path(path).expanduser()
    if not p.is_dir():
        raise GitError("путь не существует или не каталог")
    absolute = str(p.resolve())
    inside = _run(absolute, "rev-parse", "--git-dir")
    if inside.returncode != 0:
        raise GitError("путь не является git-репозиторием")
    head = _run(absolute, "rev-parse", "--verify", "--quiet", "HEAD^{commit}")
    return {"path": absolute, "head": head.stdout.strip() if head.returncode == 0 else None}


def resolve_commit(repo: str, sha: str) -> str | None:
    """Полный OID коммита или None, если коммита нет или SHA некорректен."""
    if not HEX.match(sha or ""):
        return None
    result = _run(repo, "rev-parse", "--verify", "--quiet", f"{sha}^{{commit}}")
    return result.stdout.strip() if result.returncode == 0 else None


def path_exists_at(repo: str, oid: str, path: str) -> bool:
    """Проверка code_refs из manifest: путь существует в закреплённом коммите."""
    return _run(repo, "cat-file", "-e", f"{oid}:{path}").returncode == 0
