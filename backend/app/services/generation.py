from ..config import Settings, get_settings
from ..backends.base import GenerationBackend
from ..backends.databricks_backend import DatabricksGenerationBackend
from ..backends.model_required_backend import ModelRequiredGenerationBackend


def get_generation_backend(settings: Settings | None = None) -> GenerationBackend:
    active_settings = settings or get_settings()
    mode = active_settings.model_provider_mode.strip().lower()
    if mode in {"databricks", "databricks-model-serving", "mosaic", "mosaic-ai"}:
        return DatabricksGenerationBackend(active_settings)
    return ModelRequiredGenerationBackend()
