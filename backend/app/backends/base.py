from abc import ABC, abstractmethod

from ..models.base import BackendHealth
from ..models.generation import GeneratedSection, GenerationResult
from ..models.project import Project


class GenerationBackend(ABC):
    @abstractmethod
    async def health_check(self) -> BackendHealth:
        raise NotImplementedError

    @abstractmethod
    async def generate(self, project: Project) -> GenerationResult:
        raise NotImplementedError

    @abstractmethod
    async def regenerate_section(
        self,
        project: Project,
        generation: GenerationResult,
        section_id: str,
    ) -> GeneratedSection:
        raise NotImplementedError
