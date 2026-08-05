from fastapi import APIRouter

from ..models.opportunity import Opportunity
from ..repositories.memory import opportunity_repository

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])


@router.get("")
def list_opportunities() -> list[Opportunity]:
    return opportunity_repository.list_opportunities()


@router.get("/{opportunity_id}")
def get_opportunity(opportunity_id: str) -> Opportunity:
    return opportunity_repository.get_opportunity(opportunity_id)
