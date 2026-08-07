from __future__ import annotations

import hashlib
import re
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from ..models.base import CitationRef
from ..models.memory import AffectedOutput, ProjectUpdate, ProjectUpdateType, UpdateCandidate
from ..models.project import OutputType, Project
from ..repositories.memory import utc_now


class ProjectUpdateProcessor:
    max_upload_bytes = 25 * 1024 * 1024

    def build_update(
        self,
        project: Project,
        update_type: ProjectUpdateType,
        source_label: str,
        raw_text: str,
    ) -> ProjectUpdate:
        text = self._clean_text(raw_text)
        if len(text) < 20:
            raise ValueError("Project update must include at least 20 characters of readable text.")

        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:10]
        update_id = f"upd-{project.id}-{digest}-{uuid4().hex[:6]}"
        citations = [
            CitationRef(
                sourceId=update_id,
                label=source_label,
                locator="update note",
                excerpt=self._trim(text, 420),
            )
        ]
        return ProjectUpdate(
            id=update_id,
            projectId=project.id,
            updateType=update_type,
            sourceLabel=source_label,
            rawText=text,
            summary=self._summary(text),
            status="pending_review",
            extractedFacts=self._extract_facts(update_id, source_label, text, citations),
            openQuestions=self._extract_questions(update_id, source_label, text, citations),
            affectedOutputs=self._affected_outputs(project, text),
            createdAt=utc_now(),
            approvedAt=None,
        )

    def text_from_upload(self, content: bytes, source_label: str) -> str:
        if len(content) > self.max_upload_bytes:
            raise ValueError("File exceeds the 25 MB MVP project-update limit.")

        suffix = Path(source_label).suffix.lower()
        if suffix == ".pdf" or content.startswith(b"%PDF"):
            return self._text_from_pdf(content)
        if suffix in {"", ".txt", ".md", ".markdown"}:
            return content.decode("utf-8", errors="replace")
        raise ValueError("Project updates currently support plain text, markdown, and text-layer PDF uploads.")

    def _extract_facts(
        self,
        update_id: str,
        source_label: str,
        text: str,
        citations: list[CitationRef],
    ) -> list[UpdateCandidate]:
        candidates = []
        for index, sentence in enumerate(self._candidate_sentences(text)):
            if self._is_open_question(sentence):
                continue
            if not self._looks_like_fact(sentence):
                continue
            category, label = self._category(sentence)
            candidates.append(
                UpdateCandidate(
                    id=f"{update_id}-fact-{index + 1}",
                    category=category,
                    label=label,
                    value=self._trim(sentence, 360),
                    confidence=0.72,
                    sourceReference=f"{source_label} update note",
                    citations=citations,
                )
            )
            if len(candidates) >= 8:
                break

        if candidates:
            return candidates
        return [
            UpdateCandidate(
                id=f"{update_id}-fact-1",
                category="project_context",
                label="Project update context",
                value=self._trim(text, 360),
                confidence=0.55,
                sourceReference=f"{source_label} update note",
                citations=citations,
            )
        ]

    def _extract_questions(
        self,
        update_id: str,
        source_label: str,
        text: str,
        citations: list[CitationRef],
    ) -> list[UpdateCandidate]:
        questions = []
        for index, sentence in enumerate(self._candidate_sentences(text)):
            if not self._is_open_question(sentence):
                continue
            category, label = self._category(sentence)
            questions.append(
                UpdateCandidate(
                    id=f"{update_id}-question-{index + 1}",
                    category=f"open_{category}",
                    label=f"Open question: {label.lower()}",
                    value=self._trim(sentence, 320),
                    confidence=0.68,
                    sourceReference=f"{source_label} update note",
                    citations=citations,
                )
            )
            if len(questions) >= 6:
                break
        return questions

    def _affected_outputs(self, project: Project, text: str) -> list[AffectedOutput]:
        selected = project.opportunity_audience.selected_outputs if project.opportunity_audience else []
        outputs = selected or ["investment_case", "one_page", "talking_points", "source_appendix"]
        lower = text.lower()
        reasons = {
            "investment_case": "New project evidence may change the investment narrative or diligence section.",
            "one_page": "New facts may change the concise opportunity summary.",
            "talking_points": "Meeting or stakeholder context may change the conversation guide.",
            "source_appendix": "A new approved update should be reflected in the evidence package.",
        }
        affected: list[AffectedOutput] = []
        for output in outputs:
            should_mark = output == "source_appendix"
            should_mark = should_mark or output == "investment_case" and self._has_any(lower, ("funding", "recipient", "vehicle", "risk", "timeline", "partner"))
            should_mark = should_mark or output == "one_page" and self._has_any(lower, ("summary", "beneficiary", "reach", "outcome", "geograph", "funding"))
            should_mark = should_mark or output == "talking_points" and self._has_any(lower, ("meeting", "donor", "stakeholder", "ask", "follow up", "conversation"))
            if should_mark:
                affected.append(
                    AffectedOutput(
                        outputType=output,
                        reason=reasons[output],
                        status="needs_refresh",
                    )
                )
        if affected:
            return affected
        return [
            AffectedOutput(
                outputType=outputs[0],
                reason="The update adds project context that should be reviewed against the current output.",
                status="optional",
            )
        ]

    def _text_from_pdf(self, content: bytes) -> str:
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise ValueError("PDF project updates require the pypdf backend dependency.") from error

        try:
            reader = PdfReader(BytesIO(content))
        except Exception as error:
            raise ValueError("PDF could not be parsed as a text-layer document.") from error

        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        if len(text.strip()) < 20:
            raise ValueError("PDF does not contain enough extractable text.")
        return text

    def _summary(self, text: str) -> str:
        sentences = self._candidate_sentences(text)
        if not sentences:
            return self._trim(text, 160)
        return self._trim(sentences[0], 160)

    def _candidate_sentences(self, text: str) -> list[str]:
        normalized = re.sub(r"\s+", " ", text).strip()
        parts = re.split(r"(?<=[.!?])\s+|(?:\s+-\s+)|(?:\s+•\s+)", normalized)
        return [self._trim(part, 500) for part in parts if len(part.strip()) >= 12]

    def _looks_like_fact(self, sentence: str) -> bool:
        lower = sentence.lower()
        if self._has_any(lower, ("maybe", "might", "could", "possibly", "unclear", "unknown")):
            return False
        return self._has_any(
            lower,
            (
                "confirmed",
                "will",
                "is ",
                "are ",
                "has ",
                "have ",
                "partner",
                "donor",
                "funding",
                "recipient",
                "vehicle",
                "timeline",
                "budget",
                "risk",
                "beneficiary",
                "implementation",
                "delivery",
                "interest",
            ),
        )

    def _is_open_question(self, sentence: str) -> bool:
        lower = sentence.lower()
        return sentence.endswith("?") or self._has_any(
            lower,
            (
                "unresolved",
                "tbd",
                "unknown",
                "unclear",
                "not clear",
                "not yet defined",
                "need to confirm",
                "needs confirmation",
                "to be determined",
                "follow up",
            ),
        )

    def _category(self, sentence: str) -> tuple[str, str]:
        lower = sentence.lower()
        if self._has_any(lower, ("funding recipient", "recipient", "investment vehicle", "vehicle", "fund manager", "investment manager")):
            return "capital_pathway", "Capital pathway"
        if self._has_any(lower, ("implement", "delivery partner", "technical team", "partner")):
            return "implementation_roles", "Implementation roles"
        if self._has_any(lower, ("donor", "investor", "audience", "stakeholder")):
            return "audience_context", "Audience context"
        if self._has_any(lower, ("timeline", "timeframe", "deadline", "roadmap", "202")):
            return "timeline", "Timeline"
        if self._has_any(lower, ("budget", "funding", "usd", "$", "cost")):
            return "funding", "Funding"
        if self._has_any(lower, ("risk", "diligence", "dependency")):
            return "risk", "Risk or diligence"
        if self._has_any(lower, ("beneficiary", "reach", "outcome", "impact")):
            return "impact", "Impact"
        return "project_context", "Project context"

    def _clean_text(self, value: str) -> str:
        return re.sub(r"\n{3,}", "\n\n", value.replace("\r\n", "\n")).strip()

    def _trim(self, value: str, limit: int) -> str:
        clean = re.sub(r"\s+", " ", value).strip(" \t\r\n-")
        if len(clean) <= limit:
            return clean
        return f"{clean[: limit - 1].rstrip()}..."

    def _has_any(self, value: str, terms: tuple[str, ...]) -> bool:
        return any(term in value for term in terms)


project_update_processor = ProjectUpdateProcessor()
