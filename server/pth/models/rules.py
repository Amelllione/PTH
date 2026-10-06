"""Свои правила влияния (§6.4): проект задаёт, какие соседи затрагиваются по связи, и что проверить.
Встроенные правила — в domain.IMPACT_RULES и здесь не хранятся."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import utcnow


class ImpactRule(Base):
    __tablename__ = "impact_rules"
    __table_args__ = (UniqueConstraint("project_key", "code", name="uq_impact_rule_code"),)

    uid: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), index=True)
    code: Mapped[str] = mapped_column(String(40))
    relation_type: Mapped[str] = mapped_column(String(20))
    direction: Mapped[str] = mapped_column(String(3))            # in | out — как в обходе влияния
    # Списки типов через запятую, например «FR,NFR»; None — любой тип, допустимый по связи.
    focus_type: Mapped[str | None] = mapped_column(String(60), nullable=True)     # что изменилось
    neighbor_type: Mapped[str | None] = mapped_column(String(60), nullable=True)  # что проверяем
    certainty: Mapped[str] = mapped_column(String(10))           # explicit | candidate
    title: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(String(500), default="")
    action: Mapped[str] = mapped_column(String(200))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
