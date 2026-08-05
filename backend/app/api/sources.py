from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.extraction import ExtractionResult
from app.repositories.memory import case_repository
from app.services.extraction import source_processor

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.post("/extract")
async def extract_source(request: Request) -> ExtractionResult:
    project_id = request.query_params.get("projectId")
    filename = request.query_params.get("filename")
    source_label = filename or "Pasted synthetic source"
    content_type = request.headers.get("content-type", "")

    try:
        if "application/json" in content_type:
            payload = await request.json()
            source_label = str(payload.get("sourceLabel") or payload.get("knowledgeSourceId") or source_label)
            extraction = await source_processor.extract(source_label, project_id)
        else:
            body = await request.body()
            if not body:
                raise ValueError("Provide a source file, pasted text, or synthetic knowledge-base source.")
            extraction = await source_processor.extract_uploaded_bytes(body, source_label, project_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if project_id:
        case_repository.save_extraction(project_id, extraction)
    return extraction
