from typing import Literal

from pydantic import Field

from .base import APIModel, FieldValue


OutputType = Literal[
    "investment_case",
    "one_page",
    "talking_points",
    "source_appendix",
]


class TaskUpdate(APIModel):
    selected_task_id: str | None = Field(default=None, alias="selectedTaskId")
    task_label: str | None = Field(default=None, alias="taskLabel")
    custom_description: str | None = Field(default=None, alias="customDescription")


class TaskState(TaskUpdate):
    metadata: dict[str, object]


class OpportunityAudienceUpdate(APIModel):
    source_mode: Literal["existing", "new"] = Field(alias="sourceMode")
    opportunity_id: str | None = Field(default=None, alias="opportunityId")
    audience_id: str | None = Field(default=None, alias="audienceId")
    intended_outcome: str | None = Field(default=None, alias="intendedOutcome")
    suggestions: list[FieldValue] = Field(default_factory=list)
    selected_outputs: list[OutputType] = Field(default_factory=list, alias="selectedOutputs")


class OpportunityAudienceState(OpportunityAudienceUpdate):
    custom_opportunity_title: str | None = Field(
        default=None,
        alias="customOpportunityTitle",
    )


class ReviewRole(APIModel):
    id: str
    label: str
    selected: bool
    status: str
    notes: str


class SourceReadiness(APIModel):
    ready: bool
    checks: list[str]
    blocking_issues: list[str] = Field(default_factory=list, alias="blockingIssues")


class ReviewSetupUpdate(APIModel):
    approach_fields: list[FieldValue] = Field(alias="approachFields")
    roles: list[ReviewRole]
    confirmed: bool


class ReviewSetupState(ReviewSetupUpdate):
    source_readiness: SourceReadiness = Field(alias="sourceReadiness")


class Project(APIModel):
    id: str
    name: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    demo_notice: str = Field(alias="demoNotice")
    task: TaskState | None = None
    opportunity_audience: OpportunityAudienceState | None = Field(
        default=None,
        alias="opportunityAudience",
    )
    extraction_id: str | None = Field(default=None, alias="extractionId")
    review_setup: ReviewSetupState | None = Field(default=None, alias="reviewSetup")
    generation_id: str | None = Field(default=None, alias="generationId")


class ProjectCreate(APIModel):
    name: str | None = None
