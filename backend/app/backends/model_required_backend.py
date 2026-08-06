from __future__ import annotations

from ..models.base import BackendHealth
from ..models.generation import GeneratedSection, GenerationResult
from ..models.project import Project

from .base import GenerationBackend


class ModelRequiredGenerationBackend(GenerationBackend):
    provider_name = "model-required-generation-backend"
    message = (
        "Live model generation is required. Configure MODEL_PROVIDER_MODE=databricks "
        "with the approved Databricks host, model serving endpoint, and credentials."
    )

    async def health_check(self) -> BackendHealth:
        return BackendHealth(
            status="not_configured",
            provider=self.provider_name,
            message=self.message,
        )

    async def generate(self, project: Project) -> GenerationResult:
        raise ValueError(self.message)

    async def regenerate_section(
        self,
        project: Project,
        generation: GenerationResult,
        section_id: str,
    ) -> GeneratedSection:
        raise ValueError(self.message)
