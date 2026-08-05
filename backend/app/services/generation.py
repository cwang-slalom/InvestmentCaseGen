from ..config import Settings, get_settings
from ..backends.base import GenerationBackend
from ..backends.databricks_backend import DatabricksGenerationBackend
from ..backends.mock_backend import MockGenerationBackend


def get_generation_backend(settings: Settings | None = None) -> GenerationBackend:
    active_settings = settings or get_settings()
    if active_settings.model_provider_mode == "databricks":
        return DatabricksGenerationBackend(active_settings)
    return MockGenerationBackend()
