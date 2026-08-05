from __future__ import annotations

from app.config import Settings
from app.models.base import BackendHealth
from app.models.generation import GeneratedSection, GenerationResult
from app.models.project import Project

from .base import GenerationBackend


class DatabricksRequestAdapter:
    """Placeholder mapping layer for the client-approved Databricks resource."""

    def map_generate(self, project: Project) -> dict[str, object]:
        raise NotImplementedError(
            "Add model-serving or agent-specific request mapping after the "
            "client approves the endpoint type and payload contract.",
        )


class DatabricksGenerationBackend(GenerationBackend):
    provider_name = "databricks-generation-backend"

    def __init__(self, settings: Settings, adapter: DatabricksRequestAdapter | None = None):
        self.settings = settings
        self.adapter = adapter or DatabricksRequestAdapter()

    async def health_check(self) -> BackendHealth:
        if not self.settings.databricks_host or not self.settings.databricks_model_name:
            return BackendHealth(
                status="not_configured",
                provider=self.provider_name,
                message=(
                    "Databricks backend is prepared but not configured. Supply the "
                    "approved host, endpoint or agent resource, and App identity permissions."
                ),
            )
        return BackendHealth(
            status="not_configured",
            provider=self.provider_name,
            message=(
                "Databricks credentials are present, but endpoint-specific request "
                "mapping has not been approved for Phase 1."
            ),
        )

    async def generate(self, project: Project) -> GenerationResult:
        self.adapter.map_generate(project)
        raise RuntimeError("Databricks generation is not configured for this client workspace.")

    async def regenerate_section(
        self,
        project: Project,
        generation: GenerationResult,
        section_id: str,
    ) -> GeneratedSection:
        raise RuntimeError("Databricks section regeneration is not configured.")
