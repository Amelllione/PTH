"""Релизы: набор требований, который берут в выпуск, фиксация набора и решение о выпуске."""
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import new_uid, utcnow


class Release(Base):
    __tablename__ = "releases"
    __table_args__ = (UniqueConstraint("project_key", "name", name="uq_release_name"),)

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(1000), default="")
    # planned — набираем состав; frozen — состав зафиксирован; released — выпущен; cancelled — отменён
    status: Mapped[str] = mapped_column(String(20), default="planned")
    position: Mapped[int] = mapped_column(Integer, default=0)  # порядок среди релизов для карты историй
    tag: Mapped[str | None] = mapped_column(String(200), nullable=True)
    commit_oid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # Готовность на момент выпуска: счётчики и блокирующие элементы; не пересчитывается после выпуска.
    readiness: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ReleaseItem(Base):
    __tablename__ = "release_items"
    __table_args__ = (UniqueConstraint("release_uid", "artifact_uid", name="uq_release_item"),)

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    release_uid: Mapped[str] = mapped_column(ForeignKey("releases.uid"), index=True)
    artifact_uid: Mapped[str] = mapped_column(ForeignKey("artifacts.uid"), index=True)
    added_via: Mapped[str] = mapped_column(String(20), default="manual")  # manual | related
    frozen_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
