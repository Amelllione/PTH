"""Общие функции моделей: идентификаторы и время."""
import uuid
from datetime import datetime, timezone


def new_uid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
