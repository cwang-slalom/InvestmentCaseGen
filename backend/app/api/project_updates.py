from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..models.generation import GeneratedOutput, GenerationResult
from ..models.memory import (
    ArtifactVersion,
    ArtifactVersionSaveRequest,
    ProjectMemoryItem,
    ProjectUpdate,
    ProjectUpdateCreate,
    ProjectUpdateRefreshRequest,
    ProjectUpdateRefreshResult,
    ProjectUpdateReview,
    ProjectUpdateType,
)
from ..repositories.memory import case_repository
from ..services.generation import get_generation_backend
from ..services.project_updates import project_update_processor

router = APIRouter(prefix="/api/projects", tags=["project-updates"])


@router.get("/{project_id}/updates")
def list_project_updates(project_id: str) -> list[ProjectUpdate]:
    return case_repository.list_project_updates(project_id)


@router.post("/{project_id}/updates")
async def create_project_update(project_id: str, request: Request) -> ProjectUpdate:
    project = case_repository.get_project(project_id)
    content_type = request.headers.get("content-type", "")

    try:
        if "application/json" in content_type:
            payload = ProjectUpdateCreate.model_validate(await request.json())
            source_label = payload.source_label or update_type_label(payload.update_type)
            update = project_update_processor.build_update(
                project,
                payload.update_type,
                source_label,
                payload.text,
            )
        else:
            filename = request.query_params.get("filename") or "uploaded-update.txt"
            update_type = parse_update_type(request.query_params.get("updateType"))
            content = await request.body()
            if not content:
                raise ValueError("Provide meeting notes, stakeholder feedback, or an update file.")
            text = project_update_processor.text_from_upload(content, filename)
            update = project_update_processor.build_update(project, update_type, filename, text)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return case_repository.save_project_update(update)


@router.put("/{project_id}/updates/{update_id}/review")
def review_project_update(
    project_id: str,
    update_id: str,
    request: ProjectUpdateReview,
) -> ProjectUpdate:
    return case_repository.approve_project_update(project_id, update_id, request)


@router.get("/{project_id}/memory")
def list_project_memory(project_id: str) -> list[ProjectMemoryItem]:
    return case_repository.list_project_memory(project_id)


@router.get("/{project_id}/artifact-versions")
def list_artifact_versions(project_id: str) -> list[ArtifactVersion]:
    return case_repository.list_artifact_versions(project_id)


@router.post("/{project_id}/artifact-versions")
def save_artifact_version(
    project_id: str,
    request: ArtifactVersionSaveRequest,
) -> ArtifactVersion:
    output = GeneratedOutput.model_validate(request.output)
    return case_repository.save_artifact_version(project_id, request.generation_id, output)


@router.post("/{project_id}/updates/{update_id}/refresh")
async def refresh_outputs_from_update(
    project_id: str,
    update_id: str,
    request: ProjectUpdateRefreshRequest,
) -> ProjectUpdateRefreshResult:
    update = case_repository.get_project_update(project_id, update_id)
    if update.status != "approved":
        raise HTTPException(status_code=400, detail="Approve the project update before refreshing outputs.")

    project = case_repository.get_project(project_id)
    selected_outputs = request.selected_outputs or [
        item.output_type
        for item in update.affected_outputs
        if item.status == "needs_refresh"
    ]
    if not selected_outputs:
        raise HTTPException(status_code=400, detail="Select at least one output to refresh.")

    if project.opportunity_audience:
        project = project.model_copy(deep=True)
        project.opportunity_audience = project.opportunity_audience.model_copy(
            update={"selected_outputs": selected_outputs},
        )

    backend = get_generation_backend()
    backend_health = await backend.health_check()
    if backend_health.status != "ok":
        raise HTTPException(status_code=503, detail=backend_health.message)

    try:
        generation = await backend.generate(project)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=str(error) or "Generation backend is not configured.",
        ) from error

    GenerationResult.model_validate(generation.model_dump(by_alias=True))
    case_repository.save_generation(project_id, generation, created_from_update_id=update.id)
    return ProjectUpdateRefreshResult(update=update, generationId=generation.generation_id)


def parse_update_type(value: str | None) -> ProjectUpdateType:
    allowed: set[ProjectUpdateType] = {
        "meeting_notes",
        "document_upload",
        "stakeholder_feedback",
        "manual_note",
    }
    if value in allowed:
        return value
    return "document_upload"


def update_type_label(update_type: ProjectUpdateType) -> str:
    labels = {
        "meeting_notes": "Meeting notes",
        "document_upload": "Uploaded project update",
        "stakeholder_feedback": "Stakeholder feedback",
        "manual_note": "Manual project note",
    }
    return labels[update_type]
