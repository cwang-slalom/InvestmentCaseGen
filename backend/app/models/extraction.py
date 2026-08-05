from pydantic import Field

from .base import APIModel, FieldMetadata


class ExtractedField(APIModel):
    id: str
    label: str
    value: str
    confidence: float
    source_label: str = Field(alias="sourceLabel")
    locator: str
    metadata: FieldMetadata
    verified: bool = False
    locked: bool = False


class ExtractionResult(APIModel):
    id: str
    project_id: str | None = Field(default=None, alias="projectId")
    source_label: str = Field(alias="sourceLabel")
    temporary_status: str = Field(alias="temporaryStatus")
    confidence: float
    notes: str
    fields: list[ExtractedField]


class ExtractionReviewUpdate(APIModel):
    fields: list[ExtractedField]
    confirmed: bool
