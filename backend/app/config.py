from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "InvestmentGen API"
    database_url: str = (
        "postgresql+psycopg://investmentgen:investmentgen"
        "@localhost:5432/investmentgen"
    )
    backend_cors_origins: str = "http://localhost:3000"
    model_provider_mode: str = "deterministic"
    google_cloud_project: str | None = None
    vertex_ai_location: str | None = None
    google_cloud_location: str | None = None
    vertex_ai_model: str | None = None
    live_api_model: str | None = None
    google_application_credentials: str | None = None
    google_oauth_access_token: str | None = None
    google_genai_use_vertexai: bool = False
    use_mock_ai: bool = False
    model_max_output_tokens: int = 8192
    databricks_host: str | None = None
    databricks_token: str | None = None
    databricks_client_id: str | None = None
    databricks_client_secret: str | None = None
    databricks_model: str | None = None
    databricks_model_serving_endpoint: str | None = None
    databricks_ai_gateway_base_url: str | None = None
    anthropic_api_key: str | None = None
    anthropic_model: str | None = None
    claude_model: str | None = None
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_version: str = "2023-06-01"
    pghost: str | None = None
    pgdatabase: str | None = None
    pguser: str | None = None
    pgpassword: str | None = None
    pgport: int = 5432
    pgsslmode: str = "require"

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def vertex_location(self) -> str | None:
        return self.vertex_ai_location or self.google_cloud_location

    @property
    def vertex_model(self) -> str | None:
        return self.vertex_ai_model or self.live_api_model

    @property
    def databricks_model_name(self) -> str | None:
        return self.databricks_model_serving_endpoint or self.databricks_model

    @property
    def claude_model_name(self) -> str | None:
        return self.anthropic_model or self.claude_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
