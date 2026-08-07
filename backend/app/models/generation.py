from typing import Literal

from pydantic import Field

from .base import APIModel, CitationRef
from .project import OutputType


class GeneratedSection(APIModel):
    id: str
    type: Literal["narrative", "metric", "opportunity", "team", "diligence", "risk", "engage"]
    heading: str
    body: str
    citations: list[CitationRef] = Field(default_factory=list)


class GeneratedOutput(APIModel):
    id: str
    type: OutputType
    title: str
    status: str
    sections: list[GeneratedSection]


class InformationNeeded(APIModel):
    id: str
    message: str
    related_section: str = Field(alias="relatedSection")


class ReviewFinding(APIModel):
    id: str
    severity: Literal["blocking", "warning", "editorial"]
    type: str
    message: str
    resolved: bool = False


class GenerationResult(APIModel):
    generation_id: str = Field(alias="generationId")
    project_id: str = Field(alias="projectId")
    status: Literal["completed", "needs_information", "failed"]
    outputs: list[GeneratedOutput]
    information_needed: list[InformationNeeded] = Field(
        default_factory=list,
        alias="informationNeeded",
    )
    review_findings: list[ReviewFinding] = Field(
        default_factory=list,
        alias="reviewFindings",
    )
    metadata: dict[str, str] = Field(default_factory=dict)


class GenerationJobStatus(APIModel):
    project_id: str = Field(alias="projectId")
    state: Literal["idle", "running", "completed", "failed", "canceled"]
    generation_id: str | None = Field(default=None, alias="generationId")
    message: str
    error: str | None = None
    result: GenerationResult | None = None


class GenerateRequest(APIModel):
    simulate_error: bool = Field(default=False, alias="simulateError")


class ExportDraftRequest(APIModel):
    output: GeneratedOutput
    information_needed: list[InformationNeeded] = Field(default_factory=list, alias="informationNeeded")
    review_findings: list[ReviewFinding] = Field(default_factory=list, alias="reviewFindings")
    metadata: dict[str, str] = Field(default_factory=dict)


class FindingUpdate(APIModel):
    resolved: bool
