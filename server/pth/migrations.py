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


def _m5_impact_rules(engine: Engine) -> None:
    """Свои правила влияния (§6.4): таблица impact_rules; встроенные правила в коде, не в базе."""
    import pth.models  # noqa: F401 — регистрирует все таблицы в Base.metadata
    Base.metadata.create_all(engine)


def _m6_impact_rule_text(engine: Engine) -> None:
    """Название и описание своих правил влияния."""
    Base.metadata.create_all(engine)
    columns = {"title": "VARCHAR(120) NOT NULL DEFAULT ''", "description": "VARCHAR(500) NOT NULL DEFAULT ''"}
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(impact_rules)"))}
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE impact_rules ADD COLUMN {name} {ddl}"))


def _m7_impact_rule_focus(engine: Engine) -> None:
    """Тип изменяемого элемента — вторая сторона правила: «что изменилось» → «что проверяем»."""
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(impact_rules)"))}
        if "focus_type" not in existing:
            conn.execute(text("ALTER TABLE impact_rules ADD COLUMN focus_type VARCHAR(10)"))


def _m8_attachments(engine: Engine) -> None:
    """Файлы к запускам тестов: логи, нагрузочные отчёты, Allure."""
    import pth.models  # noqa: F401
    Base.metadata.create_all(engine)


def _m9_releases(engine: Engine) -> None:
    """Релизы и их состав."""
    import pth.models  # noqa: F401
    Base.metadata.create_all(engine)


MIGRATIONS = [(1, _m1_baseline), (2, _m2_evidence_baselines), (3, _m3_audit_review), (4, _m4_git_trust),
              (5, _m5_impact_rules), (6, _m6_impact_rule_text), (7, _m7_impact_rule_focus), (8, _m8_attachments), (9, _m9_releases)]


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
