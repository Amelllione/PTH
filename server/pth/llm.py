"""Выделение требований моделью через LM Studio (OpenAI-совместимый API, спека FR-011, DEC-10).

Модель только предлагает требования. Каждое предложение сохраняется с цитатой и признаком
quote_verified (цитата найдена в исходном тексте дословно). Запись в проект — только через
черновик ChangeSet, который пользователь применяет сам.
"""
import json
import re

import httpx

from pth.domain import DomainError
from pth.prompts import render_extract

DEFAULT_BASE = "http://127.0.0.1:1234/v1"
TYPES = {"US", "FR", "NFR", "AC"}

# Промпт и его версия: pth/prompts.py



class LLMClient:
    def __init__(self, base_url: str = DEFAULT_BASE, api_key: str | None = None,
                 transport: httpx.BaseTransport | None = None, timeout: float = 120.0):
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._http = httpx.Client(base_url=base_url.rstrip("/"), headers=headers,
                                  timeout=timeout, transport=transport)

    def _get(self, path: str) -> dict:
        try:
            r = self._http.get(path)
        except httpx.HTTPError as exc:
            raise DomainError(503, "LLM_UNAVAILABLE", f"LM Studio недоступен: {exc.__class__.__name__}") from exc
        if r.status_code == 401:
            raise DomainError(503, "LLM_AUTH", "LM Studio требует токен: задайте переменную LM_API_TOKEN")
        if r.status_code >= 400:
            raise DomainError(503, "LLM_ERROR", f"LM Studio вернул {r.status_code}")
        return r.json()

    def models(self) -> list[str]:
        """Идентификаторы моделей, которые LM Studio может использовать."""
        return sorted(item["id"] for item in self._get("/models").get("data", []))

    def extract(self, model: str, text: str) -> list[dict]:
        """Просит модель выделить требования. Возвращает сырые элементы, проверка — в validate()."""
        body = {
            "model": model,
            "temperature": 0,
            "messages": [{"role": "user", "content": render_extract(text)}],
        }
        try:
            r = self._http.post("/chat/completions", json=body)
        except httpx.HTTPError as exc:
            raise DomainError(503, "LLM_UNAVAILABLE", f"LM Studio недоступен: {exc.__class__.__name__}") from exc
        if r.status_code == 401:
            raise DomainError(503, "LLM_AUTH", "LM Studio требует токен: задайте переменную LM_API_TOKEN")
        if r.status_code >= 400:
            raise DomainError(503, "LLM_ERROR", f"LM Studio вернул {r.status_code}: {r.text[:200]}")
        content = r.json()["choices"][0]["message"]["content"]
        return parse_json_array(content)


def parse_json_array(content: str) -> list[dict]:
    """Достаёт JSON-массив из ответа модели; допускает обёртку в ```json."""
    match = re.search(r"\[.*\]", content, re.DOTALL)
    if not match:
        raise DomainError(422, "LLM_BAD_OUTPUT", "Модель не вернула JSON-массив")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise DomainError(422, "LLM_BAD_OUTPUT", f"Некорректный JSON от модели: {exc.msg}") from exc
    if not isinstance(data, list):
        raise DomainError(422, "LLM_BAD_OUTPUT", "Ответ модели — не массив")
    return data


def validate(raw: list[dict], source_text: str, model: str) -> list[dict]:
    """Отбрасывает некорректные элементы и помечает, найдена ли цитата в тексте дословно."""
    proposals = []
    normalized_source = " ".join(source_text.split())
    for item in raw:
        if not isinstance(item, dict):
            continue
        type_ = str(item.get("type", "")).upper()
        title = str(item.get("title", "")).strip()
        if type_ not in TYPES or not title:
            continue
        quote = str(item.get("quote", "")).strip()
        proposals.append({
            "type": type_,
            "title": title[:300],
            "text": str(item.get("text", "")).strip(),
            "quote": quote,
            "quote_verified": bool(quote) and " ".join(quote.split()) in normalized_source,
            "model": model,
        })
    return proposals
