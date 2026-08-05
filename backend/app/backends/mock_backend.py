from __future__ import annotations

from app.fixtures import AUDIENCES, OPPORTUNITIES, generated_example
from app.models.base import BackendHealth, CitationRef
from app.models.generation import GeneratedOutput, GeneratedSection, GenerationResult
from app.models.opportunity import Opportunity
from app.models.project import Project
from app.repositories.memory import case_repository
from app.services.integrity import protected_fact_tokens

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
