from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from ..fixtures import default_extraction
from ..models.base import CitationRef, FieldMetadata
from ..models.extraction import ExtractedField
from ..models.extraction import ExtractionResult
from ..repositories.base import SourceProcessor


@dataclass(frozen=True)
class SourcePage:
    page_number: int
    text: str


@dataclass(frozen=True)
class CandidateText:
    text: str
    page_number: int


@dataclass(frozen=True)
class FieldSpec:
    field_id: str
    label: str
    keywords: tuple[str, ...]
    unresolved: str


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
        ("global", "africa", "asia", "latin america", "country", "countries", "region", "geography", "geographies"),
        "Unresolved geography in uploaded source.",
    ),
    FieldSpec(
        "reach",
        "Reach / Impact",
        ("people", "beneficiaries", "patients", "children", "women", "households", "communities", "reach"),
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
        ("investment manager", "funding recipient", "investment vehicle", "fiscal sponsor", "sponsor", "fund manager"),
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

MONEY_PATTERN = re.compile(
    r"(?:USD\s*)?\$?\s?\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?\s?(?:million|billion|m|bn)?",
    re.IGNORECASE,
)
YEAR_PATTERN = re.compile(r"\b20\d{2}(?:\s?[-–]\s?20\d{2})?\b")


class SourceBackedProcessor(SourceProcessor):
    max_upload_bytes = 25 * 1024 * 1024

    async def extract(self, source_label: str, project_id: str | None) -> ExtractionResult:
        return default_extraction(project_id, source_label)

    async def extract_uploaded_bytes(
        self,
        content: bytes,
        source_label: str,
        project_id: str | None,
    ) -> ExtractionResult:
        if len(content) > self.max_upload_bytes:
            raise ValueError("File exceeds the 25 MB MVP source-processing limit.")

        pages = self._extract_pages(content, source_label)
        return self._build_extraction(source_label, project_id, pages, content)

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

    def _build_extraction(
        self,
        source_label: str,
        project_id: str | None,
        pages: list[SourcePage],
        content: bytes,
    ) -> ExtractionResult:
        candidates = self._candidate_text(pages)
        title = self._title_candidate(source_label, candidates)
        fields = [
            self._field(
                "opportunity_name",
                "Opportunity name",
                title.text,
                0.78,
                source_label,
                title.page_number,
                title.text,
            )
        ]
        for spec in FIELD_SPECS:
            candidate = self._match_candidate(spec, candidates)
            if candidate:
                value = self._trim(candidate.text)
                confidence = 0.76 if spec.field_id not in {"funding_range", "reach", "timeframe"} else 0.82
                fields.append(self._field(spec.field_id, spec.label, value, confidence, source_label, candidate.page_number, candidate.text))
            else:
                fields.append(self._unresolved_field(spec, source_label))

        digest = hashlib.sha256(content).hexdigest()[:10]
        found_count = sum(1 for field in fields if not field.value.lower().startswith("unresolved"))
        return ExtractionResult(
            id=f"extract-{project_id or 'upload'}-{digest}",
            projectId=project_id,
            sourceLabel=source_label,
            temporaryStatus="Phase 1 temporary processing - uploaded content is parsed in memory and not retained after restart",
            confidence=round(found_count / len(fields), 2),
            notes="Text-layer extraction from uploaded source. Fields are parser-derived candidates and require human review before generation is used externally.",
            fields=fields,
        )

    def _candidate_text(self, pages: list[SourcePage]) -> list[CandidateText]:
        candidates: list[CandidateText] = []
        for page in pages:
            clean = re.sub(r"[ \t]+", " ", page.text)
            for raw_line in clean.splitlines():
                line = self._trim(raw_line)
                if line:
                    candidates.append(CandidateText(line, page.page_number))
            paragraph_text = re.sub(r"\s+", " ", clean)
            for sentence in re.split(r"(?<=[.!?])\s+", paragraph_text):
                sentence = self._trim(sentence)
                if len(sentence) >= 35:
                    candidates.append(CandidateText(sentence, page.page_number))
        return candidates

    def _title_candidate(self, source_label: str, candidates: list[CandidateText]) -> CandidateText:
        ignored = {"table of contents", "contents", "executive summary", "introduction"}
        for candidate in candidates[:30]:
            text = candidate.text.strip(":- ")
            word_count = len(text.split())
            if 2 <= word_count <= 14 and len(text) <= 100 and text.lower() not in ignored:
                return CandidateText(text, candidate.page_number)
        fallback = Path(source_label).stem.replace("-", " ").replace("_", " ").strip().title()
        return CandidateText(fallback or "Uploaded Opportunity", 1)

    def _match_candidate(self, spec: FieldSpec, candidates: list[CandidateText]) -> CandidateText | None:
        if spec.field_id == "funding_range":
            return self._match_pattern(candidates, MONEY_PATTERN, spec.keywords)
        if spec.field_id == "timeframe":
            return self._match_pattern(candidates, YEAR_PATTERN, spec.keywords)
        for candidate in candidates:
            lower = candidate.text.lower()
            if any(keyword in lower for keyword in spec.keywords):
                return candidate
        return None

    def _match_pattern(
        self,
        candidates: list[CandidateText],
        pattern: re.Pattern[str],
        keywords: tuple[str, ...],
    ) -> CandidateText | None:
        for candidate in candidates:
            lower = candidate.text.lower()
            if pattern.search(candidate.text) and any(keyword in lower for keyword in keywords):
                return candidate
        for candidate in candidates:
            if pattern.search(candidate.text):
                return candidate
        return None

    def _field(
        self,
        field_id: str,
        label: str,
        value: str,
        confidence: float,
        source_label: str,
        page_number: int,
        excerpt: str,
    ) -> ExtractedField:
        locator = f"p. {page_number}"
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

    def _unresolved_field(self, spec: FieldSpec, source_label: str) -> ExtractedField:
        return ExtractedField(
            id=spec.field_id,
            label=spec.label,
            value=spec.unresolved,
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

    def _trim(self, value: str, limit: int = 500) -> str:
        clean = re.sub(r"\s+", " ", value).strip(" \t\r\n-•")
        if len(clean) <= limit:
            return clean
        return f"{clean[: limit - 1].rstrip()}..."


source_processor = SourceBackedProcessor()
