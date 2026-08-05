from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException

from app.fixtures import (
    AUDIENCES,
    DEMO_NOTICE,
    OPPORTUNITIES,
    SOURCES,
    default_review_setup,
    default_suggestions,
    generated_example,
    recent_projects,
    source_readiness,
)
from app.models.audience import AudienceProfile
from app.models.extraction import ExtractionResult
from app.models.generation import GenerationResult
from app.models.opportunity import Opportunity
from app.models.project import (
    OpportunityAudienceState,
    OpportunityAudienceUpdate,
    Project,
    ProjectCreate,
    ReviewSetupState,
    ReviewSetupUpdate,
    TaskState,
    TaskUpdate,
)
from app.models.source import SourceDocument
from app.repositories.base import AudienceRepository, CaseRepository, GenerationStore, OpportunityRepository


def utc_now() -> str:
    return datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class InMemoryOpportunityRepository(OpportunityRepository):
    def __init__(self, opportunities: list[Opportunity] | None = None):
        self.opportunities = {item.id: item for item in opportunities or OPPORTUNITIES}

    def list_opportunities(self) -> list[Opportunity]:
        return list(self.opportunities.values())

    def get_opportunity(self, opportunity_id: str) -> Opportunity:
        try:
            return self.opportunities[opportunity_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Opportunity not found.") from error


class InMemoryAudienceRepository(AudienceRepository):
    def __init__(self, audiences: list[AudienceProfile] | None = None):
        self.audiences = {item.id: item for item in audiences or AUDIENCES}

    def list_audiences(self) -> list[AudienceProfile]:
        return list(self.audiences.values())

    def get_audience(self, audience_id: str) -> AudienceProfile:
        try:
            return self.audiences[audience_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Audience not found.") from error


class InMemoryGenerationStore(GenerationStore):
    def __init__(self):
        seed = generated_example()
        self.generations: dict[str, GenerationResult] = {seed.generation_id: seed}

    def get_generation(self, generation_id: str) -> GenerationResult:
        try:
            return self.generations[generation_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Generation not found.") from error

    def save_generation(self, generation: GenerationResult) -> GenerationResult:
        self.generations[generation.generation_id] = generation
        return generation


class InMemoryCaseRepository(CaseRepository):
    def __init__(
        self,
        opportunity_repo: InMemoryOpportunityRepository,
        audience_repo: InMemoryAudienceRepository,
        generation_store: InMemoryGenerationStore,
    ):
        now = utc_now()
        self.opportunity_repo = opportunity_repo
        self.audience_repo = audience_repo
        self.generation_store = generation_store
        self.projects: dict[str, Project] = {project.id: project for project in recent_projects(now)}
        self.extractions: dict[str, ExtractionResult] = {}
        self.next_number = 3

    def list_projects(self) -> list[Project]:
        return sorted(self.projects.values(), key=lambda item: item.updated_at, reverse=True)

    def create_project(self, request: ProjectCreate) -> Project:
        project_id = f"demo-project-{self.next_number}"
        self.next_number += 1
        now = utc_now()
        project = Project(
            id=project_id,
            name=request.name or "Untitled investment case",
            createdAt=now,
            updatedAt=now,
            demoNotice=DEMO_NOTICE,
        )
        self.projects[project.id] = project
        return project

    def get_project(self, project_id: str) -> Project:
        try:
            project = self.projects[project_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Project not found.") from error
        return self._with_default_review(project)

    def update_task(self, project_id: str, request: TaskUpdate) -> Project:
        project = self.get_project(project_id)
        metadata = {
            "source": "user",
            "required": True,
            "editable": True,
            "confirmed": bool(request.selected_task_id or request.custom_description),
        }
        project.task = TaskState(
            selectedTaskId=request.selected_task_id,
            taskLabel=request.task_label,
            customDescription=request.custom_description or "",
            metadata=metadata,
        )
        return self._touch(project)

    def update_opportunity_audience(
        self,
        project_id: str,
        request: OpportunityAudienceUpdate,
    ) -> Project:
        project = self.get_project(project_id)
        custom_title = None
        if request.source_mode == "new" and project.extraction_id:
            extraction = self.extractions.get(project.extraction_id)
            if extraction:
                name_field = next(
                    (field for field in extraction.fields if field.id == "opportunity_name"),
                    None,
                )
                custom_title = name_field.value if name_field else None

        suggestions = list(request.suggestions)
        if (
            request.source_mode == "existing"
            and request.opportunity_id
            and request.audience_id
            and not suggestions
        ):
            suggestions = default_suggestions(
                self.opportunity_repo.get_opportunity(request.opportunity_id),
                self.audience_repo.get_audience(request.audience_id),
            )

        project.opportunity_audience = OpportunityAudienceState(
            sourceMode=request.source_mode,
            opportunityId=request.opportunity_id,
            audienceId=request.audience_id,
            intendedOutcome=request.intended_outcome,
            suggestions=suggestions,
            selectedOutputs=request.selected_outputs,
            customOpportunityTitle=custom_title,
        )
        project.review_setup = None
        return self._touch(project)

    def save_extraction(self, project_id: str, extraction: ExtractionResult) -> Project:
        project = self.get_project(project_id)
        self.extractions[extraction.id] = extraction
        project.extraction_id = extraction.id
        if project.opportunity_audience and project.opportunity_audience.source_mode == "new":
            name_field = next((field for field in extraction.fields if field.id == "opportunity_name"), None)
            project.opportunity_audience.custom_opportunity_title = name_field.value if name_field else None
        project.review_setup = None
        return self._touch(project)

    def get_extraction(self, extraction_id: str) -> ExtractionResult:
        try:
            return self.extractions[extraction_id]
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Extraction not found.") from error

    def update_extraction(
        self,
        project_id: str,
        extraction: ExtractionResult,
        confirmed: bool,
    ) -> Project:
        project = self.get_project(project_id)
        extraction = extraction.model_copy(
            update={
                "fields": [
                    field.model_copy(
                        update={
                            "metadata": field.metadata.model_copy(
                                update={"confirmed": confirmed or field.verified},
                            )
                        }
                    )
                    for field in extraction.fields
                ]
            },
            deep=True,
        )
        self.extractions[extraction.id] = extraction
        project.extraction_id = extraction.id
        if project.opportunity_audience and project.opportunity_audience.source_mode == "new":
            name_field = next((field for field in extraction.fields if field.id == "opportunity_name"), None)
            project.opportunity_audience.custom_opportunity_title = name_field.value if name_field else None
        project.review_setup = None
        return self._touch(project)

    def update_review_setup(self, project_id: str, request: ReviewSetupUpdate) -> Project:
        project = self.get_project(project_id)
        source_count = self._source_count(project)
        extraction_confirmed = self._extraction_confirmed(project)
        output_count = len(project.opportunity_audience.selected_outputs) if project.opportunity_audience else 0
        project.review_setup = ReviewSetupState(
            approachFields=request.approach_fields,
            roles=request.roles,
            confirmed=request.confirmed,
            sourceReadiness=source_readiness(source_count, extraction_confirmed, output_count),
        )
        return self._touch(project)

    def save_generation(self, project_id: str, generation: GenerationResult) -> Project:
        project = self.get_project(project_id)
        self.generation_store.save_generation(generation)
        project.generation_id = generation.generation_id
        return self._touch(project)

    def _touch(self, project: Project) -> Project:
        project.updated_at = utc_now()
        self.projects[project.id] = project
        return self._with_default_review(project)

    def _source_count(self, project: Project) -> int:
        if project.opportunity_audience and project.opportunity_audience.source_mode == "existing":
            if project.opportunity_audience.opportunity_id:
                return len(
                    self.opportunity_repo.get_opportunity(
                        project.opportunity_audience.opportunity_id,
                    ).source_list
                )
        if project.extraction_id:
            return 1
        return len(SOURCES)

    def _extraction_confirmed(self, project: Project) -> bool:
        if not project.extraction_id:
            return project.opportunity_audience is not None and project.opportunity_audience.source_mode == "existing"
        extraction = self.extractions.get(project.extraction_id)
        if not extraction:
            return False
        return all(field.metadata.confirmed for field in extraction.fields if field.metadata.required)

    def _with_default_review(self, project: Project) -> Project:
        if project.review_setup is None:
            output_count = len(project.opportunity_audience.selected_outputs) if project.opportunity_audience else 0
            project.review_setup = default_review_setup(
                self._source_count(project),
                self._extraction_confirmed(project),
                output_count,
            )
        return project


opportunity_repository = InMemoryOpportunityRepository()
audience_repository = InMemoryAudienceRepository()
generation_store = InMemoryGenerationStore()
case_repository = InMemoryCaseRepository(
    opportunity_repository,
    audience_repository,
    generation_store,
)
