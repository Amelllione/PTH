"""Свидетельства проверок и базовые снимки (SK-10, SK-11, SK-13)."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import new_uid, utcnow


class Evidence(Base):
    """Результат запуска проверки (TEST) на конкретном коммите. Неизменяемая запись."""

    __tablename__ = "evidence"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    test_uid: Mapped[str] = mapped_column(ForeignKey("artifacts.uid"), index=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[str] = mapped_column(String(20))  # pass | fail | blocked | inconclusive
    environment: Mapped[dict] = mapped_column(JSON, default=dict)
    # Проверка по Git (§13.2, §14.4): полный OID, найден ли коммит, уровень доверия и кто передал.
    commit_oid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    trust_level: Mapped[str] = mapped_column(String(32), default="human_recorded")
    issuer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Baseline(Base):
    """Неизменяемый снимок: головные ревизии артефактов, связи и коммиты на момент создания."""

    __tablename__ = "baselines"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
