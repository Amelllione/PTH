"""Журнал аудита и решения по замечаниям (§12.2 Review inbox, FR-072)."""
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import new_uid, utcnow


class AuditEvent(Base):
    """Запись о каждой записи в проект: кто, что, над чем. Только добавление."""

    __tablename__ = "audit_events"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    actor: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(60))
    target: Mapped[str | None] = mapped_column(String(200), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReviewDecision(Base):
    """Решение по замечанию: resolved или dismissed с причиной. Привязано к ревизии элемента,
    поэтому при новой ревизии замечание открывается снова (FR-030)."""

    __tablename__ = "review_decisions"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    rule: Mapped[str] = mapped_column(String(60))
    display_id: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(20))  # resolved | dismissed
    reason: Mapped[str] = mapped_column(Text)
    actor: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
