from __future__ import annotations

from ..fixtures import AUDIENCES, OPPORTUNITIES, generated_example
from ..models.base import BackendHealth, CitationRef
from ..models.extraction import ExtractedField, ExtractionResult
from ..models.generation import GeneratedOutput, GeneratedSection, GenerationResult, InformationNeeded, ReviewFinding
from ..models.opportunity import Opportunity
from ..models.project import Project
from ..repositories.memory import case_repository
from ..services.integrity import protected_fact_tokens

from .base import GenerationBackend


class MockGenerationBackend(GenerationBackend):
    provider_name = "mock-generation-backend"

    async def health_check(self) -> BackendHealth:
        return BackendHealth(
            status="ok",
            provider=self.provider_name,
            message="Mock generation is available without Databricks credentials.",
        )

    async def generate(self, project: Project) -> GenerationResult:
        if project.opportunity_audience and project.opportunity_audience.source_mode == "new" and project.extraction_id:
            extraction = case_repository.extractions.get(project.extraction_id)
            if extraction:
                return self._generate_from_extraction(project, extraction)

        result = generated_example(project.id)
        selected_outputs = (
            project.opportunity_audience.selected_outputs
            if project.opportunity_audience
            else ["investment_case", "one_page", "source_appendix"]
        )
        result.outputs = [
            self._customize_output(output, project)
            for output in result.outputs
            if output.type in selected_outputs
        ]
        result.metadata = {
            **result.metadata,
            "provider": self.provider_name,
            "projectId": project.id,
        }
        return GenerationResult.model_validate(result.model_dump(by_alias=True))

    def _generate_from_extraction(self, project: Project, extraction: ExtractionResult) -> GenerationResult:
        selected_outputs = (
            project.opportunity_audience.selected_outputs
            if project.opportunity_audience
            else ["investment_case", "one_page", "source_appendix"]
        )
        field_map = {field.id: field for field in extraction.fields}
        title = self._field_value(field_map, "opportunity_name", "Uploaded opportunity")
        outputs = [
            output
            for output in [
                self._investment_case_output(title, field_map),
                self._one_page_output(title, field_map),
                self._talking_points_output(title, field_map),
                self._source_appendix_output(title, extraction, field_map),
            ]
            if output.type in selected_outputs
        ]
        unresolved = [field for field in extraction.fields if self._is_unresolved(field.value)]
        information_needed = [
            InformationNeeded(
                id=f"info-{field.id}",
                message=f"{field.label} is unresolved in the uploaded source.",
                relatedSection=field.id,
            )
            for field in unresolved[:8]
        ]
        review_findings = [
            ReviewFinding(
                id="finding-human-review",
                severity="blocking",
                type="source_readiness",
                message="Human review is required before using this output externally.",
                resolved=False,
            )
        ]
        if self._is_unresolved(self._field_value(field_map, "investment_team")):
            review_findings.append(
                ReviewFinding(
                    id="finding-capital-pathway",
                    severity="warning",
                    type="unresolved_role",
                    message="Funding recipient, investment vehicle, or investment manager is not established by the uploaded source.",
                    resolved=False,
                )
            )
        if self._is_unresolved(self._field_value(field_map, "funding_range")):
            review_findings.append(
                ReviewFinding(
                    id="finding-funding-range",
                    severity="warning",
                    type="missing_evidence",
                    message="Funding range or budget evidence is unresolved in the uploaded source.",
                    resolved=False,
                )
            )

        return GenerationResult(
            generationId=f"gen-{project.id}",
            projectId=project.id,
            status="needs_information" if unresolved else "completed",
            outputs=outputs,
            informationNeeded=information_needed,
            reviewFindings=review_findings,
            metadata={
                "mode": "uploaded_source_deterministic",
                "provider": self.provider_name,
                "projectId": project.id,
                "sourceLabel": extraction.source_label,
                "storedPayloadMode": "validated_outputs_only",
                "externalWebSearch": "disabled",
            },
        )

    async def regenerate_section(
        self,
        project: Project,
        generation: GenerationResult,
        section_id: str,
    ) -> GeneratedSection:
        existing = next(
            (
                section
                for output in generation.outputs
                for section in output.sections
                if section.id == section_id
            ),
            None,
        )
        if existing is None:
            raise ValueError("Section not found.")

        locked_line = self._locked_fact_line(project)
        body = (
            f"{existing.body}\n\nRegenerated in mock mode with tighter briefing language. "
            f"{locked_line}"
        ).strip()
        return existing.model_copy(update={"body": body})

    def _customize_output(self, output: GeneratedOutput, project: Project) -> GeneratedOutput:
        opportunity = self._selected_opportunity(project)
        audience_name = self._selected_audience_name(project)
        locked_line = self._locked_fact_line(project)
        sections = [
            section.model_copy(
                update={
                    "body": section.body.replace(
                        "Community Water Reliability Platform",
                        opportunity.title,
                    ).replace(
                        "Riverbend Catalytic Fund",
                        audience_name,
                    )
                    + (f"\n\n{locked_line}" if locked_line and section.type in {"metric", "diligence"} else "")
                }
            )
            for section in output.sections
        ]
        return output.model_copy(update={"sections": sections})

    def _investment_case_output(
        self,
        title: str,
        fields: dict[str, ExtractedField],
    ) -> GeneratedOutput:
        return GeneratedOutput(
            id="out-investment-case",
            type="investment_case",
            title="Investment Case Draft",
            status="Source-grounded draft - human review required",
            sections=[
                GeneratedSection(
                    id="case-exec",
                    type="narrative",
                    heading="Strategic Opportunity",
                    body=(
                        f"{title} is framed from the uploaded source as a draft investment case. "
                        f"Source-supported problem: {self._field_value(fields, 'problem')}. "
                        f"Source-supported solution: {self._field_value(fields, 'solution')}. "
                        f"Why now: {self._field_value(fields, 'why_now')}."
                    ),
                    citations=self._citations(fields, ["opportunity_name", "problem", "solution", "why_now"]),
                ),
                GeneratedSection(
                    id="case-metric",
                    type="metric",
                    heading="Metric Callouts",
                    body=(
                        f"Geography: {self._field_value(fields, 'geographies')}. "
                        f"Reach or impact evidence: {self._field_value(fields, 'reach')}. "
                        f"Timeframe: {self._field_value(fields, 'timeframe')}. "
                        f"Funding or cost evidence: {self._field_value(fields, 'funding_range')}."
                    ),
                    citations=self._citations(fields, ["geographies", "reach", "timeframe", "funding_range"]),
                ),
                GeneratedSection(
                    id="case-team",
                    type="team",
                    heading="Team And Delivery Pathway",
                    body=(
                        f"Implementation or technical team evidence: {self._field_value(fields, 'technical_team')}. "
                        f"Capital pathway evidence: {self._field_value(fields, 'investment_team')}. "
                        "Do not treat a sponsor, concept owner, implementer, investment manager, or funding recipient as the same role unless the source explicitly says so."
                    ),
                    citations=self._citations(fields, ["technical_team", "investment_team"]),
                ),
                GeneratedSection(
                    id="case-diligence",
                    type="diligence",
                    heading="Diligence Priorities",
                    body=(
                        f"Open diligence from the source: {self._field_value(fields, 'diligence')}. "
                        "Before external use, reviewers should confirm unresolved roles, source-supported figures, partner commitments, and any stated timeline."
                    ),
                    citations=self._citations(fields, ["diligence", "funding_range", "timeframe"]),
                ),
                GeneratedSection(
                    id="case-risk",
                    type="risk",
                    heading="Risks And Open Questions",
                    body=(
                        f"Evidence gaps remain wherever fields are marked unresolved. Key differentiators from the source: {self._field_value(fields, 'differentiators')}. "
                        f"Primary outcomes from the source: {self._field_value(fields, 'primary_outcomes')}."
                    ),
                    citations=self._citations(fields, ["differentiators", "primary_outcomes"]),
                ),
                GeneratedSection(
                    id="case-engage",
                    type="engage",
                    heading="Suggested Next Conversation",
                    body=(
                        "Use this as a human-reviewed discussion draft, not a final ask. "
                        "The next conversation should test whether the source-backed concept merits diligence and what missing evidence must be resolved."
                    ),
                    citations=self._citations(fields, ["opportunity_name", "diligence"]),
                ),
            ],
        )

    def _one_page_output(
        self,
        title: str,
        fields: dict[str, ExtractedField],
    ) -> GeneratedOutput:
        return GeneratedOutput(
            id="out-one-page",
            type="one_page",
            title="1-Page Opportunity Summary",
            status="Source-grounded draft - human review required",
            sections=[
                GeneratedSection(
                    id="one-page-summary",
                    type="opportunity",
                    heading="Opportunity Summary",
                    body=(
                        f"{title}. Problem: {self._field_value(fields, 'problem')}. "
                        f"Solution: {self._field_value(fields, 'solution')}. "
                        f"Why now: {self._field_value(fields, 'why_now')}."
                    ),
                    citations=self._citations(fields, ["opportunity_name", "problem", "solution", "why_now"]),
                ),
                GeneratedSection(
                    id="one-page-fit",
                    type="narrative",
                    heading="Evidence To Review",
                    body=(
                        f"Reach: {self._field_value(fields, 'reach')}. "
                        f"Outcomes: {self._field_value(fields, 'primary_outcomes')}. "
                        f"Funding path: {self._field_value(fields, 'investment_team')}."
                    ),
                    citations=self._citations(fields, ["reach", "primary_outcomes", "investment_team"]),
                ),
            ],
        )

    def _talking_points_output(
        self,
        title: str,
        fields: dict[str, ExtractedField],
    ) -> GeneratedOutput:
        return GeneratedOutput(
            id="out-talking-points",
            type="talking_points",
            title="Meeting Talking Points",
            status="Source-grounded draft - human review required",
            sections=[
                GeneratedSection(
                    id="talk-open",
                    type="engage",
                    heading="Opening",
                    body=(
                        f"Open with {title} as a source-backed concept. Anchor the discussion in the documented problem: {self._field_value(fields, 'problem')}."
                    ),
                    citations=self._citations(fields, ["opportunity_name", "problem"]),
                ),
                GeneratedSection(
                    id="talk-questions",
                    type="diligence",
                    heading="Questions To Invite",
                    body=(
                        "What evidence would make this concept diligence-ready? "
                        f"Which unresolved diligence items should be prioritized: {self._field_value(fields, 'diligence')}."
                    ),
                    citations=self._citations(fields, ["diligence"]),
                ),
            ],
        )

    def _source_appendix_output(
        self,
        title: str,
        extraction: ExtractionResult,
        fields: dict[str, ExtractedField],
    ) -> GeneratedOutput:
        cited_fields = [field for field in fields.values() if field.metadata.citations]
        appendix_body = (
            f"{title} was generated from uploaded source '{extraction.source_label}'. "
            f"{len(cited_fields)} extracted fields include direct citation excerpts. "
            "Fields marked unresolved were not inferred."
        )
        return GeneratedOutput(
            id="out-appendix",
            type="source_appendix",
            title="Source Appendix",
            status="Source-grounded draft - human review required",
            sections=[
                GeneratedSection(
                    id="appendix-sources",
                    type="diligence",
                    heading="Source List",
                    body=appendix_body,
                    citations=self._citations(fields, list(fields.keys())),
                ),
                GeneratedSection(
                    id="appendix-boundary",
                    type="risk",
                    heading="Evidence Boundary",
                    body=(
                        "No external web research was performed. The uploaded source is parsed in memory in Phase 1 and is not retained as durable document storage. "
                        "Generated language is a draft requiring human review."
                    ),
                    citations=[],
                ),
            ],
        )

    def _selected_opportunity(self, project: Project) -> Opportunity:
        if project.opportunity_audience and project.opportunity_audience.opportunity_id:
            return next(
                (
                    opportunity
                    for opportunity in OPPORTUNITIES
                    if opportunity.id == project.opportunity_audience.opportunity_id
                ),
                OPPORTUNITIES[0],
            )
        if project.opportunity_audience and project.opportunity_audience.custom_opportunity_title:
            custom = OPPORTUNITIES[0].model_copy()
            custom.id = f"custom-{project.id}"
            custom.title = project.opportunity_audience.custom_opportunity_title
            return custom
        return OPPORTUNITIES[0]

    def _selected_audience_name(self, project: Project) -> str:
        if not project.opportunity_audience or not project.opportunity_audience.audience_id:
            return "the selected audience"
        return next(
            (
                audience.name
                for audience in AUDIENCES
                if audience.id == project.opportunity_audience.audience_id
            ),
            "the selected audience",
        )

    def _locked_fact_line(self, project: Project) -> str:
        if not project.extraction_id:
            return ""
        extraction = case_repository.extractions.get(project.extraction_id)
        if not extraction:
            return ""
        tokens = protected_fact_tokens(extraction.fields)
        if not tokens:
            return ""
        citation = CitationRef(
            sourceId="locked-extraction",
            label=extraction.source_label,
            locator="locked fields",
            excerpt="Synthetic locked extracted fact.",
        )
        # Touch the citation object so Pydantic validates the shape even though the
        # line itself is rendered as text.
        citation.model_dump()
        return f"Locked fact preserved: {', '.join(tokens)}."

    def _field_value(
        self,
        fields: dict[str, ExtractedField],
        field_id: str,
        fallback: str = "Unresolved in uploaded source.",
    ) -> str:
        field = fields.get(field_id)
        if not field or not field.value.strip():
            return fallback
        return field.value.strip()

    def _is_unresolved(self, value: str) -> bool:
        return value.strip().lower().startswith("unresolved")

    def _citations(
        self,
        fields: dict[str, ExtractedField],
        field_ids: list[str],
    ) -> list[CitationRef]:
        citations: list[CitationRef] = []
        seen: set[tuple[str, str]] = set()
        for field_id in field_ids:
            field = fields.get(field_id)
            if not field:
                continue
            for citation in field.metadata.citations:
                key = (citation.source_id, citation.locator)
                if key in seen:
                    continue
                citations.append(citation)
                seen.add(key)
        return citations
