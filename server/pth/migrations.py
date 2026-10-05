"""Версии схемы. Каждая миграция — функция, применяется один раз, номер хранится в schema_version.

Новая схема: добавьте функцию и запись в MIGRATIONS. Существующие номера не меняются.
"""
from sqlalchemy import Engine, text

from pth.db import Base


def _m1_baseline(engine: Engine) -> None:
    """Исходная схема: create_all создаёт все таблицы, уже существующие не трогает."""
    Base.metadata.create_all(engine)


def _m2_evidence_baselines(engine: Engine) -> None:
    """Свидетельства проверок и базовые снимки (SK-10, SK-11, SK-13)."""
    Base.metadata.create_all(engine)


def _m3_audit_review(engine: Engine) -> None:
    """Журнал аудита и решения по замечаниям."""
    Base.metadata.create_all(engine)


def _m4_git_trust(engine: Engine) -> None:
    """Git-проверка свидетельств: коммит, признак проверки, уровень доверия, отправитель; таблица репозиториев."""
    Base.metadata.create_all(engine)
    columns = {
        "commit_oid": "VARCHAR(64)",
        "verified": "BOOLEAN NOT NULL DEFAULT 0",
        "trust_level": "VARCHAR(32) NOT NULL DEFAULT 'human_recorded'",
        "issuer": "VARCHAR(200)",
    }
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(evidence)"))}
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE evidence ADD COLUMN {name} {ddl}"))


MIGRATIONS = [(1, _m1_baseline), (2, _m2_evidence_baselines), (3, _m3_audit_review), (4, _m4_git_trust)]


def current_version(engine: Engine) -> int:
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)"))
        row = conn.execute(text("SELECT MAX(version) FROM schema_version")).scalar()
        return row or 0


def migrate(engine: Engine) -> int:
    """Применяет недостающие миграции по порядку. Возвращает итоговую версию."""
    applied = current_version(engine)
    for number, step in MIGRATIONS:
        if number <= applied:
            continue
        step(engine)
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO schema_version (version) VALUES (:v)"), {"v": number})
        applied = number
    return applied
