from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.generation import FindingUpdate, GenerateRequest, GeneratedSection, GenerationResult
from app.repositories.memory import case_repository, generation_store
from app.services.generation import get_generation_backend

router = APIRouter(prefix="/api", tags=["generation"])


@router.post("/projects/{project_id}/generate")
async def generate(project_id: str, request: GenerateRequest) -> GenerationResult:
    if request.simulate_error:
        raise HTTPException(
            status_code=500,
            detail="Mock generation failed in controlled test mode.",
        )

    project = case_repository.get_project(project_id)
    backend = get_generation_backend()
    try:
        result = await backend.generate(project)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Generation backend is not configured.") from error

    GenerationResult.model_validate(result.model_dump(by_alias=True))
    case_repository.save_generation(project_id, result)
    return result


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
        raise HTTPException(status_code=503, detail="Generation backend is not configured.") from error

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
