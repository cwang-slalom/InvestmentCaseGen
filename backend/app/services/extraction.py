from __future__ import annotations

import asyncio
import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Callable, Literal

from fastapi import HTTPException
from pydantic import Field

from ..ai import LiveModelProvider, StructuredGenerationRequest
from ..config import get_settings
from ..fixtures import SOURCES
from ..models.base import APIModel, CitationRef, FieldMetadata
from ..models.extraction import ExtractedField
from ..models.extraction import ExtractionResult
from ..prompts import load_operation_prompt
from ..repositories.base import SourceProcessor


@dataclass(frozen=True)
class SourcePage:
    page_number: int
    text: str


@dataclass(frozen=True)
class FieldSpec:
    field_id: str
    label: str
    keywords: tuple[str, ...]
    unresolved: str


@dataclass(frozen=True)
class TemporarySource:
    source_label: str
    pages: list[SourcePage]
    digest: str


ExtractionFieldId = Literal[
    "opportunity_name",
    "problem",
    "solution",
    "why_now",
    "geographies",
    "reach",
    "primary_outcomes",
    "differentiators",
    "timeframe",
    "funding_range",
    "investment_team",
    "technical_team",
    "diligence",
]


class ModelExtractedField(APIModel):
    id: ExtractionFieldId
    value: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_status: Literal["source_provided", "unresolved"] = Field(
        alias="evidenceStatus",
    )
    page_number: int | None = Field(default=None, alias="pageNumber")
    excerpt: str = ""


class ModelExtractionOutput(APIModel):
    selected_opportunity: str = Field(alias="selectedOpportunity", min_length=1)
    selection_rationale: str = Field(alias="selectionRationale", min_length=1)
    notes: str = ""
    fields: list[ModelExtractedField] = Field(min_length=1)


class ExtractionModelError(RuntimeError):
    pass


class TemporarySourceUnavailable(ValueError):
    pass


OPPORTUNITY_NAME_SPEC = FieldSpec(
    "opportunity_name",
    "Opportunity name",
    ("opportunity", "spotlight", "concept", "initiative", "fund"),
    "Unresolved opportunity name in uploaded source.",
)


FIELD_SPECS = [
    FieldSpec(
        "problem",
        "Problem",
        ("problem", "challenge", "barrier", "constraint", "gap", "need", "burden"),
        "Unresolved problem statement in uploaded source.",
    ),
    FieldSpec(
        "solution",
        "Solution",
        ("solution", "approach", "intervention", "platform", "program", "initiative", "model"),
        "Unresolved proposed solution in uploaded source.",
    ),
    FieldSpec(
        "why_now",
        "Why now",
        ("why now", "urgent", "urgency", "window", "timely", "momentum", "now"),
        "Unresolved timing rationale in uploaded source.",
    ),
    FieldSpec(
        "geographies",
        "Geographies",
        (
            "global",
            "africa",
            "asia",
            "latin america",
            "country",
            "countries",
            "region",
            "geography",
            "geographies",
        ),
        "Unresolved geography in uploaded source.",
    ),
    FieldSpec(
        "reach",
        "Reach / Impact",
        (
            "people",
            "beneficiaries",
            "patients",
            "children",
            "women",
            "households",
            "communities",
            "reach",
        ),
        "Unresolved reach or impact figure in uploaded source.",
    ),
    FieldSpec(
        "primary_outcomes",
        "Primary outcomes",
        ("outcome", "outcomes", "impact", "objective", "goal", "result", "results"),
        "Unresolved outcomes in uploaded source.",
    ),
    FieldSpec(
        "differentiators",
        "Key differentiators",
        ("differentiat", "unique", "advantage", "innovative", "novel", "why this", "comparative"),
        "Unresolved differentiators in uploaded source.",
    ),
    FieldSpec(
        "timeframe",
        "Timeframe",
        ("timeline", "timeframe", "year", "years", "phase", "202", "203"),
        "Unresolved timeframe in uploaded source.",
    ),
    FieldSpec(
        "funding_range",
        "Funding range",
        ("usd", "$", "funding", "budget", "cost", "investment", "capital"),
        "Unresolved funding range in uploaded source.",
    ),
    FieldSpec(
        "investment_team",
        "Investment team",
        (
            "investment manager",
            "funding recipient",
            "investment vehicle",
            "fiscal sponsor",
            "sponsor",
            "fund manager",
        ),
        "Unresolved investment manager, funding recipient, and investment vehicle in uploaded source.",
    ),
    FieldSpec(
        "technical_team",
        "Technical team",
        ("technical team", "implementation", "implementing", "delivery partner", "partner", "team"),
        "Unresolved implementation or technical team in uploaded source.",
    ),
    FieldSpec(
        "diligence",
        "Diligence information",
        ("diligence", "risk", "risks", "assumption", "unknown", "unresolved", "open question", "requires"),
        "Open diligence items are unresolved in uploaded source.",
    ),
]

ALL_FIELD_SPECS = [OPPORTUNITY_NAME_SPEC, *FIELD_SPECS]


class SourceBackedProcessor(SourceProcessor):
    max_upload_bytes = 25 * 1024 * 1024
    max_model_input_chars = 120_000

    def __init__(
        self,
        provider_factory: Callable[[], LiveModelProvider] | None = None,
    ):
        self._provider_factory = provider_factory or self._default_provider
        self._temporary_sources: dict[str, TemporarySource] = {}

    async def extract(self, source_label: str, project_id: str | None) -> ExtractionResult:
        if project_id and project_id in self._temporary_sources:
            return await self.rerun_project_extraction(project_id)
        raise ValueError("Live LLM extraction requires uploaded source content or pasted source text.")

    async def extract_text(
        self,
        text: str,
        source_label: str,
        project_id: str | None,
    ) -> ExtractionResult:
        content = text.encode("utf-8")
        page_text = self._decode_text(content)
        pages = [SourcePage(page_number=1, text=page_text)]
        digest = hashlib.sha256(content).hexdigest()[:10]
        self._cache_temporary_source(project_id, source_label, pages, digest)
        return await self._build_extraction(source_label, project_id, pages, digest)

    async def extract_knowledge_source(
        self,
        knowledge_source_id: str,
        source_label: str,
        project_id: str | None,
    ) -> ExtractionResult:
        matched_sources = [
            source
            for source in SOURCES
            if source.id == knowledge_source_id or source.title == source_label
        ]
        if not matched_sources:
            raise ValueError("Selected knowledge-base source was not found.")

        source_text = "\n\n".join(
            "\n".join(
                [
                    f"Title: {source.title}",
                    f"Type: {source.source_type}",
                    f"Label: {source.label}",
                    f"Locator: {source.locator}",
                    f"Status: {source.status}",
                    f"Excerpt: {source.excerpt}",
                ]
            )
            for source in matched_sources
        )
        return await self.extract_text(source_text, source_label, project_id)

    async def extract_uploaded_bytes(
        self,
        content: bytes,
        source_label: str,
        project_id: str | None,
    ) -> ExtractionResult:
        if len(content) > self.max_upload_bytes:
            raise ValueError("File exceeds the 25 MB MVP source-processing limit.")

        pages = self._extract_pages(content, source_label)
        digest = hashlib.sha256(content).hexdigest()[:10]
        self._cache_temporary_source(project_id, source_label, pages, digest)
        return await self._build_extraction(source_label, project_id, pages, digest)

    async def rerun_project_extraction(self, project_id: str) -> ExtractionResult:
        try:
            source = self._temporary_sources[project_id]
        except KeyError as error:
            raise TemporarySourceUnavailable(
                "Temporary source text is no longer available; re-upload the source document to rerun extraction.",
            ) from error
        return await self._build_extraction(
            source.source_label,
            project_id,
            source.pages,
            source.digest,
        )

    def _extract_pages(self, content: bytes, source_label: str) -> list[SourcePage]:
        suffix = Path(source_label).suffix.lower()
        if suffix == ".pdf" or content.startswith(b"%PDF"):
            return self._extract_pdf_pages(content)
        if suffix in {"", ".txt", ".md", ".markdown"}:
            return [SourcePage(page_number=1, text=self._decode_text(content))]
        raise ValueError("Only text-layer PDF and plain-text uploads are supported in this Phase 1 runtime.")

    def _extract_pdf_pages(self, content: bytes) -> list[SourcePage]:
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise ValueError("PDF text extraction requires the pypdf backend dependency.") from error

        try:
            reader = PdfReader(BytesIO(content))
        except Exception as error:
            raise ValueError("PDF could not be parsed as a text-layer document.") from error

        if len(reader.pages) > 150:
            raise ValueError("PDF exceeds the 150-page MVP processing limit.")

        pages = [
            SourcePage(page_number=index + 1, text=page.extract_text() or "")
            for index, page in enumerate(reader.pages)
        ]
        character_count = sum(len(page.text.strip()) for page in pages)
        if character_count < 80:
            raise ValueError("PDF does not contain enough extractable text; scanned or image-only PDFs are not supported.")
        return pages

    def _decode_text(self, content: bytes) -> str:
        text = content.decode("utf-8", errors="replace")
        if len(text.strip()) < 20:
            raise ValueError("Uploaded text source does not contain enough extractable text.")
        return text

    async def _build_extraction(
        self,
        source_label: str,
        project_id: str | None,
        pages: list[SourcePage],
        digest: str,
    ) -> ExtractionResult:
        model_output = await self._model_extract(source_label, pages)
        fields = self._fields_from_model(model_output, source_label, pages)

        found_count = sum(1 for field in fields if not field.value.lower().startswith("unresolved"))
        notes = (
            "LLM extraction from uploaded source text. "
            "Fields are source-grounded candidates and require human review before generation is used externally."
        )
        if model_output.notes:
            notes = f"{notes} Model notes: {self._trim(model_output.notes, limit=320)}"
        return ExtractionResult(
            id=f"extract-{project_id or 'upload'}-{digest}",
            projectId=project_id,
            sourceLabel=source_label,
            temporaryStatus="Phase 1 temporary processing - uploaded text is parsed and retained in memory only for reruns until restart",
            confidence=round(found_count / len(fields), 2),
            notes=notes,
            fields=fields,
        )

    async def _model_extract(
        self,
        source_label: str,
        pages: list[SourcePage],
    ) -> ModelExtractionOutput:
        prompt = load_operation_prompt("extract_opportunities")
        request = StructuredGenerationRequest(
            operation="extract_opportunities",
            promptVersion=prompt.version,
            externalWebSearch=False,
            input={
                "sourceLabel": source_label,
                "sourcePages": self._source_pages_for_model(pages),
                "fieldsToExtract": [
                    {
                        "id": spec.field_id,
                        "label": spec.label,
                        "keywords": list(spec.keywords),
                        "unresolvedValue": spec.unresolved,
                    }
                    for spec in ALL_FIELD_SPECS
                ],
                "currentUserInstructions": (
                    "Extract exactly one investable concept from the uploaded source. "
                    "If the document contains rubrics, front matter, or multiple opportunity spotlights, "
                    "ignore generic rubric criteria and select one concrete opportunity spotlight before filling fields. "
                    "Never infer funding recipient, investment vehicle, investment manager, or implementation roles without direct evidence."
                ),
            },
            jsonSchema=ModelExtractionOutput.model_json_schema(by_alias=True),
            metadata={"promptName": prompt.name, "uiRoute": "/api/sources/extract"},
        )

        try:
            response = await asyncio.to_thread(
                self._provider_factory().generate_structured,
                request,
            )
            return ModelExtractionOutput.model_validate(response.output)
        except HTTPException as error:
            raise ExtractionModelError(str(error.detail)) from error
        except Exception as error:
            raise ExtractionModelError(str(error) or "Live LLM extraction failed.") from error

    def _source_pages_for_model(self, pages: list[SourcePage]) -> list[dict[str, Any]]:
        payload: list[dict[str, Any]] = []
        remaining = self.max_model_input_chars
        for page in pages:
            clean = self._clean_page_text(page.text)
            if not clean:
                continue
            if len(clean) > remaining:
                clean = f"{clean[: max(0, remaining - 1)].rstrip()}..."
            payload.append({"pageNumber": page.page_number, "text": clean})
            remaining -= len(clean)
            if remaining <= 0:
                break
        if not payload:
            raise ValueError("Uploaded source does not contain enough extractable text.")
        return payload

    def _fields_from_model(
        self,
        model_output: ModelExtractionOutput,
        source_label: str,
        pages: list[SourcePage],
    ) -> list[ExtractedField]:
        model_fields = {field.id: field for field in model_output.fields}
        fields: list[ExtractedField] = []
        for spec in ALL_FIELD_SPECS:
            model_field = model_fields.get(spec.field_id)
            if not model_field or self._is_unresolved(model_field):
                unresolved_value = (
                    self._trim(model_field.value)
                    if model_field and model_field.value.lower().startswith("unresolved")
                    else spec.unresolved
                )
                fields.append(self._unresolved_field(spec, source_label, unresolved_value))
                continue

            page_number = self._valid_page_number(model_field.page_number, pages)
            excerpt = self._trim(
                model_field.excerpt
                or self._excerpt_from_page(page_number, pages, model_field.value)
                or model_field.value,
                limit=420,
            )
            fields.append(
                self._field(
                    spec.field_id,
                    spec.label,
                    self._trim(model_field.value),
                    model_field.confidence,
                    source_label,
                    page_number,
                    excerpt,
                )
            )
        return fields

    def _is_unresolved(self, field: ModelExtractedField) -> bool:
        return (
            field.evidence_status == "unresolved"
            or field.value.strip().lower().startswith("unresolved")
        )

    def _field(
        self,
        field_id: str,
        label: str,
        value: str,
        confidence: float,
        source_label: str,
        page_number: int | None,
        excerpt: str,
    ) -> ExtractedField:
        locator = f"p. {page_number}" if page_number else "uploaded source"
        return ExtractedField(
            id=field_id,
            label=label,
            value=value,
            confidence=confidence,
            sourceLabel=source_label,
            locator=locator,
            metadata=FieldMetadata(
                source="extracted_source",
                required=True,
                editable=True,
                confirmed=False,
                confidence=confidence,
                citations=[
                    CitationRef(
                        sourceId=f"src-upload-{field_id}",
                        label=source_label,
                        locator=locator,
                        excerpt=self._trim(excerpt, limit=420),
                    )
                ],
            ),
        )

    def _unresolved_field(
        self,
        spec: FieldSpec,
        source_label: str,
        value: str | None = None,
    ) -> ExtractedField:
        return ExtractedField(
            id=spec.field_id,
            label=spec.label,
            value=self._trim(value or spec.unresolved),
            confidence=0.32,
            sourceLabel=source_label,
            locator="unresolved",
            metadata=FieldMetadata(
                source="extracted_source",
                required=True,
                editable=True,
                confirmed=False,
                confidence=0.32,
                citations=[],
            ),
        )

    def _valid_page_number(
        self,
        page_number: int | None,
        pages: list[SourcePage],
    ) -> int | None:
        if page_number is None:
            return None
        page_numbers = {page.page_number for page in pages}
        return page_number if page_number in page_numbers else None

    def _excerpt_from_page(
        self,
        page_number: int | None,
        pages: list[SourcePage],
        value: str,
    ) -> str:
        if page_number is None:
            return ""
        page = next((item for item in pages if item.page_number == page_number), None)
        if not page:
            return ""
        clean_page = self._clean_page_text(page.text)
        normalized_value = re.sub(r"\s+", " ", value).strip()
        if not normalized_value:
            return self._trim(clean_page, limit=420)
        index = re.sub(r"\s+", " ", clean_page).lower().find(normalized_value.lower())
        if index < 0:
            return self._trim(clean_page, limit=420)
        start = max(0, index - 140)
        end = min(len(clean_page), index + len(normalized_value) + 140)
        return self._trim(clean_page[start:end], limit=420)

    def _clean_page_text(self, value: str) -> str:
        lines = [
            re.sub(r"[ \t]+", " ", line).strip()
            for line in value.splitlines()
        ]
        return "\n".join(line for line in lines if line)

    def _cache_temporary_source(
        self,
        project_id: str | None,
        source_label: str,
        pages: list[SourcePage],
        digest: str,
    ) -> None:
        if not project_id:
            return
        self._temporary_sources[project_id] = TemporarySource(
            source_label=source_label,
            pages=pages,
            digest=digest,
        )

    def _default_provider(self) -> LiveModelProvider:
        from ..ai import get_model_provider

        return get_model_provider(get_settings())

    def _trim(self, value: str, limit: int = 500) -> str:
        clean = re.sub(r"\s+", " ", value).strip(" \t\r\n-•")
        if len(clean) <= limit:
            return clean
        return f"{clean[: limit - 1].rstrip()}..."


source_processor = SourceBackedProcessor()
