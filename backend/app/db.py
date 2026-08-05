from collections.abc import Generator
from functools import lru_cache
from urllib.parse import quote

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings, get_settings


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def database_url_from_pg_env(settings: Settings) -> str | None:
    if not settings.pghost or not settings.pgdatabase or not settings.pguser:
        return None

    user = quote(settings.pguser, safe="")
    password = settings.pgpassword or settings.databricks_token
    password_segment = f":{quote(password, safe='')}" if password else ""
    host = settings.pghost
    database = quote(settings.pgdatabase, safe="")
    sslmode = quote(settings.pgsslmode, safe="")

    return (
        f"postgresql+psycopg://{user}{password_segment}@"
        f"{host}:{settings.pgport}/{database}?sslmode={sslmode}"
    )


def resolve_database_url(settings: Settings) -> str:
    return database_url_from_pg_env(settings) or settings.database_url


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(
        normalize_database_url(resolve_database_url(settings)),
        pool_pre_ping=True,
    )


def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()


def check_database() -> None:
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
