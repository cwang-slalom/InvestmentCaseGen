from pydantic import Field

from .base import APIModel


class SourceDocument(APIModel):
    id: str
    title: str
    source_type: str = Field(alias="sourceType")
    label: str
    locator: str
    excerpt: str
    status: str
