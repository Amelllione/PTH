"""Конфигурация репозитория проекта (спека, §13.2): один заранее заданный путь на проект."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from pth.db import Base
from pth.models.common import utcnow


class ProjectRepo(Base):
    __tablename__ = "project_repos"

    project_key: Mapped[str] = mapped_column(ForeignKey("projects.key"), primary_key=True)
    path: Mapped[str] = mapped_column(String(1024))
    head: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
