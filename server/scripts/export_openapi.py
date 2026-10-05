"""Пишет OpenAPI-спеку приложения в server/openapi.json (источник для UI и клиентов).

    .venv/bin/python scripts/export_openapi.py
"""
import json
from pathlib import Path

from pth.api import create_app

OUT = Path(__file__).resolve().parent.parent / "openapi.json"

if __name__ == "__main__":
    spec = create_app("sqlite:///:memory:").openapi()
    OUT.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"записано {OUT} ({len(spec['paths'])} путей)")
