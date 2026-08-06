from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Response

from ..models.generation import (
    ExportDraftRequest,
    FindingUpdate,
    GenerateRequest,
    GeneratedSection,
    GenerationJobStatus,
    GenerationResult,
)
from ..repositories.memory import case_repository, generation_store
from ..services.docx_export import draft_output_to_docx, filename_safe
from ..services.generation import get_generation_backend

router = APIRouter(prefix="/api", tags=["generation"])

_generation_lock = asyncio.Lock()
_generation_tasks: dict[str, asyncio.Task[GenerationResult]] = {}
_generation_errors: dict[str, str] = {}
_generation_cancellations: dict[str, str] = {}


@router.post("/projects/{project_id}/generate")
async def generate(project_id: str, request: GenerateRequest) -> GenerationJobStatus:
    if request.simulate_error:
        raise HTTPException(
            status_code=500,
            detail="Generation failed in controlled test mode.",
        )

    async with _generation_lock:
        project = case_repository.get_project(project_id)
        if project.generation_id:
            return _completed_status(project_id, generation_store.get_generation(project.generation_id))

        task = _generation_tasks.get(project_id)
        if task and not task.done():
            return _running_status(project_id)

        if task and task.done():
            _record_task_error(project_id, task)

        backend = get_generation_backend()
        backend_health = await backend.health_check()
        if backend_health.status != "ok":
            raise HTTPException(status_code=503, detail=backend_health.message)

        _generation_errors.pop(project_id, None)
        _generation_cancellations.pop(project_id, None)
        task = asyncio.create_task(_generate_and_save(project_id, backend))
        task.add_done_callback(lambda completed_task: _record_task_error(project_id, completed_task))
        _generation_tasks[project_id] = task

    return _running_status(project_id)


@router.get("/projects/{project_id}/generation-status")
async def generation_status(project_id: str) -> GenerationJobStatus:
    async with _generation_lock:
        project = case_repository.get_project(project_id)
        if project.generation_id:
            return _completed_status(project_id, generation_store.get_generation(project.generation_id))

        task = _generation_tasks.get(project_id)
        if task and not task.done():
            return _running_status(project_id)

        if task and task.done():
            _record_task_error(project_id, task)

        cancellation = _generation_cancellations.get(project_id)
        if cancellation:
            return _canceled_status(project_id, cancellation)

        error = _generation_errors.get(project_id)
        if error:
            return GenerationJobStatus(
                projectId=project_id,
                state="failed",
                generationId=None,
                message="Generation failed before completion.",
                error=error,
                result=None,
            )

        return GenerationJobStatus(
            projectId=project_id,
            state="idle",
            generationId=None,
            message="No generation is running for this project.",
            error=None,
            result=None,
        )


@router.delete("/projects/{project_id}/generation")
async def cancel_generation(project_id: str) -> GenerationJobStatus:
    async with _generation_lock:
        project = case_repository.get_project(project_id)
        if project.generation_id:
            return _completed_status(project_id, generation_store.get_generation(project.generation_id))

        task = _generation_tasks.pop(project_id, None)
        if task and not task.done():
            task.cancel()
            message = "Generation canceled before completion. No output package was saved."
            _generation_errors.pop(project_id, None)
            _generation_cancellations[project_id] = message
            return _canceled_status(project_id, message)

        if task and task.done():
            _record_task_error(project_id, task)

        cancellation = _generation_cancellations.get(project_id)
        if cancellation:
            return _canceled_status(project_id, cancellation)

        error = _generation_errors.get(project_id)
        if error:
            return GenerationJobStatus(
                projectId=project_id,
                state="failed",
                generationId=None,
                message="Generation failed before completion.",
                error=error,
                result=None,
            )

        return GenerationJobStatus(
            projectId=project_id,
            state="idle",
            generationId=None,
            message="No generation is running for this project.",
            error=None,
            result=None,
        )


def _running_status(project_id: str) -> GenerationJobStatus:
    return GenerationJobStatus(
        projectId=project_id,
        state="running",
        generationId=None,
        message="Generation is running in the background.",
        error=None,
        result=None,
    )


def _completed_status(project_id: str, result: GenerationResult) -> GenerationJobStatus:
    return GenerationJobStatus(
        projectId=project_id,
        state="completed",
        generationId=result.generation_id,
        message="Generation completed.",
        error=None,
        result=result,
    )


def _canceled_status(project_id: str, message: str) -> GenerationJobStatus:
    return GenerationJobStatus(
        projectId=project_id,
        state="canceled",
        generationId=None,
        message=message,
        error=None,
        result=None,
    )


def _record_task_error(project_id: str, task: asyncio.Task[GenerationResult]) -> None:
    if task.cancelled():
        _generation_errors.pop(project_id, None)
        _generation_cancellations[project_id] = "Generation canceled before completion. No output package was saved."
        return
    try:
        task.result()
    except HTTPException as error:
        _generation_cancellations.pop(project_id, None)
        _generation_errors[project_id] = str(error.detail)
    except Exception as error:
        _generation_cancellations.pop(project_id, None)
        _generation_errors[project_id] = str(error) or "Generation backend is not configured."


async def _generate_and_save(project_id: str, backend=None) -> GenerationResult:
    project = case_repository.get_project(project_id)
    generation_backend = backend or get_generation_backend()
    try:
        result = await generation_backend.generate(project)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=str(error) or "Generation backend is not configured.",
        ) from error

    GenerationResult.model_validate(result.model_dump(by_alias=True))
    case_repository.save_generation(project_id, result)
    _generation_errors.pop(project_id, None)
    _generation_cancellations.pop(project_id, None)
    return result


@router.post("/projects/{project_id}/exports/docx", response_model=None)
def export_project_output_docx(project_id: str, request: ExportDraftRequest) -> Response:
    project = case_repository.get_project(project_id)
    buffer = draft_output_to_docx(project, request)
    filename = f"{filename_safe(request.output.title)}.docx"
    return Response(
        content=buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "content-disposition": f'attachment; filename="{filename}"',
            "content-length": str(len(buffer)),
        },
    )


@router.get("/generations/{generation_id}")
def get_generation(generation_id: str) -> GenerationResult:
    return generation_store.get_generation(generation_id)


@router.post("/generations/{generation_id}/sections/{section_id}/regenerate")
async def regenerate_section(generation_id: str, section_id: str) -> GeneratedSection:
    generation = generation_store.get_generation(generation_id)
    project = case_repository.get_project(generation.project_id)
    backend = get_generation_backend()
    try:
        section = await backend.regenerate_section(project, generation, section_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Section not found.") from error
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=str(error) or "Generation backend is not configured.",
        ) from error

    for output_index, output in enumerate(generation.outputs):
        for section_index, existing in enumerate(output.sections):
            if existing.id == section_id:
                generation.outputs[output_index].sections[section_index] = section
                generation_store.save_generation(generation)
                return section
    raise HTTPException(status_code=404, detail="Section not found.")


@router.put("/generations/{generation_id}/findings/{finding_id}")
def update_finding(
    generation_id: str,
    finding_id: str,
    request: FindingUpdate,
) -> GenerationResult:
    generation = generation_store.get_generation(generation_id)
    found = False
    for finding in generation.review_findings:
        if finding.id == finding_id:
            finding.resolved = request.resolved
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Finding not found.")
    generation_store.save_generation(generation)
    return generation
