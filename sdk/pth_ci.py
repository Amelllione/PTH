"""Прогон тестов из pth-tests.json на указанном коммите и запись результатов в PTH.

Вызывается post-commit хуком (scripts/install_git_hook.sh) или вручную:
    PTH_URL=... PTH_TOKEN=... PTH_PYTHON=/путь/к/python python3 sdk/pth_ci.py --commit <sha>

Каждая запись pth-tests.json запускается через sdk/pth_runner.py. {python} в команде заменяется на PTH_PYTHON,
потому что в временной копии коммита нет виртуального окружения.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def repo_root() -> Path:
    out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True)
    return Path(out.stdout.strip())


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--commit", required=True)
    parser.add_argument("--project", default="PTH")
    args = parser.parse_args(argv)

    root = repo_root()
    python = os.environ.get("PTH_PYTHON", sys.executable)
    items = json.loads((root / "pth-tests.json").read_text(encoding="utf-8"))
    failures = 0
    for item in items:
        command = item["command"].replace("{python}", python)
        print(f"[{args.commit[:10]}] {item['test']}: {command}", flush=True)
        proc = subprocess.run([python, str(HERE / "pth_runner.py"), "--project", args.project,
                               "--repo", str(root), "--commit", args.commit, "--tests", item["test"],
                               "--cmd", command], capture_output=True, text=True)
        print(proc.stdout.strip() or proc.stderr.strip(), flush=True)
        failures += 1 if proc.returncode not in (0, 1) else 0
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
