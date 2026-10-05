from datetime import datetime
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import new_uid, utcnow


class Project(Base):
    __tablename__ = "projects"

    key: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApiKey(Base):
    """API-ключ: в БД хранится только SHA-256 токена (FR-071). kind=admin — доступ ко всем проектам."""

    __tablename__ = "api_keys"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(10))  # admin | user | service
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    project_key: Mapped[str | None] = mapped_column(ForeignKey("projects.key"), nullable=True)
    role: Mapped[str | None] = mapped_column(String(10), nullable=True)  # reader | writer
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
