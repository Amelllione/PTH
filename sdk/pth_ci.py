"""Прогон тестов проекта на указанном коммите и запись результатов в PTH.

Сначала новые коммиты регистрируются в PTH (POST /git/sync). Список тестов берётся с сервера PTH: каждый TEST с атрибутом command (и необязательным workdir).
Если сервер недоступен или тестов с командой нет, используется pth-tests.json в корне репозитория.

Вызывается post-commit хуком (scripts/install_git_hook.sh) или вручную:
    PTH_URL=... PTH_TOKEN=... PTH_PYTHON=/путь/к/python python3 sdk/pth_ci.py --commit <sha>

Атрибут artifacts (маски через пробел, например «allure-results report.sarif») указывает отчёты, которые
нужно приложить к запуску; полный вывод команды прикладывается всегда как output.log.

Команда без начального {python} считается аргументами pytest: «tests/test_api.py -k lost» превращается в
«{python} -m pytest -q tests/test_api.py -k lost». {python} заменяется на PTH_PYTHON, потому что в временной
копии коммита нет виртуального окружения. Каждый тест запускается через sdk/pth_runner.py.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def repo_root() -> Path:
    out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True)
    return Path(out.stdout.strip())


def normalize(command: str) -> str:
    """Аргументы pytest превращаются в полную команду; готовая команда с {python} остаётся как есть."""
    command = command.strip()
    return command if command.startswith("{python}") else "{python} -m pytest -q " + command


def server_tests(project: str) -> list[dict]:
    """Тесты с командой из PTH. Пустой список при любой ошибке: вызывающий переходит на файл."""
    token = os.environ.get("PTH_TOKEN")
    if not token:
        return []
    try:
        from pth_client import PTHClient
        data = PTHClient(os.environ.get("PTH_URL", "http://127.0.0.1:8000"), token).tests_status(project)
    except Exception as exc:  # noqa: BLE001 — хук не должен падать из-за недоступного сервера
        print(f"Список тестов с сервера не получен: {exc}", flush=True)
        return []
    return [{"test": t["test"], "command": normalize(t["command"]), "subdir": t.get("workdir") or "",
             "artifacts": t.get("artifacts") or ""}
            for t in data["tests"] if t.get("command")]


def register_commits(project: str) -> None:
    """Регистрирует новые коммиты в PTH, даже если у проекта нет тестов. Ошибка не мешает коммиту."""
    token = os.environ.get("PTH_TOKEN")
    if not token:
        return
    try:
        from pth_client import PTHClient
        out = PTHClient(os.environ.get("PTH_URL", "http://127.0.0.1:8000"), token).sync_commits(project)
        print(f"Коммиты зарегистрированы: {out['registered']}, уже были: {out['already']}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"Регистрация коммитов не удалась: {exc}", flush=True)


def file_tests(root: Path) -> list[dict]:
    path = root / "pth-tests.json"
    if not path.exists():
        return []
    return [{"test": i["test"], "command": i["command"], "subdir": i.get("workdir", "")}
            for i in json.loads(path.read_text(encoding="utf-8"))]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--commit", required=True)
    parser.add_argument("--project", default="PTH")
    args = parser.parse_args(argv)

    root = repo_root()
    python = os.environ.get("PTH_PYTHON", sys.executable)
    register_commits(args.project)
    items = server_tests(args.project)
    source = "сервер PTH"
    if not items:
        items, source = file_tests(root), "pth-tests.json"
    print(f"[{args.commit[:10]}] тестов: {len(items)} (источник: {source})", flush=True)
    failures = 0
    for item in items:
        command = item["command"].replace("{python}", python)
        print(f"[{args.commit[:10]}] {item['test']}: {command}", flush=True)
        extra = ["--subdir", item["subdir"]] if item["subdir"] else []
        if item.get("artifacts"):
            extra += ["--artifacts", item["artifacts"]]
        proc = subprocess.run([python, str(HERE / "pth_runner.py"), "--project", args.project,
                               "--repo", str(root), "--commit", args.commit, "--tests", item["test"],
                               "--cmd", command, *extra], capture_output=True, text=True)
        print(proc.stdout.strip() or proc.stderr.strip(), flush=True)
        failures += 1 if proc.returncode not in (0, 1) else 0
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
