"""Заполняет демо-проект PTH через HTTP API (сервер должен быть запущен).

    .venv/bin/python -m pth &          # в одном терминале
    .venv/bin/python scripts/seed_demo.py
"""
import os

import httpx

BASE = os.environ.get("PTH_API", "http://127.0.0.1:8000/v1")
SHA = "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432"


def post(client: httpx.Client, path: str, body: dict) -> dict:
    r = client.post(path, json=body)
    if r.status_code == 409:  # уже есть — демо-данные идемпотентны по смыслу
        return {}
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    token = os.environ["PTH_TOKEN"]  # admin-ключ: демо создаёт проект
    with httpx.Client(base_url=BASE, timeout=10, headers={"Authorization": f"Bearer {token}"}) as c:
        post(c, "/projects", {"key": "PTH", "name": "Project Traceability Hub"})
        p = "/projects/PTH"
        post(c, f"{p}/artifacts", {"type": "US", "title": "Трассировка требований", "attributes": {"priority": "P0"}})
        post(c, f"{p}/artifacts", {"type": "US", "title": "Импорт принятой спецификации", "attributes": {"priority": "P0"}})
        post(c, f"{p}/artifacts", {"type": "FR", "title": "Реестр сущностей с ID", "attributes": {"priority": "P0"}})
        post(c, f"{p}/artifacts", {"type": "FR", "title": "Граф связей с фильтрами", "attributes": {"priority": "P1"}})
        post(c, f"{p}/artifacts", {"type": "NFR", "title": "Поиск по сущностям p95 ≤ 500 мс", "attributes": {"priority": "P0"}})
        post(c, f"{p}/artifacts", {"type": "ADR", "title": "Сервис как источник истины"})
        post(c, f"{p}/artifacts", {"type": "AC", "title": "Повторный импорт без дублей", "attributes": {"priority": "P0"}, "exemption_reason": "Проверяется на этапе E2"})
        post(c, f"{p}/relations", {"type": "refines", "source": "PTH-FR-001", "target": "PTH-US-001"})
        post(c, f"{p}/relations", {"type": "refines", "source": "PTH-FR-002", "target": "PTH-US-001"})
        post(c, f"{p}/relations", {"type": "motivates", "source": "PTH-US-001", "target": "PTH-ADR-001"})
        post(c, f"{p}/commits", {"sha": SHA, "title": "feat: реестр сущностей с ID", "implements": ["PTH-FR-001"]})
        print("demo PTH: US-002 потерян (нет ФТ/ADR), FR-002 и NFR-001 потеряны (нет кода)")
