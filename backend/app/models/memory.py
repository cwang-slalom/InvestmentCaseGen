from typing import Literal

from pydantic import Field

from .base import APIModel, CitationRef


OutputType = Literal[
    "investment_case",
    "one_page",
    "talking_points",
    "source_appendix",
]


ProjectUpdateType = Literal[
    "meeting_notes",
    "document_upload",
    "stakeholder_feedback",
    "manual_note",
]

ProjectUpdateStatus = Literal["pending_review", "approved", "rejected"]
MemoryItemStatus = Literal["proposed", "approved", "deprecated"]
ArtifactVersionStatus = Literal["current", "needs_refresh", "superseded"]


class UpdateCandidate(APIModel):
    id: str
    category: str
    label: str
    value: str
    confidence: float
    source_reference: str = Field(alias="sourceReference")
    citations: list[CitationRef] = Field(default_factory=list)


class AffectedOutput(APIModel):
    output_type: OutputType = Field(alias="outputType")
    reason: str
    status: Literal["needs_refresh", "optional"] = "needs_refresh"


class ProjectUpdate(APIModel):
    id: str
    project_id: str = Field(alias="projectId")
    update_type: ProjectUpdateType = Field(alias="updateType")
    source_label: str = Field(alias="sourceLabel")
    raw_text: str = Field(alias="rawText")
    summary: str
    status: ProjectUpdateStatus
    extracted_facts: list[UpdateCandidate] = Field(alias="extractedFacts")
    open_questions: list[UpdateCandidate] = Field(alias="openQuestions")
    affected_outputs: list[AffectedOutput] = Field(alias="affectedOutputs")
    created_at: str = Field(alias="createdAt")
    approved_at: str | None = Field(default=None, alias="approvedAt")


class ProjectUpdateCreate(APIModel):
    update_type: ProjectUpdateType = Field(default="meeting_notes", alias="updateType")
    source_label: str | None = Field(default=None, alias="sourceLabel")
    text: str


class ProjectUpdateReview(APIModel):
    approved_fact_ids: list[str] = Field(default_factory=list, alias="approvedFactIds")
    approved_question_ids: list[str] = Field(default_factory=list, alias="approvedQuestionIds")


class ProjectUpdateRefreshRequest(APIModel):
    selected_outputs: list[OutputType] = Field(default_factory=list, alias="selectedOutputs")


class ProjectUpdateRefreshResult(APIModel):
    update: ProjectUpdate
    generation_id: str = Field(alias="generationId")


class ProjectMemoryItem(APIModel):
    id: str
    project_id: str = Field(alias="projectId")
    category: str
    label: str
    value: str
    source_update_id: str = Field(alias="sourceUpdateId")
    source_reference: str = Field(alias="sourceReference")
    status: MemoryItemStatus
    citations: list[CitationRef] = Field(default_factory=list)
    created_at: str = Field(alias="createdAt")
    approved_at: str | None = Field(default=None, alias="approvedAt")


class ArtifactVersion(APIModel):
    id: str
    project_id: str = Field(alias="projectId")
    output_id: str = Field(alias="outputId")
    output_type: OutputType = Field(alias="outputType")
    title: str
    version: int
    status: ArtifactVersionStatus
    generation_id: str = Field(alias="generationId")
    created_from_update_id: str | None = Field(default=None, alias="createdFromUpdateId")
    created_at: str = Field(alias="createdAt")


class ProjectMemorySummary(APIModel):
    update_count: int = Field(alias="updateCount")
    pending_update_count: int = Field(alias="pendingUpdateCount")
    approved_memory_count: int = Field(alias="approvedMemoryCount")
    needs_refresh_count: int = Field(alias="needsRefreshCount")
