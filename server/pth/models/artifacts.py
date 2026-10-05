from datetime import datetime
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import new_uid, utcnow


class Artifact(Base):
    __tablename__ = "artifacts"
    __table_args__ = (
        UniqueConstraint("project_key", "display_id"),
        UniqueConstraint("project_key", "external_key"),
    )

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    type: Mapped[str] = mapped_column(String(10))
    number: Mapped[int] = mapped_column(Integer)
    display_id: Mapped[str] = mapped_column(String(64))
    # Внешний ключ для COMMIT (SHA); у остальных типов пусто.
    external_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ArtifactRevision(Base):
    __tablename__ = "artifact_revisions"
    __table_args__ = (UniqueConstraint("artifact_uid", "number"),)

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    artifact_uid: Mapped[str] = mapped_column(ForeignKey("artifacts.uid"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    text: Mapped[str] = mapped_column(Text, default="")
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    # Обоснованное исключение из проверки (PTH-US-045): выводит элемент из списка потерянных.
    exemption_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Relation(Base):
    __tablename__ = "relations"
    __table_args__ = (UniqueConstraint("type", "source_uid", "target_uid"),)

    uid: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uid)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    source_uid: Mapped[str] = mapped_column(ForeignKey("artifacts.uid"), index=True)
    target_uid: Mapped[str] = mapped_column(ForeignKey("artifacts.uid"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
