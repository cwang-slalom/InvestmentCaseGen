from __future__ import annotations

from typing import Any
from uuid import uuid4

from ..ai import (
    DatabricksModelServingProvider,
    StructuredGenerationRequest,
    StructuredGenerationResponse,
)
from ..config import Settings
from ..models.audience import AudienceProfile
from ..models.base import BackendHealth, CitationRef
from ..models.extraction import ExtractionResult
from ..models.generation import GeneratedSection, GenerationResult
from ..models.opportunity import Opportunity
from ..models.project import Project
from ..prompts import load_operation_prompt
from ..repositories.memory import case_repository

from .base import GenerationBackend


class DatabricksRequestAdapter:
    """Maps Phase 1 UI project state into backend-owned structured AI requests."""

    default_outputs = ["investment_case", "one_page", "source_appendix"]

    def map_generate(self, project: Project, generation_id: str) -> StructuredGenerationRequest:
        prompt = load_operation_prompt("render_executive_investment_case")
        selected_outputs = self.selected_output_types(project)
        return StructuredGenerationRequest(
            operation="render_executive_investment_case",
            promptVersion=prompt.version,
            externalWebSearch=self.external_web_search_requested(project),
            input=self.generation_input(project, selected_outputs, generation_id),
            jsonSchema=GenerationResult.model_json_schema(by_alias=True),
            metadata={"promptName": prompt.name, "uiRoute": "/api/projects/{projectId}/generate"},
        )

    def map_regenerate_section(
        self,
        project: Project,
        generation: GenerationResult,
        section_id: str,
    ) -> tuple[StructuredGenerationRequest, GeneratedSection]:
        existing = self.find_section(generation, section_id)
        prompt = load_operation_prompt("regenerate_draft_section")
        payload = self.generation_input(
            project,
            self.selected_output_types(project),
            generation.generation_id,
        )
        payload["currentDocumentState"] = "REVISION"
        payload["targetSection"] = existing.model_dump(by_alias=True)
        payload["currentGeneration"] = generation.model_dump(by_alias=True)
        payload["currentUserInstructions"] = (
            "Regenerate only targetSection. Preserve its id and type. Keep all "
            "source facts, locked facts, unresolved role distinctions, and citations "
            "source-grounded. Return exactly one GeneratedSection object."
        )
        return (
            StructuredGenerationRequest(
                operation="regenerate_draft_section",
                promptVersion=prompt.version,
                externalWebSearch=False,
                input=payload,
                jsonSchema=GeneratedSection.model_json_schema(by_alias=True),
                metadata={"promptName": prompt.name, "uiRoute": "/api/generations/{generationId}/sections/{sectionId}/regenerate"},
            ),
            existing,
        )

    def generation_input(
        self,
        project: Project,
        selected_outputs: list[str],
        generation_id: str,
    ) -> dict[str, Any]:
        opportunity = self.selected_opportunity(project)
        audience = self.selected_audience(project)
        extraction = self.extraction(project)
        return {
            "documentType": "coordinated_donor_output_package",
            "caseTitle": project.name,
            "userGoal": self.user_goal(project),
            "targetLength": self.target_length(selected_outputs),
            "currentDocumentState": "NEW_DRAFT",
            "caseBrief": {
                "project": project.model_dump(by_alias=True),
                "selectedOpportunity": opportunity.model_dump(by_alias=True) if opportunity else None,
                "selectedAudience": audience.model_dump(by_alias=True) if audience else None,
                "selectedOutputs": selected_outputs,
                "expectedGenerationId": generation_id,
                "expectedProjectId": project.id,
                "conceptFirstGuardrail": (
                    "Do not assume the sponsor, concept owner, implementing "
                    "organization, investment manager, funding recipient, delivery "
                    "partner, beneficiary, or investor audience are the same entity."
                ),
            },
            "approvedFactLedger": self.approved_fact_ledger(opportunity, extraction),
            "lockedFacts": self.locked_facts(extraction),
            "requiredContent": [
                "Return exactly the selected output types and no additional outputs.",
                "Use generationId and projectId from caseBrief exactly.",
                "Every metadata value must be a string.",
                "Label unresolved funding recipient, investment vehicle, fiscal sponsor, investment manager, and implementation roles as unresolved unless directly supported.",
                "Treat all generated content as a human-review-required draft.",
            ],
            "sourceExcerpts": self.source_excerpts(opportunity, extraction),
            "documentTemplate": {
                "outputs": [self.output_template(output_type) for output_type in selected_outputs],
                "allowedSectionTypes": [
                    "narrative",
                    "metric",
                    "opportunity",
                    "team",
                    "diligence",
                    "risk",
                    "engage",
                ],
            },
            "currentUserInstructions": (
                "Generate polished donor- and investor-ready markdown sections for "
                "the UI output package. Keep claims source-grounded, cite supplied "
                "sourceExcerpts, and use informationNeeded plus reviewFindings for "
                "missing evidence instead of inventing facts."
            ),
            "workspaceProfile": {
                "product": "Investment Case Generator MVP",
                "audienceDefault": "sophisticated funders, donors, and investment partners",
                "draftStatus": "human review required",
                "businessRule": (
                    "The product is concept-first, not organization-first. Funding "
                    "may flow through a separate vehicle or recipient."
                ),
            },
            "extractedFields": (
                [field.model_dump(by_alias=True) for field in extraction.fields]
                if extraction
                else []
            ),
        }

    def selected_output_types(self, project: Project) -> list[str]:
        selected = (
            project.opportunity_audience.selected_outputs
            if project.opportunity_audience
            else []
        )
        return list(selected or self.default_outputs)

    def external_web_search_requested(self, project: Project) -> bool:
        if not project.review_setup:
            return False
        field = next(
            (
                item
                for item in project.review_setup.approach_fields
                if item.id == "external_web_search"
            ),
            None,
        )
        return bool(field and field.value.strip().lower() == "enabled")

    def selected_opportunity(self, project: Project) -> Opportunity | None:
        if not project.opportunity_audience or not project.opportunity_audience.opportunity_id:
            return None
        return case_repository.opportunity_repo.opportunities.get(
            project.opportunity_audience.opportunity_id,
        )

    def selected_audience(self, project: Project) -> AudienceProfile | None:
        if not project.opportunity_audience or not project.opportunity_audience.audience_id:
            return None
        return case_repository.audience_repo.audiences.get(
            project.opportunity_audience.audience_id,
        )

    def extraction(self, project: Project) -> ExtractionResult | None:
        if not project.extraction_id:
            return None
        return case_repository.extractions.get(project.extraction_id)

    def user_goal(self, project: Project) -> str:
        task = project.task
        if not task:
            return "Generate selected donor-facing materials."
        return task.custom_description or task.task_label or "Generate selected donor-facing materials."

    def target_length(self, selected_outputs: list[str]) -> str:
        labels = {
            "investment_case": "full executive investment case",
            "one_page": "one-page opportunity summary",
            "talking_points": "brief meeting talking points",
            "source_appendix": "concise source appendix",
        }
        return "; ".join(labels.get(output_type, output_type) for output_type in selected_outputs)

    def approved_fact_ledger(
        self,
        opportunity: Opportunity | None,
        extraction: ExtractionResult | None,
    ) -> list[dict[str, Any]]:
        facts: list[dict[str, Any]] = []
        if opportunity:
            citation = self.source_citation(opportunity)
            facts.extend(
                [
                    {"id": "opportunity_title", "label": "Opportunity title", "value": opportunity.title, "citations": [citation]},
                    {"id": "program_area", "label": "Program area", "value": opportunity.program_area, "citations": [citation]},
                    {"id": "geography", "label": "Geography", "value": opportunity.geography, "citations": [citation]},
                    {"id": "summary", "label": "Summary", "value": opportunity.summary, "citations": [citation]},
                    {"id": "funding_range", "label": "Funding range", "value": opportunity.funding_range, "citations": [citation]},
                    {"id": "why_now", "label": "Why now", "value": opportunity.why_now, "citations": [citation]},
                    {"id": "reach", "label": "Reach", "value": opportunity.reach, "citations": [citation]},
                    {"id": "primary_outcomes", "label": "Primary outcomes", "value": "; ".join(opportunity.primary_outcomes), "citations": [citation]},
                    {"id": "differentiators", "label": "Differentiators", "value": "; ".join(opportunity.differentiators), "citations": [citation]},
                ]
            )
        if extraction:
            for field in extraction.fields:
                if field.verified or field.locked or field.metadata.confirmed:
                    facts.append(
                        {
                            "id": field.id,
                            "label": field.label,
                            "value": field.value,
                            "locked": field.locked,
                            "confidence": field.confidence,
                            "citations": [
                                citation.model_dump(by_alias=True)
                                for citation in field.metadata.citations
                            ],
                        }
                    )
        return facts

    def locked_facts(self, extraction: ExtractionResult | None) -> list[dict[str, Any]]:
        if not extraction:
            return []
        return [
            {
                "id": field.id,
                "label": field.label,
                "value": field.value,
                "citations": [
                    citation.model_dump(by_alias=True)
                    for citation in field.metadata.citations
                ],
            }
            for field in extraction.fields
            if field.locked
        ]

    def source_excerpts(
        self,
        opportunity: Opportunity | None,
        extraction: ExtractionResult | None,
    ) -> list[dict[str, Any]]:
        excerpts: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        if opportunity:
            for source in opportunity.source_list:
                key = (source.id, source.locator)
                if key in seen:
                    continue
                seen.add(key)
                excerpts.append(
                    {
                        "sourceId": source.id,
                        "label": source.title,
                        "locator": source.locator,
                        "excerpt": source.excerpt,
                        "status": source.status,
                    }
                )

        if extraction:
            for field in extraction.fields:
                for citation in field.metadata.citations:
                    key = (citation.source_id, citation.locator)
                    if key in seen:
                        continue
                    seen.add(key)
                    excerpts.append(
                        {
                            **citation.model_dump(by_alias=True),
                            "fieldId": field.id,
                            "fieldLabel": field.label,
                        }
                    )

        return excerpts

    def output_template(self, output_type: str) -> dict[str, Any]:
        templates: dict[str, dict[str, Any]] = {
            "investment_case": {
                "type": "investment_case",
                "title": "Investment Case Draft",
                "minimumSections": 5,
                "sectionGuidance": [
                    "investment proposition",
                    "evidence and why now",
                    "capital pathway and organization roles",
                    "diligence priorities and risks",
                    "suggested next conversation",
                ],
            },
            "one_page": {
                "type": "one_page",
                "title": "1-Page Opportunity Summary",
                "minimumSections": 2,
                "sectionGuidance": ["opportunity summary", "audience fit", "evidence boundary"],
            },
            "talking_points": {
                "type": "talking_points",
                "title": "Meeting Talking Points",
                "minimumSections": 2,
                "sectionGuidance": ["opening frame", "questions to invite", "next-step language"],
            },
            "source_appendix": {
                "type": "source_appendix",
                "title": "Source Appendix",
                "minimumSections": 2,
                "sectionGuidance": ["source list", "evidence gaps and unresolved roles"],
            },
        }
        return templates.get(
            output_type,
            {"type": output_type, "title": output_type.replace("_", " ").title()},
        )

    def source_citation(self, opportunity: Opportunity) -> dict[str, str]:
        source = opportunity.source_list[0]
        return CitationRef(
            sourceId=source.id,
            label=source.title,
            locator=source.locator,
            excerpt=source.excerpt,
        ).model_dump(by_alias=True)

    def find_section(self, generation: GenerationResult, section_id: str) -> GeneratedSection:
        for output in generation.outputs:
            for section in output.sections:
                if section.id == section_id:
                    return section
        raise ValueError("Section not found.")


class DatabricksGenerationBackend(GenerationBackend):
    provider_name = "databricks-generation-backend"

    def __init__(
        self,
        settings: Settings,
        adapter: DatabricksRequestAdapter | None = None,
        provider: DatabricksModelServingProvider | None = None,
    ):
        self.settings = settings
        self.adapter = adapter or DatabricksRequestAdapter()
        self.provider = provider

    async def health_check(self) -> BackendHealth:
        if not self.settings.databricks_host or not self.settings.databricks_model_name:
            return BackendHealth(
                status="not_configured",
                provider=self.provider_name,
                message=(
                    "Databricks backend is prepared but not configured. Supply the "
                    "approved host, endpoint or agent resource, and App identity permissions."
                ),
            )
        if not self.settings.databricks_token and not (
            self.settings.databricks_client_id and self.settings.databricks_client_secret
        ):
            return BackendHealth(
                status="not_configured",
                provider=self.provider_name,
                message=(
                    "Databricks endpoint is selected, but the app runtime has not "
                    "provided DATABRICKS_TOKEN or Databricks App OAuth credentials."
                ),
            )
        return BackendHealth(
            status="ok",
            provider=self.provider_name,
            message=(
                "UI generation is configured to call Databricks Model Serving "
                "through the backend-owned Claude prompt and schema boundary."
            ),
        )

    async def generate(self, project: Project) -> GenerationResult:
        generation_id = f"gen-{project.id}-{uuid4().hex[:8]}"
        request = self.adapter.map_generate(project, generation_id)
        response = self._structured_provider().generate_structured(request)
        return self._normalize_generation_result(
            response,
            project,
            generation_id,
            self.adapter.selected_output_types(project),
        )

    async def regenerate_section(
        self,
        project: Project,
        generation: GenerationResult,
        section_id: str,
    ) -> GeneratedSection:
        request, existing = self.adapter.map_regenerate_section(project, generation, section_id)
        response = self._structured_provider().generate_structured(request)
        section = GeneratedSection.model_validate(response.output)
        return section.model_copy(
            update={
                "id": existing.id,
                "type": existing.type,
            }
        )

    def _structured_provider(self) -> DatabricksModelServingProvider:
        return self.provider or DatabricksModelServingProvider(self.settings)

    def _normalize_generation_result(
        self,
        response: StructuredGenerationResponse,
        project: Project,
        generation_id: str,
        selected_outputs: list[str],
    ) -> GenerationResult:
        result = GenerationResult.model_validate(response.output)
        by_type = {output.type: output for output in result.outputs}
        missing_outputs = [
            output_type
            for output_type in selected_outputs
            if output_type not in by_type
        ]
        if missing_outputs:
            raise ValueError(
                "Databricks Model Serving omitted selected output types: "
                f"{', '.join(missing_outputs)}.",
            )

        ordered_outputs = [
            by_type[output_type].model_copy(
                update={"status": "Claude generated - human review required"},
            )
            for output_type in selected_outputs
        ]
        metadata = {
            str(key): str(value)
            for key, value in result.metadata.items()
        }
        metadata.update(
            {
                "mode": "live",
                "provider": response.model_provider,
                "modelName": response.model_name,
                "storedPayloadMode": response.stored_payload_mode,
                "projectId": project.id,
                "generatedVia": "/api/projects/{projectId}/generate",
            }
        )
        if response.redacted_response_json:
            metadata["redactedResponseMetadata"] = "available"

        return result.model_copy(
            update={
                "generation_id": generation_id,
                "project_id": project.id,
                "status": "needs_information" if result.information_needed else "completed",
                "outputs": ordered_outputs,
                "metadata": metadata,
            }
        )
