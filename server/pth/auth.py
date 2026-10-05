"""Аутентификация и права доступа (спека, FR-070, FR-071, NFR-019).

Токен передаётся в заголовке `Authorization: Bearer <token>`. Права: admin — все проекты и
создание проектов; writer — чтение и запись в одном проекте; reader — только чтение.
Отказ: без токена — 401, недостаточно прав или чужой проект — 403.
"""
import hashlib
import secrets
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from pth.domain import DomainError
from pth.models import ApiKey, new_uid, utcnow

RANK = {"reader": 1, "writer": 2}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_key(session: Session, name: str, kind: str, project_key: str | None = None,
              role: str | None = None) -> str:
    """Создаёт ключ и возвращает токен один раз; в БД остаётся только хеш."""
    if kind not in {"admin", "user", "service"}:
        raise ValueError("kind должен быть admin, user или service")
    if kind != "admin" and (project_key is None or role not in RANK):
        raise ValueError("для не-admin ключа нужны project_key и role (reader | writer)")
    token = "pth_" + secrets.token_urlsafe(32)
    session.add(ApiKey(uid=new_uid(), name=name, kind=kind, token_hash=hash_token(token),
                       project_key=None if kind == "admin" else project_key,
                       role=None if kind == "admin" else role, created_at=utcnow()))
    session.flush()
    return token


def authenticate(session: Session, authorization: str | None) -> ApiKey:
    if not authorization or not authorization.startswith("Bearer "):
        raise DomainError(401, "UNAUTHORIZED", "Нужен заголовок Authorization: Bearer <token>")
    token = authorization.removeprefix("Bearer ").strip()
    key = session.scalar(select(ApiKey).where(ApiKey.token_hash == hash_token(token)))
    if key is None or key.revoked_at is not None:
        raise DomainError(401, "UNAUTHORIZED", "Ключ неизвестен или отозван")
    return key


def authorize(principal: ApiKey, project_key: str | None, need: str) -> None:
    """project_key=None — операция над всей системой (создание проектов): только admin."""
    if principal.kind == "admin":
        return
    if project_key is None:
        raise DomainError(403, "FORBIDDEN", "Операция доступна только администратору")
    if principal.project_key != project_key:
        raise DomainError(403, "FORBIDDEN", "Ключ не имеет доступа к этому проекту")
    if RANK[principal.role] < RANK[need]:
        raise DomainError(403, "FORBIDDEN", f"Нужна роль {need}, у ключа {principal.role}")


def revoke(session: Session, uid: str, at: datetime | None = None) -> None:
    key = session.get(ApiKey, uid)
    if key is None:
        raise DomainError(404, "KEY_NOT_FOUND", f"Ключ {uid} не найден")
    key.revoked_at = at or utcnow()
    session.flush()
