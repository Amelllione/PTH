"""Резервная копия базы SQLite без остановки сервера (через механизм backup SQLite).

    .venv/bin/python scripts/backup_db.py            # в server/backups/
    .venv/bin/python scripts/backup_db.py КУДА.db    # в указанный файл

После копирования проверяет целостность (PRAGMA integrity_check) и версию схемы.
Для PostgreSQL используйте pg_dump: этот скрипт SQLite-only.
"""
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def backup(source: Path, target: Path) -> dict:
    if not source.exists():
        raise SystemExit(f"Нет базы {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    src = sqlite3.connect(source)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
    finally:
        src.close()
    check = dst.execute("PRAGMA integrity_check").fetchone()[0]
    has_version = dst.execute("SELECT 1 FROM sqlite_master WHERE name='schema_version'").fetchone()
    version = dst.execute("SELECT MAX(version) FROM schema_version").fetchone()[0] if has_version else None
    dst.close()
    if check != "ok":
        raise SystemExit(f"Копия повреждена: {check}")
    # None — база создана до миграций; первый запуск сервера их применит
    return {"file": str(target), "integrity": check, "schema_version": version}


if __name__ == "__main__":
    source = ROOT / "pth.db"
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "backups" / f"pth-{datetime.now():%Y%m%d-%H%M%S}.db"
    print(backup(source, target))
