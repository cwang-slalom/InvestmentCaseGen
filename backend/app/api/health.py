from fastapi import APIRouter

from ..services.generation import get_generation_backend

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def api_health() -> dict[str, object]:
    backend_health = await get_generation_backend().health_check()
    return {
        "status": "ok",
        "service": "investmentgen-phase1",
        "backend": backend_health.model_dump(by_alias=True),
    }
