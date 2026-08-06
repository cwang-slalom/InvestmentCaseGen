from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


FieldSource = Literal[
    "user",
    "opportunity",
    "audience_profile",
    "ai_suggestion",
    "system_setup",
    "extracted_source",
]


class CitationRef(APIModel):
    source_id: str = Field(alias="sourceId")
    label: str
    locator: str = ""
    excerpt: str = ""


class FieldMetadata(APIModel):
    source: FieldSource
    required: bool
    editable: bool
    confirmed: bool
    confidence: float | None = None
    citations: list[CitationRef] = Field(default_factory=list)


class FieldValue(APIModel):
    id: str
    label: str
    value: str
    provenance_label: str = Field(alias="provenanceLabel")
    metadata: FieldMetadata


class BackendHealth(APIModel):
    status: Literal["ok", "not_configured", "failed"]
    provider: str
    message: str
