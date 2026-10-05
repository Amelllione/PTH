"""Импортирует принятую спецификацию в проект через API (сервер должен быть запущен).

    .venv/bin/python scripts/import_spec.py ../Project_Traceability_System_Spec_v0.1.md PTH
"""
import os
import sys
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000/v1"

if __name__ == "__main__":
    path = Path(sys.argv[1])
    key = sys.argv[2] if len(sys.argv) > 2 else "PTH"
    token = os.environ["PTH_TOKEN"]  # ключ с правом записи в проект, см. scripts/create_key.py
    with httpx.Client(base_url=BASE, timeout=30, headers={"Authorization": f"Bearer {token}"}) as c:
        c.post("/projects", json={"key": key, "name": key})  # 409 — проект уже есть, это нормально
        r = c.post(f"/projects/{key}/imports", json={"source_name": path.name, "text": path.read_text(encoding="utf-8")})
        r.raise_for_status()
        print({k: v for k, v in r.json().items() if k in ("created", "revised", "unchanged", "relations_created")},
              "нераспознано:", len(r.json()["unparsed"]))
