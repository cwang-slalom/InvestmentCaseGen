from pydantic import Field

from .base import APIModel
from .source import SourceDocument


class Opportunity(APIModel):
    id: str
    title: str
    program_area: str = Field(alias="programArea")
    geography: str
    summary: str
    validation_status: str = Field(alias="validationStatus")
    last_updated: str = Field(alias="lastUpdated")
    funding_range: str = Field(alias="fundingRange")
    why_now: str = Field(alias="whyNow")
    reach: str
    primary_outcomes: list[str] = Field(alias="primaryOutcomes")
    differentiators: list[str]
    source_list: list[SourceDocument] = Field(alias="sourceList")
