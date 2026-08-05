from app.config import Settings, get_settings
from app.backends.base import GenerationBackend
from app.backends.databricks_backend import DatabricksGenerationBackend
from app.backends.mock_backend import MockGenerationBackend


def get_generation_backend(settings: Settings | None = None) -> GenerationBackend:
    active_settings = settings or get_settings()
    if active_settings.model_provider_mode == "databricks":
        return DatabricksGenerationBackend(active_settings)
    return MockGenerationBackend()
