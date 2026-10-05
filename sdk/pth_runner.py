"""Раннер: прогоняет тесты на конкретном коммите и отправляет результат в PTH.

    PTH_URL=http://127.0.0.1:8000 PTH_TOKEN=... \\
    python3 sdk/pth_runner.py --project PTH --repo /путь/к/репо --commit <sha> \\
        --tests PTH-TEST-001,PTH-TEST-002 --cmd "python3 -m pytest -q"

Как это устроено:
1. Коммит резолвится в полный OID в репозитории (git rev-parse). Рабочая копия не меняется.
2. Содержимое коммита распаковывается во временный каталог (git archive), там запускается команда.
3. Код возврата: 0 — pass, не 0 — fail, превышение времени — blocked.
4. Результат уходит в POST /ci/runs. Сервер сам проверит коммит по подключённому репозиторию.

Ограничение: одна команда даёт один результат всем перечисленным --tests. Пообтестовый результат
требует, чтобы команда печатала отчёт по тестам (например, JUnit XML); это отдельный парсер.
"""
import argparse
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile

import httpx


def resolve(repo: str, sha: str) -> str:
    out = subprocess.run(["git", "-C", repo, "rev-parse", "--verify", "--quiet", f"{sha}^{{commit}}"],
                         capture_output=True, text=True, check=False)
    if out.returncode != 0:
        raise SystemExit(f"Коммит {sha} не найден в {repo}")
    return out.stdout.strip()


def extract(repo: str, oid: str, target: str) -> None:
    archive = subprocess.run(["git", "-C", repo, "archive", oid], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(target, filter="data")


def run(command: str, cwd: str, timeout: int) -> tuple[str, int, str]:
    try:
        proc = subprocess.run(shlex.split(command), cwd=cwd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or "") + (exc.stderr or "") if isinstance(exc.stdout, str) else ""
        return "blocked", -1, output[-2000:] + f"\nпревышено время {timeout} с"
    output = (proc.stdout + proc.stderr)[-2000:]
    return ("pass" if proc.returncode == 0 else "fail"), proc.returncode, output


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--project", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--tests", required=True, help="ID через запятую, например PTH-TEST-001")
    parser.add_argument("--cmd", required=True, help="команда тестов, запускается в корне коммита")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args(argv)

    base = os.environ.get("PTH_URL", "http://127.0.0.1:8000").rstrip("/")
    token = os.environ.get("PTH_TOKEN")
    if not token:
        print("Задайте PTH_TOKEN (ключ с правом записи в проект)", file=sys.stderr)
        return 2
    oid = resolve(args.repo, args.commit)
    workdir = tempfile.mkdtemp(prefix="pth-run-")
    try:
        extract(args.repo, oid, workdir)
        result, code, log = run(args.cmd, workdir, args.timeout)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    tests = [t.strip() for t in args.tests.split(",") if t.strip()]
    body = {
        "commit": oid,
        "results": [{"test": t, "result": result} for t in tests],
        "environment": {"runner": "pth_runner", "command": args.cmd, "exit_code": code, "log_tail": log},
    }
    response = httpx.post(f"{base}/v1/projects/{args.project}/ci/runs", json=body,
                          headers={"Authorization": f"Bearer {token}"}, timeout=60)
    if response.status_code >= 400:
        print(f"PTH отклонил результат: {response.text}", file=sys.stderr)
        return 1
    print(json.dumps({"commit": oid, "result": result, "exit_code": code, "pth": response.json()},
                     ensure_ascii=False, indent=2))
    return 0 if result == "pass" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
