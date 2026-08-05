from fastapi import APIRouter

from ..models.audience import AudienceProfile
from ..repositories.memory import audience_repository

router = APIRouter(prefix="/api/audiences", tags=["audiences"])


@router.get("")
def list_audiences() -> list[AudienceProfile]:
    return audience_repository.list_audiences()


@router.get("/{audience_id}")
def get_audience(audience_id: str) -> AudienceProfile:
    return audience_repository.get_audience(audience_id)
