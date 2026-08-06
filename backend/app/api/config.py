from fastapi import APIRouter

from ..fixtures import DEMO_NOTICE, SOURCES
from ..services.extraction import source_processor
from ..services.generation import get_generation_backend

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config() -> dict[str, object]:
    backend_health = await get_generation_backend().health_check()
    mode = (
        "live"
        if backend_health.status == "ok"
        and backend_health.provider != "mock-generation-backend"
        else "mock"
    )
    return {
        "appName": "Investment Case Generator",
        "phase": "Phase 1",
        "mode": mode,
        "demoNotice": DEMO_NOTICE,
        "externalWebSearchEnabled": False,
        "maxUploadMb": source_processor.max_upload_bytes // (1024 * 1024),
        "backend": backend_health.model_dump(by_alias=True),
        "knowledgeSources": [source.model_dump(by_alias=True) for source in SOURCES],
    }
