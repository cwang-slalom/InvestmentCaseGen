from app.config import Settings
from app.db import database_url_from_pg_env, normalize_database_url, resolve_database_url


def test_database_url_from_pg_env_uses_lakebase_style_variables() -> None:
    settings = Settings(
        pghost="ep-example.database.us-west-2.cloud.databricks.com",
        pgdatabase="databricks_postgres",
        pguser="service-principal-id",
        pgpassword="oauth-token",
        pgport=5432,
        pgsslmode="require",
    )

    assert database_url_from_pg_env(settings) == (
        "postgresql+psycopg://service-principal-id:oauth-token@"
        "ep-example.database.us-west-2.cloud.databricks.com:5432/"
        "databricks_postgres?sslmode=require"
    )


def test_resolve_database_url_prefers_pg_env_over_local_default() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://local:local@localhost:5432/local",
        pghost="ep-example.database.us-west-2.cloud.databricks.com",
        pgdatabase="databricks_postgres",
        pguser="service-principal-id",
        pgpassword="oauth-token",
    )

    assert "localhost" not in resolve_database_url(settings)


def test_normalize_database_url_switches_to_psycopg_driver() -> None:
    assert normalize_database_url("postgresql://user:pass@host:5432/db") == (
        "postgresql+psycopg://user:pass@host:5432/db"
    )
