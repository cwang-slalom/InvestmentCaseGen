from fastapi import APIRouter

from app.models.extraction import ExtractionResult, ExtractionReviewUpdate
from app.models.project import OpportunityAudienceUpdate, Project, ProjectCreate, ReviewSetupUpdate, TaskUpdate
from app.repositories.memory import case_repository

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects() -> list[Project]:
    return case_repository.list_projects()


@router.post("")
def create_project(request: ProjectCreate) -> Project:
    return case_repository.create_project(request)


@router.get("/{project_id}")
def get_project(project_id: str) -> Project:
    return case_repository.get_project(project_id)


@router.get("/{project_id}/extraction")
def get_project_extraction(project_id: str) -> ExtractionResult:
    project = case_repository.get_project(project_id)
    if project.extraction_id is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Extraction not found.")
    return case_repository.get_extraction(project.extraction_id)


@router.put("/{project_id}/task")
def update_task(project_id: str, request: TaskUpdate) -> Project:
    return case_repository.update_task(project_id, request)


@router.put("/{project_id}/opportunity-audience")
def update_opportunity_audience(
    project_id: str,
    request: OpportunityAudienceUpdate,
) -> Project:
    return case_repository.update_opportunity_audience(project_id, request)


@router.put("/{project_id}/extraction-review")
def update_extraction_review(
    project_id: str,
    request: ExtractionReviewUpdate,
) -> Project:
    project = case_repository.get_project(project_id)
    extraction_id = project.extraction_id
    if extraction_id is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Extraction not found.")
    extraction = case_repository.get_extraction(extraction_id)
    updated = extraction.model_copy(update={"fields": request.fields}, deep=True)
    return case_repository.update_extraction(project_id, updated, request.confirmed)


@router.put("/{project_id}/review-setup")
def update_review_setup(project_id: str, request: ReviewSetupUpdate) -> Project:
    return case_repository.update_review_setup(project_id, request)
