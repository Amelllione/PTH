"""Подключение к БД. По умолчанию SQLite; PostgreSQL — через PTH_DATABASE_URL (спека, §15.1)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    if not url.startswith("sqlite"):
        return create_engine(url)
    # timeout: сколько запрос ждёт блокировку записи SQLite. По умолчанию 5 с — при десятках параллельных агентов
    # этого не хватало («database is locked» → 500); запись короткая, очередь рассасывается за секунды.
    # NullPool: соединение с файлом SQLite открывается за доли миллисекунды, а пул (5 + 10) при 60 параллельных
    # запросах заканчивался: сессии завершённых запросов ждут свободного потока, чтобы закрыться, и вернуть
    # соединение было некому — запросы стояли до таймаута пула 30 с и падали 500.
    # База в памяти живёт, пока открыто соединение, — для неё остаётся пул SQLAlchemy по умолчанию.
    in_memory = url in ("sqlite://", "sqlite:///:memory:") or "mode=memory" in url
    return create_engine(url, connect_args={"check_same_thread": False, "timeout": 30},
                         **({} if in_memory else {"poolclass": NullPool}))


def make_session_factory(engine):
    return sessionmaker(engine, expire_on_commit=False)
