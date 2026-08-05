from abc import ABC, abstractmethod

from app.models.audience import AudienceProfile
from app.models.extraction import ExtractionResult
from app.models.generation import GenerationResult
from app.models.opportunity import Opportunity
from app.models.project import (
    OpportunityAudienceUpdate,
    Project,
    ProjectCreate,
    ReviewSetupUpdate,
    TaskUpdate,
)
from app.models.source import SourceDocument


class CaseRepository(ABC):
    @abstractmethod
    def list_projects(self) -> list[Project]:
        raise NotImplementedError

    @abstractmethod
    def create_project(self, request: ProjectCreate) -> Project:
        raise NotImplementedError

    @abstractmethod
    def get_project(self, project_id: str) -> Project:
        raise NotImplementedError

    @abstractmethod
    def update_task(self, project_id: str, request: TaskUpdate) -> Project:
        raise NotImplementedError

    @abstractmethod
    def update_opportunity_audience(
        self,
        project_id: str,
        request: OpportunityAudienceUpdate,
    ) -> Project:
        raise NotImplementedError

    @abstractmethod
    def save_extraction(self, project_id: str, extraction: ExtractionResult) -> Project:
        raise NotImplementedError

    @abstractmethod
    def update_review_setup(self, project_id: str, request: ReviewSetupUpdate) -> Project:
        raise NotImplementedError

    @abstractmethod
    def save_generation(self, project_id: str, generation: GenerationResult) -> Project:
        raise NotImplementedError


class OpportunityRepository(ABC):
    @abstractmethod
    def list_opportunities(self) -> list[Opportunity]:
        raise NotImplementedError

    @abstractmethod
    def get_opportunity(self, opportunity_id: str) -> Opportunity:
        raise NotImplementedError


class AudienceRepository(ABC):
    @abstractmethod
    def list_audiences(self) -> list[AudienceProfile]:
        raise NotImplementedError

    @abstractmethod
    def get_audience(self, audience_id: str) -> AudienceProfile:
        raise NotImplementedError


class SourceProcessor(ABC):
    @abstractmethod
    async def extract(self, source_label: str, project_id: str | None) -> ExtractionResult:
        raise NotImplementedError


class GenerationStore(ABC):
    @abstractmethod
    def get_generation(self, generation_id: str) -> GenerationResult:
        raise NotImplementedError

    @abstractmethod
    def save_generation(self, generation: GenerationResult) -> GenerationResult:
        raise NotImplementedError
