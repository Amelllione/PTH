from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import new_uid, utcnow


class ChangeSet(Base):
    """Черновик изменений: список операций, применяется целиком или не применяется (спека, §7)."""

    __tablename__ = "changesets"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    state: Mapped[str] = mapped_column(String(20), default="draft")  # draft | applied
    operations: Mapped[list] = mapped_column(JSON, default=list)
    # Источник импорта, если черновик создан из спеки: имя, sha256, текст и отчёт.
    source: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ImportSession(Base):
    """Неизменяемая запись импорта: исходный текст, его hash и отчёт (спека, §8.2, FR-009)."""

    __tablename__ = "import_sessions"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    source_name: Mapped[str] = mapped_column(String(200))
    source_sha256: Mapped[str] = mapped_column(String(64), index=True)
    source_text: Mapped[str] = mapped_column(Text)
    report: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ExtractionJob(Base):
    """Фоновое выделение требований по всему документу. Состояние в БД: переживает перезапуск."""

    __tablename__ = "extraction_jobs"

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    model: Mapped[str] = mapped_column(String(200))
    source_name: Mapped[str] = mapped_column(String(200))
    state: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|succeeded|failed
    chunks_total: Mapped[int] = mapped_column(Integer, default=0)
    chunks_done: Mapped[int] = mapped_column(Integer, default=0)
    proposals: Mapped[list] = mapped_column(JSON, default=list)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
